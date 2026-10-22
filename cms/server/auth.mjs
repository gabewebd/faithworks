// Sign-in with Google (OpenID Connect, authorization code + PKCE). The CMS never sees or
// stores a password. Who may sign in, and with which role, is decided on the server:
//   - CMS_SUPER_ADMINS (environment) are always Super Admins and cannot be demoted from the UI;
//   - everyone else must be an active row in the `users` tab, managed by a Super Admin. Rows
//     with an unknown role cannot sign in.
// Role changes and removals apply within USER_TTL_MS (the role is re-read, not kept in the cookie).
import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";
import { sign, verify, safeEqual } from "./session.mjs";
import { HttpError, parseCookies, cookie, now } from "./http.mjs";
import { normalizeRole } from "../shared/schema.mjs";

const USER_TTL_MS = 30_000;
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
// Google's ID-token signing keys (jwks_uri in https://accounts.google.com/.well-known/openid-configuration).
const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Verifies a Google ID token's RS256 signature with Google's published keys (node:crypto, no
// library) and returns its claims, or null. Keys are cached for the max-age Google sends and
// fetched again (at most once a minute) when a token names a key id that is not cached yet.
export function createGoogleKeys({ fetchImpl = globalThis.fetch, clock = Date.now } = {}) {
  let cache = { keys: new Map(), until: 0, fetchedAt: 0 };
  async function refresh() {
    const res = await fetchImpl(GOOGLE_JWKS, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Google signing keys: HTTP ${res.status}`);
    const { keys = [] } = await res.json();
    const maxAge = Number((res.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1]) || 3600;
    const map = new Map();
    for (const k of keys) if (k.kty === "RSA" && k.kid && (!k.alg || k.alg === "RS256")) map.set(k.kid, createPublicKey({ key: k, format: "jwk" }));
    cache = { keys: map, until: clock() + maxAge * 1000, fetchedAt: clock() };
  }
  async function keyFor(kid) {
    if (clock() > cache.until) await refresh();
    else if (!cache.keys.has(kid) && clock() - cache.fetchedAt > 60_000) await refresh();
    return cache.keys.get(kid) || null;
  }
  return async function verifyIdToken(idToken) {
    const parts = String(idToken || "").split(".");
    if (parts.length !== 3) return null;
    let header, claims;
    try {
      header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch { return null; }
    if (header.alg !== "RS256" || !header.kid) return null;
    const key = await keyFor(header.kid).catch(() => null);
    if (!key) return null;
    const ok = verifySignature("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
    return ok && claims && typeof claims === "object" ? claims : null;
  };
}

export function createAuth({ cfg, store, audit, fetchImpl = globalThis.fetch, verifyIdToken = createGoogleKeys({ fetchImpl }) }) {
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
    const role = normalizeRole(row?.role);
    if (!row || row.active !== true || !role) return null;
    return { email, name: row.name || email, role, pinned: false };
  }

  async function currentUser(request) {
    const token = parseCookies(request.headers.get("cookie"))[SESSION];
    const s = verify(token, cfg.sessionSecret);
    // `typ` keeps the two signed cookies apart: an OAuth-state token is never a session.
    if (!s || s.typ !== "session") return null;
    return resolveUser(s.sub);
  }

  function sessionCookie(email) {
    const exp = Date.now() + cfg.sessionHours * 3600_000;
    return cookie(SESSION, sign({ typ: "session", sub: email, iat: Date.now(), exp }, cfg.sessionSecret), { maxAge: cfg.sessionHours * 3600, secure });
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
      scope: "openid email", state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
    });
    if (cfg.allowedDomains.length === 1) params.set("hd", cfg.allowedDomains[0]);
    const oauth = sign({ typ: "oauth", state, nonce, verifier, exp: Date.now() + 10 * 60_000 }, cfg.sessionSecret);
    return redirect(`${GOOGLE_AUTH}?${params}`, [cookie(OAUTH, oauth, { maxAge: 600, secure })]);
  }

  async function googleCallback(request) {
    const url = new URL(request.url);
    const fail = (code) => redirect(`/?login_error=${code}`, [cookie(OAUTH, "", { maxAge: 0, secure })]);
    const saved = verify(parseCookies(request.headers.get("cookie"))[OAUTH], cfg.sessionSecret);
    const state = url.searchParams.get("state") || "";
    if (url.searchParams.get("error")) return fail("cancelled");
    if (!saved || saved.typ !== "oauth" || !state || !safeEqual(saved.state, state)) return fail("expired");
    const code = url.searchParams.get("code") || "";
    if (!code) return fail("google");

    const res = await fetchImpl(GOOGLE_TOKEN, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: cfg.oauthClientId, client_secret: cfg.oauthClientSecret,
        redirect_uri: `${cfg.baseUrl}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: saved.verifier,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!res || !res.ok) return fail("google");
    const idToken = await res.json().then((b) => b?.id_token, () => null);
    // Only the ID token is used (the access token is discarded, never stored or sent to the
    // browser). Its signature is verified with Google's keys, then its claims are checked.
    const claims = await verifyIdToken(idToken);
    if (!claims) return fail("google");
    if (!GOOGLE_ISSUERS.includes(claims.iss) || claims.aud !== cfg.oauthClientId || (claims.azp && claims.azp !== cfg.oauthClientId)) return fail("google");
    if (!(claims.exp * 1000 > Date.now()) || !claims.nonce || !safeEqual(claims.nonce, saved.nonce)) return fail("google");
    if (claims.email_verified !== true || typeof claims.email !== "string") return fail("unverified");
    const email = claims.email.trim().toLowerCase();
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
