// Sign-in with Google (OpenID Connect, authorization code + PKCE). The CMS never sees or
// stores a password. Who may sign in, and with which role, is decided on the server:
//   - CMS_SUPER_ADMINS (environment) are always Super Admins and cannot be demoted from the UI;
//   - everyone else must be an active row in the `users` tab, managed by a Super Admin.
// Role changes and removals apply within USER_TTL_MS (the role is re-read, not kept in the cookie).
import { createHash, randomBytes } from "node:crypto";
import { sign, verify, safeEqual } from "./session.mjs";
import { HttpError, parseCookies, cookie, now } from "./http.mjs";
import { ROLES } from "../shared/schema.mjs";

const USER_TTL_MS = 30_000;
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export function createAuth({ cfg, store, audit, fetchImpl = globalThis.fetch }) {
  const secure = cfg.production || cfg.baseUrl.startsWith("https://");
  const SESSION = secure ? "__Host-cms_session" : "cms_session";
  const OAUTH = secure ? "__Host-cms_oauth" : "cms_oauth";
  let users = null; // { at, list }

  async function userRows() {
    if (!users || Date.now() - users.at > USER_TTL_MS) users = { at: Date.now(), list: await store.list("users") };
    return users.list;
  }
  const invalidateUsers = () => { users = null; };

  async function resolveUser(emailRaw) {
    const email = String(emailRaw || "").trim().toLowerCase();
    if (!email) return null;
    const row = (await userRows()).find((u) => u.id === email);
    if (cfg.superAdmins.includes(email)) return { email, name: row?.name || email, role: "super_admin", pinned: true };
    if (!row || row.active !== true || !ROLES[row.role]) return null;
    return { email, name: row.name || email, role: row.role, pinned: false };
  }

  async function currentUser(request) {
    const token = parseCookies(request.headers.get("cookie"))[SESSION];
    const s = verify(token, cfg.sessionSecret);
    if (!s) return null;
    return resolveUser(s.sub);
  }

  function sessionCookie(email) {
    const exp = Date.now() + cfg.sessionHours * 3600_000;
    return cookie(SESSION, sign({ sub: email, iat: Date.now(), exp }, cfg.sessionSecret), { maxAge: cfg.sessionHours * 3600, secure });
  }
  const clearSession = () => cookie(SESSION, "", { maxAge: 0, secure });
  const redirect = (location, cookies = []) => {
    const h = new Headers({ location, "cache-control": "no-store" });
    for (const c of cookies) h.append("set-cookie", c);
    return new Response(null, { status: 302, headers: h });
  };

  async function googleStart() {
    if (!cfg.oauthClientId) throw new HttpError(503, "Google sign-in is not configured for this CMS.", "sso_not_configured");
    const state = randomBytes(24).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const params = new URLSearchParams({
      client_id: cfg.oauthClientId, redirect_uri: `${cfg.baseUrl}/api/auth/google/callback`, response_type: "code",
      scope: "openid email profile", state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
    });
    if (cfg.allowedDomains.length === 1) params.set("hd", cfg.allowedDomains[0]);
    const oauth = sign({ state, nonce, verifier, exp: Date.now() + 10 * 60_000 }, cfg.sessionSecret);
    return redirect(`${GOOGLE_AUTH}?${params}`, [cookie(OAUTH, oauth, { maxAge: 600, secure })]);
  }

  async function googleCallback(request) {
    const url = new URL(request.url);
    const fail = (code) => redirect(`/?login_error=${code}`, [cookie(OAUTH, "", { maxAge: 0, secure })]);
    const saved = verify(parseCookies(request.headers.get("cookie"))[OAUTH], cfg.sessionSecret);
    const state = url.searchParams.get("state") || "";
    if (url.searchParams.get("error")) return fail("cancelled");
    if (!saved || !state || !safeEqual(saved.state, state)) return fail("expired");

    const res = await fetchImpl(GOOGLE_TOKEN, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: url.searchParams.get("code") || "", client_id: cfg.oauthClientId, client_secret: cfg.oauthClientSecret,
        redirect_uri: `${cfg.baseUrl}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: saved.verifier,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!res || !res.ok) return fail("google");
    const { id_token: idToken } = await res.json();
    // The ID token came straight from Google's token endpoint over TLS, which authenticates
    // its issuer (OpenID Connect Core §3.1.3.7); the claims are still checked here.
    let claims;
    try { claims = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8")); } catch { return fail("google"); }
    const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    if (!issOk || claims.aud !== cfg.oauthClientId || !(claims.exp * 1000 > Date.now()) || !claims.nonce || !safeEqual(claims.nonce, saved.nonce)) return fail("google");
    if (claims.email_verified !== true) return fail("unverified");
    const email = String(claims.email || "").toLowerCase();
    if (cfg.allowedDomains.length && !cfg.allowedDomains.includes(email.split("@")[1])) return fail("domain");
    const user = await resolveUser(email);
    if (!user) {
      await audit.log({ email, role: "" }, "login_refused", "", "", "", "Not on the CMS user list");
      return fail("not_authorized");
    }
    await audit.log(user, "login", "", "", "", "Google");
    return redirect("/", [sessionCookie(user.email), cookie(OAUTH, "", { maxAge: 0, secure })]);
  }

  // Local development only: config refuses CMS_DEV_LOGIN in production, and the request
  // must come to localhost.
  async function devLogin(request, email) {
    const host = new URL(request.url).hostname;
    if (!cfg.devLogin || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) throw new HttpError(404, "Not found.", "not_found");
    const user = await resolveUser(email);
    if (!user) throw new HttpError(403, "That user is not on the CMS user list.", "not_authorized");
    await audit.log(user, "login", "", "", "", "development login");
    return { user, cookie: sessionCookie(user.email) };
  }

  return { currentUser, resolveUser, googleStart, googleCallback, devLogin, clearSession, invalidateUsers, userRows, stamp: now };
}
