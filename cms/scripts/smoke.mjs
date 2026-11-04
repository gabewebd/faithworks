// End-to-end smoke test of a running CMS (local `next start`/`next dev`, or a Preview deployment).
//   node scripts/smoke.mjs http://localhost:5174 [--write]
// Signs a session cookie with CMS_SESSION_SECRET (read from cms/.env or the environment), so it
// needs no Google sign-in. Read-only unless --write is given; with --write it creates, publishes,
// unpublishes and deletes one throwaway resource and event. Never prints secrets or cookie values.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.mjs";
import { sign } from "../server/session.mjs";

const CMS = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(CMS, ".env"));
const base = (process.argv[2] || "http://localhost:5174").replace(/\/$/, "");
const write = process.argv.includes("--write");
const email = process.env.SMOKE_EMAIL || "super.admin@example.test";
const secure = base.startsWith("https://");
const token = sign({ typ: "session", sub: email, iat: Date.now(), exp: Date.now() + 15 * 60_000 }, process.env.CMS_SESSION_SECRET);

let pass = 0, fail = 0;
const results = [];
async function check(name, fn) {
  try { const note = await fn(); pass++; results.push(`PASS  ${name}${note ? `  (${note})` : ""}`); }
  catch (e) { fail++; results.push(`FAIL  ${name}: ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
async function call(method, path, { body, auth = true, csrf = method !== "GET", headers = {}, raw } = {}) {
  const h = { ...headers };
  if (auth) h.cookie = `__Host-cms_session=${token}; cms_session=${token}`; // name depends on the server's production flag
  if (csrf) h["x-cms-csrf"] = "1";
  if (body !== undefined && !raw) h["content-type"] = "application/json";
  const res = await fetch(base + path, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)), redirect: "manual" });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

await check("dashboard page served at /", async () => {
  const r = await call("GET", "/", { auth: false });
  assert(r.status === 200 && String(r.data).includes('src="/ui/app.mjs"'), `status ${r.status}`);
  assert(/script-src 'self'/.test(r.headers.get("content-security-policy") || ""), "CSP header missing");
  return "CSP present";
});
for (const f of ["/ui/app.mjs", "/ui/cms.css", "/shared/schema.mjs"]) await check(`static ${f}`, async () => { const r = await call("GET", f, { auth: false }); assert(r.status === 200, `status ${r.status}`); });
await check("health", async () => { const r = await call("GET", "/api/health", { auth: false }); assert(r.status === 200 && r.data.configured === true, JSON.stringify(r.data)); return `store=${r.data.store}`; });
await check("protected route without session -> 401", async () => { const r = await call("GET", "/api/dashboard", { auth: false }); assert(r.status === 401, `status ${r.status}`); });
await check("write without CSRF header -> 403", async () => { const r = await call("POST", "/api/records/resources", { body: { data: {} }, csrf: false }); assert(r.status === 403, `status ${r.status}`); });
await check("session resolves signed-in user", async () => { const r = await call("GET", "/api/session"); assert(r.data.user?.email === email || r.data.user?.id === email, JSON.stringify(r.data.user)); return r.data.user.role; });
await check("dashboard data", async () => { const r = await call("GET", "/api/dashboard"); assert(r.status === 200, `status ${r.status}`); });
for (const c of ["resources", "events", "programs", "testimonials"]) await check(`list ${c}`, async () => { const r = await call("GET", `/api/records/${c}`); assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); return `${(r.data.records || r.data.items || r.data).length ?? "?"} records`; });
await check("tags, authors, users, audit", async () => { for (const p of ["/api/tags", "/api/authors", "/api/users", "/api/audit"]) { const r = await call("GET", p); assert(r.status === 200, `${p} ${r.status}`); } });
await check("public content (no auth, CORS)", async () => { const r = await call("GET", "/api/public/content", { auth: false }); assert(r.status === 200 && r.headers.get("access-control-allow-origin") === "*", `status ${r.status}`); return `${(r.data.resources || []).length} published resources`; });
await check("unknown API route -> 404 JSON", async () => { const r = await call("GET", "/api/nope"); assert(r.status === 404 && r.data.error, `status ${r.status}`); });

if (write) {
  const stamp = Date.now().toString(36);
  let id, version, draft;
  await check("create resource draft", async () => {
    const list = await call("GET", "/api/records/resources");
    const src = (list.data.records || list.data.items || list.data).find((x) => x.status === "published") || {};
    const keep = ["resource_type", "category", "summary", "author", "read_time", "access_rule", "body_html", "cover_image_url", "cover_image_alt", "meta_description"];
    const data = Object.fromEntries(keep.filter((k) => src[k] !== undefined).map((k) => [k, src[k]]));
    Object.assign(data, {
      title: `Smoke test ${stamp}`, slug: `smoke-test-${stamp}`, summary: data.summary || "Smoke test summary.",
      resource_type: data.resource_type || "article", category: data.category || "Smoke test", publish_date: new Date().toISOString().slice(0, 10),
      body_html: data.body_html || "<p>Smoke test page content.</p>",
    });
    draft = data;
    const r = await call("POST", "/api/records/resources", { body: { data } });
    assert(r.status === 201, `status ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    ({ id, version } = r.data.record);
  });
  await check("edit draft", async () => { const r = await call("PUT", `/api/records/resources/${id}`, { body: { version, data: { ...draft, summary: "Edited by smoke test." } } }); assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); version = r.data.record.version; });
  await check("preview render", async () => { const r = await call("POST", "/api/preview", { body: { collection: "resources", id, data: { title: `Smoke test ${stamp}`, slug: `smoke-test-${stamp}` } } }); assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return `${JSON.stringify(r.data).length} bytes`; });
  await check("publish", async () => { const r = await call("POST", `/api/records/resources/${id}/actions/publish`, { body: { version } }); assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); version = r.data.record.version; });
  await check("published resource appears in public content", async () => { const r = await call("GET", "/api/public/content", { auth: false }); assert((r.data.resources || []).some((x) => x.slug === `smoke-test-${stamp}`), "not found"); });
  await check("history", async () => { const r = await call("GET", `/api/records/resources/${id}/history`); assert(r.status === 200, `status ${r.status}`); });
  await check("unpublish", async () => { const r = await call("POST", `/api/records/resources/${id}/actions/unpublish`, { body: { version } }); assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); version = r.data.record.version; });
  await check("unpublished resource gone from public content", async () => { const r = await call("GET", "/api/public/content", { auth: false }); assert(!(r.data.resources || []).some((x) => x.slug === `smoke-test-${stamp}`), "still listed"); });
  await check("delete", async () => { const r = await call("POST", `/api/records/resources/${id}/actions/delete`, { body: { version } }); assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); });
  await check("edit existing event (save, no status change)", async () => {
    const list = await call("GET", "/api/records/events");
    const first = (list.data.records || list.data.items || list.data)[0];
    const ev = (await call("GET", `/api/records/events/${first.id}`)).data.record;
    const r = await call("PUT", `/api/records/events/${ev.id}`, { body: { version: ev.version, data: ev } });
    assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  });
  if (!secure) await check("image upload (local store only)", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const r = await call("POST", "/api/media", { raw: png, headers: { "content-type": "image/png", "x-file-name": `smoke-${stamp}.png` } });
    assert(r.status === 201, `status ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    return r.data.url;
  });
}
await check("logout clears cookie", async () => { const r = await call("POST", "/api/auth/logout", { body: {} }); assert(r.status === 200 && /max-age=0|expires=/i.test(r.headers.get("set-cookie") || ""), `status ${r.status}`); });

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
