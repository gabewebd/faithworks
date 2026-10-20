// Supabase adapter against an in-memory fake of the Supabase Data API (PostgREST): the filters,
// headers and responses the store uses. Exercises typed columns vs the `fields` bag, optimistic
// concurrency in the database, duplicate-safe inserts after a dropped connection, key checks
// and error reporting (no fallback to another store).
// This verifies the adapter's logic. The full API suite can also run against a real database:
// see test/helpers.mjs (CMS_TEST_SUPABASE_URL) and cms/README.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, supabaseKeyKind } from "../server/config.mjs";
import { createSupabaseStore, encodeRecord, decodeRow } from "../server/store/supabase-store.mjs";
import { testApp, signedIn, article } from "./helpers.mjs";

const jwt = (role) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.sig`;
const KEY = jwt("service_role");

export function fakeSupabase() {
  const tables = {};
  const calls = [];
  const faults = []; // { method, table, drop: true } (connection lost after the write) | { status }
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    const table = u.pathname.replace("/rest/v1/", "");
    const rows = (tables[table] ||= []);
    calls.push({ method: init.method, table, url: u, headers: init.headers });
    if (init.headers.apikey !== KEY) return json({ code: "42501", message: "permission denied" }, 401);
    const fault = faults.findIndex((f) => (!f.method || f.method === init.method) && (!f.table || f.table === table));
    const f = fault >= 0 ? faults.splice(fault, 1)[0] : null;
    if (f?.status) return json({ message: "unavailable" }, f.status);
    const filters = [...u.searchParams].filter(([k]) => !["select", "order", "limit", "offset", "on_conflict"].includes(k));
    const match = (r) => filters.every(([k, v]) => v.startsWith("eq.") && String(r[k] ?? "") === v.slice(3));
    let out;
    if (init.method === "GET") {
      const offset = Number(u.searchParams.get("offset") || 0), limit = Number(u.searchParams.get("limit") || 1000);
      out = json(rows.filter(match).sort((a, b) => a.id.localeCompare(b.id)).slice(offset, offset + limit));
    } else if (init.method === "POST") {
      const body = JSON.parse(init.body);
      const ignore = (init.headers.prefer || "").includes("ignore-duplicates");
      if (!ignore && body.some((r) => rows.some((x) => x.id === r.id))) return json({ code: "23505", message: "duplicate key" }, 409);
      const added = body.filter((r) => !rows.some((x) => x.id === r.id));
      rows.push(...structuredClone(added));
      out = json(added, 201);
    } else if (init.method === "PATCH") {
      const body = JSON.parse(init.body);
      const hit = rows.filter(match);
      for (const r of hit) Object.assign(r, structuredClone(body));
      out = json(hit);
    }
    if (f?.drop) throw new TypeError("fetch failed"); // the write happened, the reply was lost
    return out;
  };
  return { tables, calls, faults, fetchImpl };
}

const storeOn = (fake) => createSupabaseStore({ url: "https://abc.supabase.co", serviceKey: KEY, fetchImpl: fake.fetchImpl, baseDelayMs: 1, log: { error() {} } });

test("config: Supabase needs a URL and the service-role key, never a public key", () => {
  const base = { CMS_STORE: "supabase", CMS_DEV_LOGIN: "true", SUPABASE_URL: "https://abc.supabase.co" };
  assert.deepEqual(loadConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: KEY }).errors, []);
  assert.deepEqual(loadConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc" }).errors, []);
  assert.ok(loadConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: jwt("anon") }).errors.some((e) => e.includes('"anon" role')));
  assert.ok(loadConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_abc" }).errors.some((e) => e.includes("publishable")));
  assert.ok(loadConfig({ ...base, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: KEY }).errors.some((e) => e.includes("SUPABASE_URL")));
  // SUPABASE_SECRET_KEY (sb_secret_…) is the current name; the legacy name is read only when it is unset
  const secret = loadConfig({ ...base, SUPABASE_SECRET_KEY: " sb_secret_new\n", SUPABASE_SERVICE_ROLE_KEY: KEY });
  assert.deepEqual([secret.errors, secret.supabaseKeyVar, secret.supabaseServiceKey], [[], "SUPABASE_SECRET_KEY", "sb_secret_new"]);
  assert.equal(loadConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: KEY }).supabaseKeyVar, "SUPABASE_SERVICE_ROLE_KEY");
  assert.ok(loadConfig(base).errors.some((e) => e.startsWith("SUPABASE_SECRET_KEY is required")));
  assert.ok(loadConfig({ ...base, SUPABASE_SECRET_KEY: "sb_publishable_abc" }).errors.some((e) => e.startsWith("SUPABASE_SECRET_KEY is a publishable key")));
  assert.equal(supabaseKeyKind("sb_secret_abc"), "secret");
  assert.equal(supabaseKeyKind(KEY), "service_role");
  // The Google settings are still read with the Supabase store (Sheets integration kept)
  const cfg = loadConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: KEY, GOOGLE_SHEETS_SPREADSHEET_ID: "sheet", GOOGLE_SERVICE_ACCOUNT_EMAIL: "sa@x.iam", GOOGLE_PRIVATE_KEY: "k\\nk", GOOGLE_OAUTH_CLIENT_ID: "cid" });
  assert.deepEqual([cfg.spreadsheetId, cfg.clientEmail, cfg.privateKey, cfg.oauthClientId], ["sheet", "sa@x.iam", "k\nk", "cid"]);
});

test("records map to typed columns plus a fields bag, and back unchanged", () => {
  const rec = { id: "prg_1", slug: "a", status: "draft", version: 2, write_id: "w1", created_at: "2026-10-01T00:00:00.000Z", published_at: "", published_version: "", deleted_at: "", title: "T", tags: ["ai"], body_html: "<p>x</p>" };
  const row = encodeRecord("programs", rec);
  assert.deepEqual([row.published_at, row.published_version, row.deleted_at, row.fields], [null, null, null, { title: "T", tags: ["ai"], body_html: "<p>x</p>" }]);
  assert.equal("title" in row, false);
  const back = decodeRow("programs", { ...row, created_at: "2026-10-01T00:00:00+00:00", previous_slugs: "" });
  assert.deepEqual(back, { ...rec, published_version: null, previous_slugs: "" }, "timestamps come back in the same ISO form");
  assert.deepEqual(encodeRecord("audit_log", { id: "a", version: "", detail: "d", extra: 1 }), { id: "a", version: null, detail: "d" }, "system tables keep only their columns");
});

test("store: concurrency, duplicate-safe inserts, retries and errors", async () => {
  const fake = fakeSupabase();
  const store = storeOn(fake);
  const saved = await store.insert("tags", { id: "ai", label: "AI", archived: false, version: 1, write_id: "w1" });
  assert.equal(saved.label, "AI");
  assert.equal(fake.calls[0].headers.authorization, `Bearer ${KEY}`);
  await assert.rejects(store.insert("tags", { id: "ai", label: "Again", write_id: "w9" }), (e) => e.status === 409 && e.code === "duplicate_id");

  // Optimistic concurrency is one filtered UPDATE
  assert.equal((await store.update("tags", "ai", { id: "ai", label: "AI 2", write_id: "w2" }, { expectWriteId: "w1" })).label, "AI 2");
  await assert.rejects(store.update("tags", "ai", { id: "ai", label: "Stale", write_id: "w3" }, { expectWriteId: "w1" }), (e) => e.status === 409 && e.code === "conflict" && e.details.current.label === "AI 2");
  await assert.rejects(store.update("tags", "nope", { id: "nope", write_id: "w" }, { expectWriteId: "w" }), (e) => e.status === 404);

  // A dropped reply after the write landed: no duplicate, no false error
  fake.faults.push({ method: "POST", table: "cms_tags", drop: true });
  assert.equal((await store.insert("tags", { id: "faith", label: "Faith", write_id: "wf" })).label, "Faith");
  assert.equal(fake.tables.cms_tags.filter((r) => r.id === "faith").length, 1);
  fake.faults.push({ method: "PATCH", drop: true });
  assert.equal((await store.update("tags", "faith", { id: "faith", label: "Faith 2", write_id: "wf2" }, { expectWriteId: "wf" })).label, "Faith 2", "a retried update recognises its own write");
  fake.faults.push({ method: "POST", table: "cms_audit_log", drop: true });
  await store.appendLog("audit_log", { id: "aud_1", at: "2026-10-20T00:00:00.000Z", action: "x" });
  assert.equal(fake.tables.cms_audit_log.length, 1);

  // Transient errors are retried for reads; persistent ones are reported, never hidden
  fake.faults.push({ method: "GET", status: 503 });
  assert.equal((await store.list("tags")).length, 2);
  for (let i = 0; i < 4; i++) fake.faults.push({ method: "GET", status: 503 });
  await assert.rejects(store.list("tags"), (e) => e.status === 503 && e.code === "db_unavailable");
  const bad = createSupabaseStore({ url: "https://abc.supabase.co", serviceKey: jwt("anon"), fetchImpl: fake.fetchImpl, log: { error() {} } });
  await assert.rejects(bad.list("programs"), (e) => e.code === "db_forbidden");

  // Import adds only missing rows and never changes existing ones
  const r = await store.importMissing("tags", [{ id: "ai", label: "Seed AI", write_id: "seed" }, { id: "new", label: "New", write_id: "n" }]);
  assert.deepEqual([r.added, r.present, r.edited], [["new"], ["ai"], ["ai"]]);
  assert.equal((await store.get("tags", "ai")).label, "AI 2");
});

test("the CMS runs on the Supabase store: create, edit, publish, unpublish, history and audit", async () => {
  const fake = fakeSupabase();
  const store = storeOn(fake);
  const seed = (await import("../fixtures/seed.json", { with: { type: "json" } })).default;
  for (const tab of ["users", "tags", "settings", "published"]) await store.importMissing(tab, seed[tab]);
  const t = testApp({ store });
  const u = await signedIn(t.app);
  const created = await u.author.post("/api/records/resources", { data: article() });
  assert.equal(created.status, 201);
  const id = created.data.record.id;
  assert.equal(fake.tables.cms_resources[0].fields.title, "Testing the CMS");
  const pub = await u.author.post(`/api/records/resources/${id}/actions/publish`, { version: created.data.record.version });
  assert.equal(pub.status, 200, JSON.stringify(pub.data));
  assert.ok((await u.author.get("/api/public/content")).data.resources.some((x) => x.id === id));
  assert.equal((await u.author2.post(`/api/records/resources/${id}/actions/unpublish`, { version: pub.data.record.version })).status, 403, "another author cannot unpublish it");
  const un = await u.super.post(`/api/records/resources/${id}/actions/unpublish`, { version: pub.data.record.version });
  assert.equal(un.status, 200);
  assert.equal(fake.tables.cms_published.find((p) => p.record_id === id).state, "unpublished");
  assert.deepEqual((await u.author.get(`/api/records/resources/${id}/history`)).data.map((h) => h.kind).sort(), ["create", "publish", "unpublish"]);
  assert.ok((await u.super.get("/api/audit")).data.some((a) => a.action === "publish" && a.record_id === id));
  assert.equal((await u.author.get("/api/audit")).status, 403);
  t.cleanup();
});

test("store: a secret key (sb_secret_…) goes only in the apikey header, never as a Bearer token", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push(init.headers); return new Response("[]", { status: 200 }); };
  await createSupabaseStore({ url: "https://abc.supabase.co", serviceKey: "sb_secret_abc", fetchImpl, log: { error() {} } }).list("tags");
  assert.equal(seen[0].apikey, "sb_secret_abc");
  assert.equal("authorization" in seen[0], false);
});
