// Google Sheets adapter against an in-memory fake of the Sheets REST API (v4): token
// exchange, values.batchGet/get/update/append. Exercises row lookup by id, header-name
// mapping, long-value chunking, RAW writes, retries, duplicate-safe appends and conflicts.
// This verifies the adapter's logic; it is not a substitute for a test against real Google.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { createSheetsApi } from "../server/store/sheets-api.mjs";
import { createSheetsStore } from "../server/store/sheets-store.mjs";
import { columnsFor, ALL_TABS } from "../shared/schema.mjs";
import { columnLetter, CHUNK } from "../server/store/codec.mjs";
import { testApp, signedIn, article } from "./helpers.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });

function letterIndex(s) { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

export function fakeGoogle({ shuffle = false } = {}) {
  const sheets = {};
  for (const tab of ALL_TABS) {
    const cols = columnsFor(tab);
    sheets[tab] = [shuffle ? [...cols].reverse().concat(["notes"]) : cols];
  }
  const calls = [];
  const faults = []; // queue of { match, status | throw | after }
  const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...headers } });
  const parseRange = (r) => {
    const m = decodeURIComponent(r).match(/^'((?:[^']|'')+)'(?:!(.*))?$/);
    return { tab: m[1].replace(/''/g, "'"), a1: m[2] || "" };
  };
  const read = (range) => {
    const { tab, a1 } = parseRange(range);
    const rows = sheets[tab];
    if (!a1) return rows;
    let m = a1.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (m) {
      const [c1, r1, c2, r2] = [letterIndex(m[1]), +m[2], letterIndex(m[3]), +m[4]];
      return rows.slice(r1 - 1, r2).map((row) => (row || []).slice(c1, c2 + 1));
    }
    m = a1.match(/^([A-Z]+):([A-Z]+)$/);
    if (m) return rows.map((row) => [(row || [])[letterIndex(m[1])] ?? ""]);
    m = a1.match(/^(\d+):(\d+)$/);
    if (m) return rows.slice(+m[1] - 1, +m[2]);
    return rows;
  };
  async function fetchImpl(url, init = {}) {
    url = String(url);
    calls.push({ url, method: init.method || "GET", body: init.body });
    const f = faults.findIndex((x) => url.includes(x.match) && (!x.method || x.method === (init.method || "GET")));
    if (f >= 0) {
      const fault = faults.splice(f, 1)[0];
      if (fault.throw && !fault.after) throw new Error("network down");
      if (fault.status) return json({ error: { code: fault.status } }, fault.status, fault.headers);
      if (fault.after) { const res = await handle(url, init); throw new Error("connection reset after write " + res.status); }
    }
    return handle(url, init);
  }
  async function handle(url, init) {
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const assertion = new URLSearchParams(String(init.body)).get("assertion");
      const [h, c, s] = assertion.split(".");
      const ok = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"));
      if (!ok) return json({ error: "invalid_grant" }, 400);
      return json({ access_token: "tok", expires_in: 3600 });
    }
    if (init.headers?.authorization !== "Bearer tok") return json({ error: "unauthenticated" }, 401);
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    if (path.endsWith("/values:batchGet")) {
      return json({ valueRanges: u.searchParams.getAll("ranges").map((r) => ({ range: r, values: read(r) })) });
    }
    const m = path.match(/\/values\/(.+?)(:append)?$/);
    if (m && (init.method || "GET") === "GET") return json({ values: read(m[1]) });
    if (m && init.method === "PUT") {
      assert.equal(u.searchParams.get("valueInputOption"), "RAW");
      const { tab, a1 } = parseRange(m[1]);
      const row = +a1.match(/^[A-Z]+(\d+)/)[1];
      const body = JSON.parse(init.body);
      sheets[tab][row - 1] = body.values[0];
      return json({ updatedRows: 1 });
    }
    if (m && m[2] && init.method === "POST") {
      assert.equal(u.searchParams.get("valueInputOption"), "RAW");
      const { tab } = parseRange(m[1]);
      for (const v of JSON.parse(init.body).values) sheets[tab].push(v);
      return json({ updates: { updatedRange: `${tab}!A${sheets[tab].length}` } });
    }
    return json({ error: "not found" }, 404);
  }
  return { sheets, calls, faults, fetchImpl };
}

function makeStore(g, opts = {}) {
  const api = createSheetsApi({ spreadsheetId: "sheet123", clientEmail: "cms@project.iam.gserviceaccount.com", privateKey, fetchImpl: g.fetchImpl, baseDelayMs: 1, log: { error() {} }, ...opts });
  return createSheetsStore(api, { cacheMs: 0 });
}

const sample = (over = {}) => ({ id: "res_1", status: "draft", version: 1, write_id: "w1", title: "=HYPERLINK(\"x\")", slug: "a", tags: ["ai", "business"], featured: true, sort_order: 5, body_html: "<p>x</p>", cover_image_meta: { base: "assets/images/a", widths: [480] }, ...over });

test("insert, read back, update: values round-trip through header-mapped columns", async () => {
  const g = fakeGoogle({ shuffle: true });
  const store = makeStore(g);
  await store.insert("resources", sample());
  const got = await store.get("resources", "res_1");
  assert.equal(got.title, '=HYPERLINK("x")', "formula-like text is stored as text");
  assert.deepEqual(got.tags, ["ai", "business"]);
  assert.equal(got.featured, true);
  assert.equal(got.sort_order, 5);
  assert.deepEqual(got.cover_image_meta, { base: "assets/images/a", widths: [480] });
  // a hand-added "notes" column survives updates
  const notesCol = g.sheets.resources[0].indexOf("notes");
  g.sheets.resources[1][notesCol] = "kept by hand";
  await store.update("resources", "res_1", { ...got, title: "New", write_id: "w2", version: 2 }, { expectWriteId: "w1" });
  assert.equal((await store.get("resources", "res_1")).title, "New");
  assert.equal(g.sheets.resources[1][notesCol], "kept by hand");
});

test("long HTML is split across overflow cells and reassembled", async () => {
  const g = fakeGoogle();
  const store = makeStore(g);
  const big = "<p>" + "x".repeat(CHUNK * 2 + 100) + "</p>";
  await store.insert("resources", sample({ body_html: big }));
  const header = g.sheets.resources[0];
  assert.ok(g.sheets.resources[1][header.indexOf("body_html__3")].length > 0);
  for (const cell of g.sheets.resources[1]) assert.ok(String(cell).length <= 50000, "no cell over the Sheets limit");
  assert.equal((await store.get("resources", "res_1")).body_html, big);
  await assert.rejects(store.insert("resources", sample({ id: "res_2", write_id: "w9", body_html: "y".repeat(CHUNK * 7) })), /too long/);
});

test("rows are found by id even after manual re-sorting", async () => {
  const g = fakeGoogle();
  const store = makeStore(g);
  await store.insert("resources", sample({ id: "res_a", write_id: "a" }));
  await store.insert("resources", sample({ id: "res_b", write_id: "b", slug: "b" }));
  const [head, a, b] = g.sheets.resources;
  g.sheets.resources = [head, b, a]; // someone sorted the tab
  g.sheets.resources.length = 3;
  const rec = await store.get("resources", "res_a");
  await store.update("resources", "res_a", { ...rec, title: "Updated A", write_id: "a2" }, { expectWriteId: "a" });
  assert.equal((await store.get("resources", "res_a")).title, "Updated A");
  assert.equal((await store.get("resources", "res_b")).title, '=HYPERLINK("x")');
});

test("stale write_id is a conflict; nothing is written", async () => {
  const g = fakeGoogle();
  const store = makeStore(g);
  await store.insert("resources", sample());
  const puts = () => g.calls.filter((c) => c.method === "PUT").length;
  const before = puts();
  await assert.rejects(store.update("resources", "res_1", sample({ write_id: "w3" }), { expectWriteId: "stale" }), (e) => e.status === 409);
  assert.equal(puts(), before);
});

test("transient errors are retried with backoff; persistent ones surface as 503", async () => {
  const g = fakeGoogle();
  const store = makeStore(g);
  g.faults.push({ match: "values:batchGet", status: 429, headers: { "retry-after": "0" } }, { match: "values:batchGet", status: 503 });
  assert.deepEqual(await store.list("resources"), []);
  for (let i = 0; i < 4; i++) g.faults.push({ match: "values:batchGet", status: 500 });
  await assert.rejects(store.list("resources"), (e) => e.status === 503 && e.code === "google_unavailable");
  for (let i = 0; i < 4; i++) g.faults.push({ match: "values:batchGet", status: 429 });
  await assert.rejects(store.list("resources"), (e) => e.status === 429 && /rate limit/.test(e.message));
});

test("an append that landed but whose response was lost is not duplicated", async () => {
  const g = fakeGoogle();
  const store = makeStore(g);
  g.faults.push({ match: ":append", after: true });
  await store.insert("resources", sample());
  assert.equal(g.sheets.resources.length, 2, "exactly one data row");
  g.faults.push({ match: ":append", throw: true }); // failed before reaching Google: retried once
  await store.insert("resources", sample({ id: "res_2", write_id: "w2", slug: "b" }));
  assert.equal(g.sheets.resources.length, 3);
});

test("duplicate ids and missing columns are reported clearly", async () => {
  const g = fakeGoogle();
  const store = makeStore(g);
  await store.insert("resources", sample());
  await assert.rejects(store.insert("resources", sample()), (e) => e.status === 409);
  g.sheets.resources.push([...g.sheets.resources[1]]);
  await assert.rejects(store.get("resources", "res_1"), /share the id/);
  g.sheets.tags[0] = ["id", "label"];
  await assert.rejects(store.list("tags"), /missing columns/);
});

test("access problems give actionable messages", async () => {
  const g = fakeGoogle();
  const store = makeStore(g);
  g.faults.push({ match: "values:batchGet", status: 403 });
  await assert.rejects(store.list("tags"), /Share it with the service account/);
  const bad = createSheetsStore(createSheetsApi({ spreadsheetId: "s", clientEmail: "x", privateKey: "not a key", fetchImpl: g.fetchImpl, log: { error() {} } }));
  await assert.rejects(bad.list("tags"), /private key could not be read/);
});

test("full CMS flow on the Sheets adapter: create, approve, publish, public content", async () => {
  const g = fakeGoogle();
  // Seed the users and settings the app needs.
  const store = makeStore(g);
  const seed = (await import("../fixtures/seed.json", { with: { type: "json" } })).default;
  for (const u of seed.users) await store.insert("users", u);
  await store.insert("settings", seed.settings[0]);
  await store.insert("published", seed.published[0]);
  for (const t of seed.tags) await store.insert("tags", t);
  const t = testApp({ store });
  const u = await signedIn(t.app);
  let r = (await u.author.post("/api/records/resources", { data: article() })).data.record;
  assert.ok(r.id);
  r = (await u.main.post(`/api/records/resources/${r.id}/actions/approve`, { version: r.version })).data.record;
  const pub = await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  assert.equal(pub.status, 200, JSON.stringify(pub.data));
  const content = (await u.author.get("/api/public/content")).data;
  assert.equal(content.resources[0].title, "Testing the CMS");
  const audit = await store.list("audit_log");
  assert.ok(audit.some((a) => a.action === "publish"));
  const history = await store.list("history");
  assert.ok(history.some((h) => h.kind === "publish" && h.data.title === "Testing the CMS"));
  t.cleanup();
});
