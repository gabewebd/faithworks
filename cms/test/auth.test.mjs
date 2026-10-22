// Google sign-in, end to end against a mocked Google: the real start → callback flow, the ID
// token signed with a test RSA key served as Google's JWKS. Covers state, signature, claims,
// the allowlist, session cookies, logout and unauthenticated API access.
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { testApp, USERS } from "./helpers.mjs";
import { sign } from "../server/session.mjs";
import { loadConfig } from "../server/config.mjs";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const SECRET = "s".repeat(48);
const BASE = "https://cms.example.test";
const BOSS = "boss@example.test";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function idToken(claims, { key = privateKey, kid = "k1", alg = "RS256" } = {}) {
  const head = `${b64({ alg, kid, typ: "JWT" })}.${b64(claims)}`;
  const s = createSign("RSA-SHA256").update(head).sign(key).toString("base64url");
  return `${head}.${s}`;
}

function setup() {
  let nextToken = null;
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).startsWith("https://www.googleapis.com/oauth2/v3/certs")) return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "cache-control": "public, max-age=3600" } });
    if (String(url) === "https://oauth2.googleapis.com/token") {
      const body = new URLSearchParams(init.body);
      if (!body.get("code_verifier") || body.get("client_secret") !== "client-secret") return new Response("{}", { status: 400 });
      return new Response(JSON.stringify({ id_token: nextToken(body), access_token: "ya29.unused" }));
    }
    return new Response("not mocked", { status: 500 });
  };
  const t = testApp({
    fetchImpl,
    env: { CMS_DEV_LOGIN: "false", CMS_SESSION_SECRET: SECRET, GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET: "client-secret", CMS_BASE_URL: BASE, CMS_SUPER_ADMINS: BOSS },
  });
  assert.deepEqual(t.app.cfg.errors, []);
  const req = (path, { method = "GET", cookie, headers = {}, body } = {}) => t.app.handle(new Request(`${BASE}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...headers }, body }));

  // Runs start → callback. `claims(nonce)` builds the ID-token claims; `tamper` changes the callback.
  async function signIn(claims, { tamper = {}, sign: signOpts, raw } = {}) {
    const start = await req("/api/auth/google/start");
    assert.equal(start.status, 302);
    const loc = new URL(start.headers.get("location"));
    assert.equal(loc.searchParams.get("scope"), "openid email");
    assert.equal(loc.searchParams.get("code_challenge_method"), "S256");
    const oauthCookie = start.headers.getSetCookie()[0].split(";")[0];
    const nonce = loc.searchParams.get("nonce");
    nextToken = () => (raw ? raw(nonce) : idToken(claims(nonce), signOpts));
    const state = "state" in tamper ? tamper.state : loc.searchParams.get("state");
    const qs = new URLSearchParams({ ...(state !== null ? { state } : {}), code: "auth-code", ...(tamper.query || {}) });
    const cb = await req(`/api/auth/google/callback?${qs}`, { cookie: "cookie" in tamper ? tamper.cookie : oauthCookie });
    const session = cb.headers.getSetCookie().find((c) => c.startsWith("__Host-cms_session=") && !c.includes("Max-Age=0"));
    return { status: cb.status, location: cb.headers.get("location"), session, sessionPair: session?.split(";")[0] };
  }
  const good = (email = BOSS, extra = {}) => (nonce) => ({ iss: "https://accounts.google.com", aud: CLIENT_ID, azp: CLIENT_ID, sub: "1", email, email_verified: true, nonce, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600, ...extra });
  return { ...t, req, signIn, good, calls };
}

test("auth: a pinned Super Admin signs in; the session cookie is HttpOnly, Secure, __Host-, SameSite=Lax", async () => {
  const s = setup();
  try {
    const r = await s.signIn(s.good());
    assert.equal(r.location, "/");
    assert.match(r.session, /^__Host-cms_session=/);
    for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) assert.ok(r.session.includes(attr), attr);
    const me = await s.req("/api/session", { cookie: r.sessionPair });
    const body = await me.json();
    assert.equal(body.user.email, BOSS);
    assert.equal(body.user.role, "super_admin");
    assert.ok(!JSON.stringify(body).includes("ya29"), "Google access token never reaches the browser");
  } finally { s.cleanup(); }
});

test("auth: an active user from the users table signs in; emails are compared exactly, case-insensitively", async () => {
  const s = setup();
  try {
    const r = await s.signIn(s.good(USERS.author.toUpperCase()));
    assert.ok(r.session);
    const body = await (await s.req("/api/session", { cookie: r.sessionPair })).json();
    assert.equal(body.user.email, USERS.author);
  } finally { s.cleanup(); }
});

test("auth: accounts not on the allowlist are refused before any session exists", async () => {
  const s = setup();
  try {
    for (const email of ["outsider@example.test", `x${BOSS}`, `${BOSS}.evil.test`, "boss@example.test.evil"]) {
      const r = await s.signIn(s.good(email));
      assert.equal(r.location, "/?login_error=not_authorized", email);
      assert.equal(r.session, undefined, email);
    }
  } finally { s.cleanup(); }
});

test("auth: an unverified or missing email is refused", async () => {
  const s = setup();
  try {
    for (const extra of [{ email_verified: false }, { email_verified: "true" }, { email: undefined }]) {
      const r = await s.signIn(s.good(BOSS, extra));
      assert.equal(r.location, "/?login_error=unverified");
      assert.equal(r.session, undefined);
    }
  } finally { s.cleanup(); }
});

test("auth: missing, wrong or cookieless OAuth state is refused", async () => {
  const s = setup();
  try {
    for (const tamper of [{ state: null }, { state: "forged" }, { cookie: null }, { cookie: "__Host-cms_oauth=garbage" }]) {
      const r = await s.signIn(s.good(), { tamper });
      assert.equal(r.location, "/?login_error=expired", JSON.stringify(tamper));
      assert.equal(r.session, undefined);
    }
    // A valid session token cannot stand in for the OAuth-state cookie.
    const session = sign({ typ: "session", sub: BOSS, state: "x", nonce: "n", verifier: "v", exp: Date.now() + 60_000 }, SECRET);
    const r = await s.signIn(s.good(), { tamper: { state: "x", cookie: `__Host-cms_oauth=${session}` } });
    assert.equal(r.location, "/?login_error=expired");
    const cancelled = await s.signIn(s.good(), { tamper: { query: { error: "access_denied" } } });
    assert.equal(cancelled.location, "/?login_error=cancelled");
  } finally { s.cleanup(); }
});

test("auth: ID tokens with a bad signature, wrong audience/issuer/azp, expired or wrong nonce are refused", async () => {
  const s = setup();
  try {
    const cases = [
      [s.good(), { key: other.privateKey }],            // signed by someone else
      [s.good(), { kid: "unknown" }],                   // key Google does not publish
      [s.good(), { alg: "none" }],
      [s.good(BOSS, { aud: "someone-else" })],
      [s.good(BOSS, { iss: "https://evil.example" })],
      [s.good(BOSS, { azp: "someone-else" })],
      [s.good(BOSS, { exp: Math.floor(Date.now() / 1000) - 10 })],
      [(nonce) => s.good()(nonce + "x")],
      [s.good(BOSS, { nonce: undefined })],
    ];
    for (const [claims, signOpts] of cases) {
      const r = await s.signIn(claims, { sign: signOpts });
      assert.equal(r.location, "/?login_error=google", JSON.stringify(signOpts || claims("N")));
      assert.equal(r.session, undefined);
    }
    // Tokens whose payload claims everything but carry no valid signature are still refused.
    const unsigned = (nonce) => `${b64({ alg: "RS256", kid: "k1" })}.${b64(s.good()(nonce))}.`;
    const garbage = () => "not-a-jwt";
    for (const raw of [unsigned, garbage]) {
      const r = await s.signIn(null, { raw });
      assert.equal(r.location, "/?login_error=google");
      assert.equal(r.session, undefined);
    }
  } finally { s.cleanup(); }
});

test("auth: forged, expired or wrong-type session cookies are rejected by protected endpoints", async () => {
  const s = setup();
  try {
    const now = Date.now();
    const cookies = [
      sign({ typ: "session", sub: BOSS, exp: now + 60_000 }, "w".repeat(48)),  // wrong secret
      sign({ typ: "session", sub: BOSS, exp: now - 1 }, SECRET),               // expired
      sign({ typ: "oauth", sub: BOSS, exp: now + 60_000 }, SECRET),            // OAuth-state token
      sign({ sub: BOSS, exp: now + 60_000 }, SECRET),                          // no type (pre-hardening format)
      sign({ typ: "session", sub: "outsider@example.test", exp: now + 60_000 }, SECRET),
    ];
    for (const c of cookies) {
      const r = await s.req("/api/dashboard", { cookie: `__Host-cms_session=${c}` });
      assert.equal(r.status, 401);
    }
    assert.equal((await s.req("/api/dashboard", { cookie: `__Host-cms_session=${sign({ typ: "session", sub: BOSS, exp: now + 60_000 }, SECRET)}` })).status, 200);
  } finally { s.cleanup(); }
});

test("auth: protected endpoints refuse anonymous requests; logout needs the CSRF header and clears the cookie", async () => {
  const s = setup();
  try {
    for (const [method, path] of [["GET", "/api/dashboard"], ["GET", "/api/users"], ["GET", "/api/backup"], ["GET", "/api/submissions"], ["GET", "/api/audit"], ["GET", "/api/records/programs"]]) {
      assert.equal((await s.req(path, { method })).status, 401, path);
    }
    for (const [method, path] of [["POST", "/api/users"], ["POST", "/api/deploy"], ["PUT", "/api/records/programs/x"]]) {
      const r = await s.req(path, { method, headers: { "content-type": "application/json", "x-cms-csrf": "1" }, body: "{}" });
      assert.equal(r.status, 401, path);
      assert.equal((await s.req(path, { method, headers: { "content-type": "application/json" }, body: "{}" })).status, 403, `${path} without CSRF header`);
    }
    const { sessionPair } = await s.signIn(s.good());
    assert.equal((await s.req("/api/auth/logout", { method: "POST", cookie: sessionPair })).status, 403);
    assert.equal((await s.req("/api/auth/logout", { method: "POST", cookie: sessionPair, headers: { "x-cms-csrf": "1", origin: "https://evil.example" } })).status, 403);
    const out = await s.req("/api/auth/logout", { method: "POST", cookie: sessionPair, headers: { "x-cms-csrf": "1", origin: BASE } });
    assert.equal(out.status, 200);
    assert.match(out.headers.getSetCookie()[0], /^__Host-cms_session=; .*Max-Age=0/);
  } finally { s.cleanup(); }
});

test("auth: oversized JSON bodies are refused from Content-Length before reading", async () => {
  const s = setup();
  try {
    const { sessionPair } = await s.signIn(s.good());
    const r = await s.req("/api/tags", { method: "POST", cookie: sessionPair, headers: { "content-type": "application/json", "x-cms-csrf": "1", "content-length": "99999999" }, body: "{}" });
    assert.equal(r.status, 413);
  } finally { s.cleanup(); }
});

test("config: production fails closed on a missing, empty or malformed admin allowlist", () => {
  const base = { NETLIFY: "true", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_x", CMS_SESSION_SECRET: SECRET, GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET: "c", CMS_BASE_URL: BASE };
  assert.deepEqual(loadConfig({ ...base, CMS_SUPER_ADMINS: `${BOSS}, Second@Example.test` }).errors, []);
  for (const v of [undefined, "", " , ", "boss", "boss@example", "@example.test", `${BOSS};other@example.test`]) {
    assert.ok(loadConfig({ ...base, CMS_SUPER_ADMINS: v }).errors.some((e) => e.includes("CMS_SUPER_ADMINS")), String(v));
  }
  assert.ok(loadConfig({ ...base, CMS_SUPER_ADMINS: BOSS, CMS_DEV_LOGIN: "true" }).errors.some((e) => e.includes("CMS_DEV_LOGIN")));
});
