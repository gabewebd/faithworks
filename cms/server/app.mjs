// CMS API router. Platform-neutral: takes a web-standard Request and returns a Response, so
// the same code runs on Vercel (api/index.mjs), Netlify (netlify/functions/api.mjs) and the
// local dev server (scripts/dev.mjs).
//
// Every protected route resolves the signed-in user on the server and every service method
// checks that user's role and the record's state. State-changing requests must also carry
// the X-CMS-CSRF header and come from this origin (cookies are SameSite=Lax as well).
import { loadConfig, publicConfig, supabaseKeyKind } from "./config.mjs";
import { securityHeaders } from "./security.mjs";
import { HttpError, json, readJson, randomId } from "./http.mjs";
import { createJsonStore } from "./store/json-store.mjs";
import { createSheetsStore } from "./store/sheets-store.mjs";
import { createSheetsApi } from "./store/sheets-api.mjs";
import { createSupabaseStore } from "./store/supabase-store.mjs";
import { createAuth } from "./auth.mjs";
import { createLog } from "./services/log.mjs";
import { createRecords } from "./services/records.mjs";
import { withMigrations } from "./store/migrate.mjs";
import { createAdmin } from "./services/admin.mjs";
import { createPublic } from "./services/public.mjs";
import { createPreview } from "./services/preview.mjs";
import { safeEqual } from "./session.mjs";
import { isSuperAdmin, normalizeRole } from "../shared/schema.mjs";

export function createApp({ env = process.env, store: injectedStore, fetchImpl = globalThis.fetch, log = console } = {}) {
  const cfg = loadConfig(env);
  let store = injectedStore;
  if (!store && !cfg.errors.length) {
    // Supabase is the content store; Sheets only when explicitly chosen (rollback), JSON only locally.
    store = cfg.store === "supabase" ? createSupabaseStore({ url: cfg.supabaseUrl, serviceKey: cfg.supabaseServiceKey, fetchImpl, log })
      : cfg.store === "sheets" ? createSheetsStore(createSheetsApi({ spreadsheetId: cfg.spreadsheetId, clientEmail: cfg.clientEmail, privateKey: cfg.privateKey, fetchImpl, log }))
      : createJsonStore({ path: cfg.jsonPath, seedPath: cfg.seedPath });
  }
  if (store) store = withMigrations(store); // records from earlier versions, converted on read
  const logSvc = store && createLog({ store, log });
  const auth = store && createAuth({ cfg, store, audit: logSvc, fetchImpl });
  const pub = store && createPublic({ store, cfg, log, fetchImpl });
  const records = store && createRecords({ store, cfg, log: logSvc, onPublicChange: (why) => pub.triggerDeploy(why) });
  const admin = store && createAdmin({ store, cfg, log: logSvc, auth });
  const preview = store && createPreview({ store, cfg });
  const headers = securityHeaders(cfg);

  const routes = [];
  const route = (method, pattern, handler, { auth: needsAuth = true, csrf = method !== "GET" } = {}) => {
    const keys = [];
    const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
    routes.push({ method, re, keys, handler, needsAuth, csrf });
  };

  /* ---- Public (no session) ---- */
  route("GET", "/api/health", async () => json({ ok: true, store: cfg.store, configured: !cfg.errors.length, ...(cfg.store === "supabase" ? { supabaseKey: supabaseKeyKind(cfg.supabaseServiceKey) } : {}) }), { auth: false });
  route("GET", "/api/public/content", async () => {
    const { snap, stale } = await pub.published();
    return json(snap, 200, {
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600, stale-if-error=86400",
      "access-control-allow-origin": "*", ...(stale ? { "x-content-stale": "1" } : {}),
    });
  }, { auth: false });
  route("GET", "/api/public/preview", async ({ request }) => {
    const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!cfg.previewToken || !given || !safeEqual(given, cfg.previewToken)) throw new HttpError(401, "A valid preview token is required.", "unauthorized");
    return json(await pub.preview());
  }, { auth: false });

  /* ---- Sign-in ---- */
  route("GET", "/api/session", async ({ user }) => json({ user, config: publicConfig(cfg) }), { auth: false });
  route("GET", "/api/auth/google/start", async () => auth.googleStart(), { auth: false });
  route("GET", "/api/auth/google/callback", async ({ request }) => auth.googleCallback(request), { auth: false });
  route("POST", "/api/auth/logout", async () => json({ ok: true }, 200, { "set-cookie": auth.clearSession() }), { auth: false });
  route("GET", "/api/auth/dev-users", async ({ request }) => {
    if (!cfg.devLogin || !["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) throw new HttpError(404, "Not found.", "not_found");
    return json((await auth.userRows()).filter((u) => u.active && normalizeRole(u.role)).map((u) => ({ email: u.id, name: u.name, role: normalizeRole(u.role) })));
  }, { auth: false });
  route("POST", "/api/auth/dev-login", async ({ request }) => {
    const { email } = await readJson(request);
    const { user, cookie } = await auth.devLogin(request, email);
    return json({ user }, 200, { "set-cookie": cookie });
  }, { auth: false });

  /* ---- Content ---- */
  route("GET", "/api/dashboard", async ({ user }) => json(await records.dashboard(user)));
  route("GET", "/api/records/:collection", async ({ user, params, url }) => json(await records.list(user, params.collection, {
    q: url.searchParams.get("q") || "", status: url.searchParams.get("status") || "", tag: url.searchParams.get("tag") || "",
  })));
  route("POST", "/api/records/:collection", async ({ user, params, request, rid }) => json(await records.create(user, params.collection, (await readJson(request)).data, { requestId: rid }), 201));
  route("GET", "/api/records/:collection/:id", async ({ user, params }) => json(await records.get(user, params.collection, params.id)));
  route("PUT", "/api/records/:collection/:id", async ({ user, params, request, rid }) => json(await records.save(user, params.collection, params.id, await readJson(request), { requestId: rid })));
  route("POST", "/api/records/:collection/:id/actions/:action", async ({ user, params, request, rid }) => json(await records.act(user, params.collection, params.id, params.action, await readJson(request), { requestId: rid })));
  route("GET", "/api/records/:collection/:id/history", async ({ user, params }) => json(await records.history(user, params.collection, params.id)));
  route("POST", "/api/records/:collection/:id/history/:hid/restore", async ({ user, params, request, rid }) => json(await records.restoreVersion(user, params.collection, params.id, params.hid, await readJson(request), { requestId: rid })));
  route("GET", "/api/authors", async () => json(await records.authors()));
  route("POST", "/api/preview", async ({ user, request }) => {
    const body = await readJson(request);
    return json(await preview.render(user, body.collection, body));
  });

  /* ---- Admin ---- */
  route("GET", "/api/tags", async () => json(await admin.listTags()));
  route("POST", "/api/tags", async ({ user, request, rid }) => json(await admin.saveTag(user, await readJson(request), { requestId: rid }), 201));
  route("PUT", "/api/tags/:id", async ({ user, request, params, rid }) => json(await admin.saveTag(user, { ...(await readJson(request)), id: params.id }, { requestId: rid })));
  route("GET", "/api/users", async ({ user }) => json(await admin.listUsers(user)));
  route("POST", "/api/users", async ({ user, request, rid }) => json(await admin.saveUser(user, await readJson(request), { requestId: rid })));
  route("GET", "/api/audit", async ({ user, url }) => json(await admin.audit(user, { actor: url.searchParams.get("actor") || "", recordId: url.searchParams.get("record") || "" })));
  route("GET", "/api/recovery", async ({ user }) => json(await admin.recovery(user)));
  route("GET", "/api/backup", async ({ user, rid }) => {
    const data = await admin.backup(user, { requestId: rid });
    return json(data, 200, { "content-disposition": `attachment; filename="faithworks-cms-backup-${data.exported_at.slice(0, 10)}.json"` });
  });
  route("POST", "/api/deploy", async ({ user, rid }) => {
    if (!isSuperAdmin(user.role)) throw new HttpError(403, "Only Super Admins can rebuild the website.", "forbidden");
    const result = await pub.triggerDeploy("manual rebuild");
    await logSvc.log(user, "deploy", "", "", "", result.triggered ? "Rebuild started" : result.error || result.reason, rid);
    return json(result);
  });

  async function handle(request) {
    const rid = randomId("req", 6);
    let res;
    try {
      const url = new URL(request.url);
      // Vercel rewrite fallback: /api?__path=/api/records/... keeps the original path
      const path = url.searchParams.get("__path") || url.pathname;
      if (cfg.errors.length && path !== "/api/health") {
        throw new HttpError(503, "The CMS is not configured correctly. A developer needs to fix the deployment settings.", "misconfigured", { problems: cfg.production ? cfg.errors.map((e) => e.replace(/\(got .*?\)/, "")) : cfg.errors });
      }
      const matches = routes.filter((r) => r.re.test(path));
      if (!matches.length) throw new HttpError(404, "Not found.", "not_found");
      const r = matches.find((x) => x.method === request.method);
      if (!r) throw new HttpError(405, "Method not allowed.", "method_not_allowed");
      if (r.csrf) {
        const origin = request.headers.get("origin");
        const expected = cfg.baseUrl || url.origin;
        if (request.headers.get("x-cms-csrf") !== "1" || (origin && origin !== expected && origin !== url.origin)) throw new HttpError(403, "This request was blocked for security reasons (cross-site request). Reload the page and try again.", "csrf");
      }
      const user = auth ? await auth.currentUser(request) : null;
      if (r.needsAuth && !user) throw new HttpError(401, "Please sign in again.", "unauthorized");
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(path.match(r.re)[i + 1])]));
      res = await r.handler({ request, url, user, params, rid });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) log.error(`[${rid}] ${request.method} ${request.url}: ${e.stack || e.message}`);
      res = json({ error: { code: e.code || "error", message: status === 500 && !(e instanceof HttpError) ? "Something went wrong on the server. Nothing was saved by this request." : e.message, ...(e.details || {}), request_id: rid } }, status);
    }
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(headers)) if (!h.has(k)) h.set(k, v);
    h.set("x-request-id", rid);
    return new Response(res.body, { status: res.status, headers: h });
  }

  return { handle, cfg, store, services: { records, admin, pub, auth } };
}

let app;
export function handle(request) {
  app ||= createApp();
  return app.handle(request);
}
