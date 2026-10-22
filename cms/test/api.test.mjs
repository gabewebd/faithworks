// End-to-end API tests on the JSON store: roles, publishing, visibility, concurrency, public output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { testApp, signedIn, client, article, USERS } from "./helpers.mjs";
import { loadConfig } from "../server/config.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function setup() {
  const t = testApp();
  const u = await signedIn(t.app);
  return { ...t, u };
}
const rec = (r) => r.data.record;

test("configuration fails closed on hosted deployments", () => {
  const cfg = loadConfig({ VERCEL: "1", CMS_DEV_LOGIN: "true" });
  assert.ok(cfg.errors.some((e) => e.includes("CMS_SESSION_SECRET")));
  assert.equal(cfg.store, "supabase", "hosted deployments store content in Supabase by default");
  assert.ok(cfg.errors.some((e) => e.includes("SUPABASE_URL")));
  assert.ok(cfg.errors.some((e) => e.includes("SUPABASE_SECRET_KEY")));
  assert.ok(cfg.errors.some((e) => e.includes("CMS_DEV_LOGIN cannot be enabled")));
  assert.equal(cfg.devLogin, false);
  assert.ok(loadConfig({ NETLIFY: "true", CMS_STORE: "json" }).errors.some((e) => e.includes("must use the Supabase store")));
  assert.ok(loadConfig({ NETLIFY: "true", CMS_STORE: "sheets" }).errors.some((e) => e.includes("GOOGLE_SHEETS_SPREADSHEET_ID")), "the Sheets store (rollback) still needs its settings");
});

test("misconfigured deployment refuses every API call except health", async () => {
  const t = testApp({ env: { CMS_DEV_LOGIN: "false" } });
  const c = client(t.app, USERS.super);
  assert.equal((await c.get("/api/health")).status, 200);
  const r = await c.get("/api/records/programs");
  assert.equal(r.status, 503);
  assert.equal(r.data.error.code, "misconfigured");
  t.cleanup();
});

test("authentication and CSRF are enforced", async () => {
  const { app, cleanup } = testApp();
  const anon = client(app, "nobody@example.test");
  assert.equal((await anon.get("/api/records/programs")).status, 401);
  assert.equal((await anon.post("/api/auth/dev-login", { email: "stranger@example.test" })).status, 403, "unknown users cannot sign in");
  const author = await client(app, USERS.author).login();
  const noCsrf = await author.call("POST", "/api/records/resources", { data: article() }, { "x-cms-csrf": "" });
  assert.equal(noCsrf.status, 403);
  const crossSite = await author.call("POST", "/api/records/resources", { data: article() }, { origin: "https://evil.example" });
  assert.equal(crossSite.status, 403);
  const res = await author.get("/api/records/programs");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
  cleanup();
});

test("dev login only works on localhost", async () => {
  const { app, cleanup } = testApp();
  const res = await app.handle(new Request("http://cms.example.com/api/auth/dev-login", { method: "POST", headers: { "content-type": "application/json", "x-cms-csrf": "1", origin: "http://cms.example.com" }, body: JSON.stringify({ email: USERS.super }) }));
  assert.equal(res.status, 404);
  cleanup();
});

test("authors edit and publish their own content; nobody skips the version check", async () => {
  const { u, cleanup } = await setup();
  const created = await u.author.post("/api/records/resources", { data: article({ summary: "" }) });
  assert.equal(created.status, 201);
  const r = rec(created);
  assert.equal(r.created_by, USERS.author);
  assert.deepEqual(r.authors, [USERS.author], "the creator is the first author");
  // Publishing checks the required fields
  const bad = await u.author.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  assert.equal(bad.status, 422);
  assert.ok(bad.data.error.errors.summary);
  assert.equal((await u.author.put(`/api/records/resources/${r.id}`, { version: 99, data: article() })).status, 409, "stale version");
  const ed = await u.author.put(`/api/records/resources/${r.id}`, { version: r.version, data: article() });
  assert.equal(ed.status, 200, "the author edits their own draft");
  const pub = await u.author.post(`/api/records/resources/${r.id}/actions/publish`, { version: rec(ed).version });
  assert.equal(pub.status, 200, "authors publish their own content");
  assert.equal(rec(pub).status, "published");
  const un = await u.author.post(`/api/records/resources/${r.id}/actions/unpublish`, { version: rec(pub).version });
  assert.equal(un.status, 200, "and unpublish it");
  assert.equal(un.data.live, null);
  assert.equal(rec(un).status, "draft", "an unpublished item is a draft again");
  // Super Admin only: deleting and managing the CMS
  assert.equal((await u.author.post(`/api/records/resources/${r.id}/actions/delete`, { version: rec(un).version })).status, 403);
  assert.equal((await u.author.get("/api/users")).status, 403);
  assert.equal((await u.author.get("/api/records/settings/site")).status, 403);
  cleanup();
});

test("authors cannot change another author's content, even with direct requests", async () => {
  const { u, cleanup } = await setup();
  let r = rec(await u.author.post("/api/records/resources", { data: article() }));
  const other = u.author2;
  const view = (await other.get(`/api/records/resources/${r.id}`)).data;
  assert.equal(view.can_edit, false, "others may read it, not edit it");
  assert.deepEqual(view.actions, [], "and get no workflow actions");
  assert.equal((await other.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ summary: "Taken over" }) })).status, 403);
  assert.equal((await other.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ authors: [USERS.author, USERS.author2] }) })).status, 403, "cannot add themselves as an author");
  for (const a of ["archive", "delete"]) {
    assert.equal((await other.post(`/api/records/resources/${r.id}/actions/${a}`, { version: r.version })).status, 403, a);
  }
  assert.equal((await other.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version })).status, 403, "cannot publish it");
  r = rec(await u.author.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version }));
  assert.equal((await other.post(`/api/records/resources/${r.id}/actions/unpublish`, { version: r.version })).status, 403, "cannot unpublish it");
  assert.equal((await other.post(`/api/records/resources/${r.id}/actions/reconcile`, {})).status, 403, "cannot finish publishing it");
  const hist = (await other.get(`/api/records/resources/${r.id}/history`)).data;
  assert.equal((await other.post(`/api/records/resources/${r.id}/history/${hist[0].id}/restore`, { version: r.version })).status, 403, "cannot restore a version");
  // Imported content (created by the importer, no authors) belongs to Super Admins
  const prog = (await u.author.get("/api/records/programs")).data[0];
  assert.equal(prog.can_edit, false);
  const pv = (await u.super.get(`/api/records/programs/${prog.id}`)).data;
  assert.equal(pv.can_edit, true, "Super Admins edit any content");
  // A Super Admin can edit and delete an Author's item
  const sv = await u.super.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ summary: "Edited by the Super Admin" }) });
  assert.equal(sv.status, 200);
  assert.equal((await u.super.post(`/api/records/resources/${r.id}/actions/delete`, { version: rec(sv).version })).status, 200);
  cleanup();
});

test("co-authors share an item; only its creator or a Super Admin removes someone else", async () => {
  const { u, cleanup } = await setup();
  let r = rec(await u.author.post("/api/records/resources", { data: article({ authors: [USERS.author, USERS.author2] }) }));
  r = rec(await u.author2.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ authors: [USERS.author, USERS.author2], summary: "Co-written" }) }));
  assert.equal(r.summary, "Co-written", "a listed author edits");
  const drop = await u.author2.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ authors: [USERS.author2] }) });
  assert.equal(drop.status, 422, "a co-author cannot remove another author");
  assert.match(drop.data.error.errors.authors, /Super Admin/);
  r = rec(await u.author2.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ authors: [USERS.author] }) }));
  assert.deepEqual(r.authors, [USERS.author], "they can take themselves off");
  assert.equal((await u.author2.put(`/api/records/resources/${r.id}`, { version: r.version, data: article() })).status, 403, "and then lose access");
  const sa = await u.super.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ authors: [USERS.author2] }) });
  assert.equal(sa.status, 200, "Super Admins reassign authors");
  const own = await u.author.put(`/api/records/resources/${r.id}`, { version: rec(sa).version, data: article({ authors: [USERS.author] }) });
  assert.equal(own.status, 200, "the creator keeps access and manages the authors list");
  assert.deepEqual(rec(own).authors, [USERS.author]);
  cleanup();
});

test("authors cannot open or use Super Admin features through the API", async () => {
  const { u, cleanup } = await setup();
  const a = u.author;
  assert.equal((await a.get("/api/audit")).status, 403);
  assert.equal((await a.get("/api/recovery")).status, 403);
  assert.equal((await a.get("/api/backup")).status, 403);
  assert.equal((await a.post("/api/deploy", {})).status, 403);
  assert.equal((await a.post("/api/tags", { label: "Mine" })).status, 403);
  assert.equal((await a.put("/api/tags/ai", { label: "Renamed" })).status, 403);
  assert.equal((await a.put("/api/records/settings/site", { version: 1, data: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await a.post("/api/records/settings/site/actions/publish", { version: 1 })).status, 403);
  const created = await a.post("/api/records/resources", { data: article({ slug: "planned-item" }), status: "needed" });
  assert.equal(rec(created).status, "draft", "new items are always drafts");
  await u.super.post("/api/records/resources", { data: article({ slug: "admin-item" }) });
  const dash = (await a.get("/api/dashboard")).data;
  assert.ok(dash.recent.length, "Authors see their own recent activity");
  assert.ok(dash.recent.every((x) => x.actor === USERS.author), "and only their own");
  assert.ok((await u.super.get("/api/dashboard")).data.recent.some((x) => x.actor === USERS.author), "Super Admins see everyone's");
  cleanup();
});

test("publishing is one step with no approval; the live copy is separate from draft edits", async () => {
  const { u, cleanup } = await setup();
  let r = rec(await u.author.post("/api/records/resources", { data: article() }));
  for (const old of ["submit", "approve", "withdraw", "request_changes", "reject"]) {
    assert.equal((await u.super.post(`/api/records/resources/${r.id}/actions/${old}`, { version: r.version })).status, 404, `no ${old} action`);
  }
  const view = (await u.author.get(`/api/records/resources/${r.id}`)).data;
  assert.deepEqual(view.actions.sort(), ["archive", "publish"], "a draft can be published or archived by its author");
  const pub = await u.author.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  assert.equal(pub.status, 200);
  assert.equal(rec(pub).status, "published");
  assert.equal(pub.data.live.version, rec(pub).version);
  assert.equal(pub.data.deploy.triggered, false, "no hook configured");
  assert.equal((await u.author.post(`/api/records/resources/${r.id}/actions/publish`, { version: rec(pub).version })).status, 409, "nothing to publish twice");
  for (const k of ["approved_at", "approved_by", "approved_version", "submitted_at", "reviewed_by", "review_note"]) assert.ok(!(k in rec(pub)), `no ${k} column`);

  let content = (await u.author.get("/api/public/content")).data;
  assert.equal(content.view, "published");
  assert.equal(content.resources.find((x) => x.id === r.id).summary, "A test article.");

  // Editing the live item: back to draft, live copy unchanged
  const edited = await u.author.put(`/api/records/resources/${r.id}`, { version: rec(pub).version, data: article({ summary: "A draft change" }) });
  assert.equal(rec(edited).status, "draft");
  assert.equal(edited.data.draft_differs, true);
  content = (await u.author.get("/api/public/content")).data;
  const fresh = await u.super.get(`/api/records/resources/${r.id}`);
  assert.equal(fresh.data.live.version, rec(pub).version);
  assert.equal(content.resources.find((x) => x.id === r.id).summary, "A test article.");
  cleanup();
});

test("public content never includes drafts or internal fields", async () => {
  const { u, cleanup } = await setup();
  const content = (await u.author.get("/api/public/content")).data;
  assert.equal(content.programs.length, 0, "seeded programs are drafts");
  assert.equal(content.testimonials.length, 0, "seeded testimonials are drafts");
  assert.ok(content.settings.origin);
  const body = JSON.stringify(content);
  for (const secret of ["content_owner", "consent_evidence", "review_note", "created_by", "example.test", "assigned_to", "attribution"]) assert.ok(!body.includes(secret), `leaked ${secret}`);
  cleanup();
});

test("preview endpoint needs the preview token and returns working copies", async () => {
  const { u, cleanup } = await setup();
  assert.equal((await u.author.get("/api/public/preview")).status, 401);
  assert.equal((await u.author.get("/api/public/preview", { authorization: "Bearer wrong" })).status, 401);
  const ok = await u.author.get("/api/public/preview", { authorization: `Bearer ${"p".repeat(40)}` });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.view, "preview");
  assert.equal(ok.data.programs.length, 4);
  assert.ok(!JSON.stringify(ok.data).includes("consent_evidence"));
  cleanup();
});

test("concurrent edits are detected (version check)", async () => {
  const { u, cleanup } = await setup();
  const r = rec(await u.author.post("/api/records/resources", { data: article() }));
  const a = await u.author.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ summary: "Author" }) });
  assert.equal(a.status, 200);
  const b = await u.super.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ summary: "Super Admin" }) });
  assert.equal(b.status, 409);
  assert.equal(b.data.error.code, "conflict");
  assert.equal(b.data.error.current.updated_by, USERS.author);
  cleanup();
});

test("slugs: format, duplicates and live slug changes", async () => {
  const { u, cleanup } = await setup();
  const dup = await u.author.post("/api/records/resources", { data: article({ slug: "from-learning-to-doing" }) });
  assert.equal(dup.status, 422);
  assert.match(dup.data.error.errors.slug, /already used/);
  assert.equal((await u.author.post("/api/records/resources", { data: article({ slug: "Bad Slug!" }) })).status, 422);

  let r = rec(await u.super.post("/api/records/resources", { data: article() }));
  r = rec(await u.super.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version }));
  const needsConfirm = await u.super.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ slug: "renamed-article" }) });
  assert.equal(needsConfirm.status, 409);
  assert.equal(needsConfirm.data.error.code, "slug_change_confirm");
  r = rec(await u.super.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ slug: "renamed-article" }), confirmSlugChange: true }));
  r = rec(await u.super.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version }));
  const content = (await u.author.get("/api/public/content")).data;
  assert.deepEqual(content.redirects, [{ from: "/resources/testing-the-cms/", to: "/resources/renamed-article/" }]);
  // The old slug stays reserved for the redirect
  assert.equal((await u.author.post("/api/records/resources", { data: article({ slug: "testing-the-cms" }) })).status, 422);
  cleanup();
});

test("testimonials: quote, name, optional role and photo, and a visibility switch; no card colour", async () => {
  const { u, cleanup } = await setup();
  const data = { quote: "It helped my whole team.", display_name: "Ana Cruz", role: "HR Manager", visible: true };
  let t = rec(await u.author.post("/api/records/testimonials", { data }));
  assert.equal(t.featured_image_url, "", "the photo is optional");
  assert.equal(t.status, "draft");
  for (const gone of ["consent_status", "display_approved", "attribution", "role_org", "kind", "body_html"]) assert.ok(!(gone in t), `no ${gone}`);
  assert.ok(!("tone" in t), "card colours are not stored");
  const coloured = rec(await u.author.post("/api/records/testimonials", { data: { ...data, tone: "neon" } }));
  assert.ok(!("tone" in coloured), "a card colour sent by a client is dropped, not saved");
  assert.equal((await u.author.post("/api/records/testimonials", { data: { ...data, role: "x".repeat(121) } })).status, 422, "role has a length limit");
  t = rec(await u.author.post(`/api/records/testimonials/${t.id}/actions/publish`, { version: t.version }));
  let pub = (await u.author.get("/api/public/content")).data.testimonials.find((x) => x.id === t.id);
  assert.deepEqual([pub.quote, pub.display_name, pub.role, pub.visible, pub.featured_image_url], ["It helped my whole team.", "Ana Cruz", "HR Manager", true, ""]);
  assert.ok(!("tone" in pub), "no card colour in the public content");
  assert.equal(pub.authors, undefined, "owners stay internal");

  // Photo and role change; hide it: still saved in the CMS, off the website
  t = rec(await u.author.put(`/api/records/testimonials/${t.id}`, { version: t.version, data: { ...data, role: "", featured_image_url: "/assets/images/ana.jpg", visible: false } }));
  t = rec(await u.author.post(`/api/records/testimonials/${t.id}/actions/publish`, { version: t.version }));
  let content = (await u.author.get("/api/public/content")).data;
  assert.ok(!content.testimonials.some((x) => x.id === t.id), "hidden testimonials are not public");
  const list = (await u.author.get("/api/records/testimonials?status=hidden")).data;
  assert.ok(list.some((x) => x.id === t.id && x.live.hidden), "and listed as hidden in the CMS");
  assert.equal((await u.author.get("/api/dashboard")).data.counts.testimonials.hidden, 1);
  // Show it again
  t = rec(await u.author.put(`/api/records/testimonials/${t.id}`, { version: t.version, data: { ...data, role: "", featured_image_url: "/assets/images/ana.jpg", visible: true } }));
  t = rec(await u.author.post(`/api/records/testimonials/${t.id}/actions/publish`, { version: t.version }));
  content = (await u.author.get("/api/public/content")).data;
  pub = content.testimonials.find((x) => x.id === t.id);
  assert.equal(pub.role, "", "the role is optional");
  assert.equal(pub.featured_image_url, "/assets/images/ana.jpg");
  // Another author cannot hide it
  assert.equal((await u.author2.put(`/api/records/testimonials/${t.id}`, { version: t.version, data: { ...data, visible: false } })).status, 403);
  cleanup();
});

test("site settings: Super Admins only, including launch and tracking fields", async () => {
  const { u, cleanup } = await setup();
  assert.equal((await u.author.get("/api/records/settings/site")).status, 403);
  const s = (await u.super.get("/api/records/settings/site")).data;
  const data = { ...s.record, contact_email: "hello@faithph.ai", ga4_id: "G-ABC1234" };
  const saved = rec(await u.super.put("/api/records/settings/site", { version: s.record.version, data }));
  assert.equal(saved.contact_email, "hello@faithph.ai");
  assert.equal(saved.ga4_id, "G-ABC1234", "Super Admins manage tracking IDs");
  const bad = await u.super.put("/api/records/settings/site", { version: saved.version, data: { ...saved, ga4_id: "<script>" } });
  assert.equal(bad.status, 422);
  cleanup();
});

test("users: only Super Admins manage people; two roles; nobody changes their own", async () => {
  const { u, cleanup } = await setup();
  assert.equal((await u.author.get("/api/users")).status, 403);
  assert.equal((await u.author.post("/api/users", { email: "x@example.test", role: "super_admin" })).status, 403);
  assert.equal((await u.author.post("/api/users", { email: USERS.author, role: "super_admin" })).status, 403, "an Author cannot promote themselves");
  assert.equal((await u.author.get("/api/session")).data.user.role, "author");
  for (const retired of ["main_admin", "publisher", "editor"]) {
    assert.equal((await u.super.post("/api/users", { email: "y@example.test", role: retired })).status, 422, `no ${retired} role`);
  }
  const created = await u.super.post("/api/users", { email: "New.Editor@Example.test", name: "New", role: "author" });
  assert.equal(created.status, 200);
  assert.equal(created.data.id, "new.editor@example.test");
  assert.equal((await u.super.post("/api/users", { email: USERS.super, role: "author" })).status, 409, "not your own role");
  const list = (await u.super.get("/api/users")).data;
  assert.deepEqual([...new Set(list.map((x) => x.role))].sort(), ["author", "super_admin"]);
  // Deactivating a user takes effect on their next request
  await u.super.post("/api/users", { email: USERS.author2, name: "Gone", role: "author", active: false });
  assert.equal((await u.author2.get("/api/dashboard")).status, 401);
  cleanup();
});

test("accounts saved with an unknown role cannot sign in and are flagged for review", async () => {
  const t = testApp();
  const stamp = "2026-10-01T00:00:00.000Z";
  const row = (id, role) => ({ id, email: id, name: id, role, active: true, version: 1, write_id: "w", created_at: stamp, created_by: "test", updated_at: stamp, updated_by: "test" });
  await t.app.store.insert("users", row("old.admin@example.test", "main_admin"));
  await t.app.store.insert("users", row("old.publisher@example.test", "publisher"));
  await t.app.store.insert("users", row("odd@example.test", "owner"));
  const sup = await client(t.app, USERS.super).login();
  for (const id of ["old.admin@example.test", "old.publisher@example.test", "odd@example.test"]) {
    assert.equal((await client(t.app, id).post("/api/auth/dev-login", { email: id })).status, 403, `${id} cannot sign in`);
  }
  const list = (await sup.get("/api/users")).data;
  const flagged = Object.fromEntries(list.filter((x) => x.needs_review).map((x) => [x.id, x.stored_role]));
  assert.deepEqual(flagged, { "old.admin@example.test": "main_admin", "old.publisher@example.test": "publisher", "odd@example.test": "owner" });
  const fixed = await sup.post("/api/users", { email: "old.admin@example.test", role: "super_admin", version: 1 });
  assert.equal(fixed.status, 200);
  assert.ok(!(await sup.get("/api/users")).data.find((x) => x.id === "old.admin@example.test").needs_review);
  t.cleanup();
});

test("archive, delete and recovery", async () => {
  const { u, cleanup } = await setup();
  let r = rec(await u.super.post("/api/records/resources", { data: article() }));
  r = rec(await u.super.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version }));
  assert.equal((await u.author.post(`/api/records/resources/${r.id}/actions/delete`, { version: r.version })).status, 403, "authors cannot delete");
  const del = await u.super.post(`/api/records/resources/${r.id}/actions/delete`, { version: r.version });
  assert.equal(del.status, 200);
  const content = (await u.author.get("/api/public/content")).data;
  assert.ok(!content.resources.some((x) => x.id === r.id), "deleted items are taken offline");
  assert.ok(!(await u.super.get("/api/records/resources")).data.some((x) => x.id === r.id));
  const recovery = (await u.super.get("/api/recovery")).data;
  assert.ok(recovery.deleted.some((x) => x.id === r.id));
  const un = await u.super.post(`/api/records/resources/${r.id}/actions/undelete`, { version: rec(del).version });
  assert.equal(un.status, 200);
  // Version history and restore
  const hist = (await u.super.get(`/api/records/resources/${r.id}/history`)).data;
  assert.ok(hist.length >= 3);
  const first = hist[hist.length - 1];
  const restored = await u.super.post(`/api/records/resources/${r.id}/history/${first.id}/restore`, { version: rec(un).version });
  assert.equal(restored.status, 200);
  const audit = (await u.super.get("/api/audit")).data;
  assert.ok(audit.some((a) => a.action === "delete" && a.record_id === r.id));
  cleanup();
});

const event = (over = {}) => ({ title: "AI Workshop", summary: "Hands-on.", event_date: "2099-03-14", start_time: "13:00", end_time: "17:00", time_zone: "Asia/Manila", venue: "Makati City", registration_type: "none", visible: true, ...over });

test("events: dates, time zone and the three registration destinations", async () => {
  const { u, cleanup } = await setup();
  assert.equal((await u.author.post("/api/records/events", { data: event({ start_time: "13:00", end_time: "12:00" }) })).status, 422, "end before start");
  for (const gone of ["related_program_id", "event_status", "delivery_format", "cta_type"]) assert.equal(rec(await u.author.post("/api/records/events", { data: event({ title: `No ${gone}`, [gone]: "x" }) }))[gone], undefined, `${gone} is not a field`);

  // External link (GHL): needs the URL, no page needed
  let ext = rec(await u.author.post("/api/records/events", { data: event({ title: "GHL event", registration_type: "external" }) }));
  const missing = await u.author.post(`/api/records/events/${ext.id}/actions/publish`, { version: ext.version });
  assert.equal(missing.status, 422);
  assert.ok(missing.data.error.errors.registration_url);
  ext = rec(await u.author.put(`/api/records/events/${ext.id}`, { version: ext.version, data: event({ title: "GHL event", registration_type: "external", registration_url: "https://faithph.ai/ghl-funnel" }) }));
  ext = rec(await u.author.post(`/api/records/events/${ext.id}/actions/publish`, { version: ext.version }));
  assert.equal(ext.body_html, "", "no page content is needed");

  // No registration link: informational, the URL is never kept
  let info = rec(await u.author.post("/api/records/events", { data: event({ title: "Community night", registration_url: "https://stale.example" }) }));
  assert.equal(info.registration_url, "");
  info = rec(await u.author.post(`/api/records/events/${info.id}/actions/publish`, { version: info.version }));

  // CMS event page: page content is required only for this option
  let pg = rec(await u.author.post("/api/records/events", { data: event({ title: "Masterclass", registration_type: "page" }) }));
  assert.equal(pg.slug, "masterclass");
  const empty = await u.author.post(`/api/records/events/${pg.id}/actions/publish`, { version: pg.version });
  assert.ok(empty.data.error.errors.body_html, "a CMS event page needs content");
  pg = rec(await u.author.put(`/api/records/events/${pg.id}`, { version: pg.version, data: event({ title: "Masterclass", registration_type: "page", slug: pg.slug, body_html: "<h1 data-cms-bind=\"title\">Masterclass</h1>", doc_version: 2 }) }));
  pg = rec(await u.author.post(`/api/records/events/${pg.id}/actions/publish`, { version: pg.version }));

  // Same title again (e.g. next month): a free address is chosen automatically
  assert.equal(rec(await u.author.post("/api/records/events", { data: event({ title: "Masterclass", event_date: "2099-04-11" }) })).slug, "masterclass-2");

  const content = (await u.author.get("/api/public/content")).data;
  const byTitle = Object.fromEntries(content.events.map((e) => [e.title, e]));
  assert.deepEqual([byTitle["GHL event"].registration_type, byTitle["GHL event"].registration_url], ["external", "https://faithph.ai/ghl-funnel"]);
  assert.deepEqual([byTitle["Community night"].registration_type, byTitle["Community night"].registration_url], ["none", ""]);
  assert.equal(byTitle.Masterclass.registration_type, "page");
  assert.deepEqual([byTitle.Masterclass.event_date, byTitle.Masterclass.start_time, byTitle.Masterclass.end_time, byTitle.Masterclass.time_zone], ["2099-03-14", "13:00", "17:00", "Asia/Manila"]);
  assert.equal(content.events.length, 3, "drafts are not public");
  cleanup();
});

test("events: hidden and draft events are not public", async () => {
  const { u, cleanup } = await setup();
  let e = rec(await u.author.post("/api/records/events", { data: event() }));
  e = rec(await u.author.post(`/api/records/events/${e.id}/actions/publish`, { version: e.version }));
  assert.equal((await u.author.get("/api/public/content")).data.events.length, 1);
  e = rec(await u.author.put(`/api/records/events/${e.id}`, { version: e.version, data: event({ visible: false }) }));
  assert.equal((await u.author.get("/api/public/content")).data.events.length, 1, "a draft change does not touch the live event");
  e = rec(await u.author.post(`/api/records/events/${e.id}/actions/publish`, { version: e.version }));
  assert.equal((await u.author.get("/api/public/content")).data.events.length, 0, "published as hidden: off the website");
  const preview = (await u.author.get("/api/public/preview", { authorization: `Bearer ${"p".repeat(40)}` })).data;
  assert.ok(!preview.events.some((x) => x.id === e.id), "hidden events stay out of staging previews too");
  cleanup();
});

test("records from the earlier workflow are read in the new model, without rewriting them", async () => {
  const t = testApp();
  const u = await signedIn(t.app);
  const stamp = "2026-10-01T00:00:00.000Z";
  const base = { version: 3, write_id: "w-old", created_at: stamp, created_by: USERS.author, updated_at: stamp, updated_by: USERS.author, authors: [USERS.author], deleted_at: "" };
  const raw = t.app.store; // the migrating store; insert writes rows as given
  await raw.insert("events", { ...base, id: "evt_old1", status: "approved", title: "Old GHL event", slug: "old-ghl", event_date: "2099-05-01", time_zone: "Asia/Manila", cta_type: "external", registration_url: "https://faithph.ai/old", related_program_id: "prg_x", event_status: "open", approved_by: USERS.super });
  await raw.insert("events", { ...base, id: "evt_old2", status: "in_review", title: "Old notify event", slug: "old-notify", time_zone: "Asia/Manila", cta_type: "notify", cta_label: "Get notified" });
  await raw.insert("events", { ...base, id: "evt_old3", status: "draft", title: "Old internal event", slug: "old-internal", event_date: "2099-05-02", time_zone: "Asia/Manila", cta_type: "internal", registration_url: "/programs/ai-workforce-accelerator/", body_html: "<p>Page</p>" });
  await raw.insert("testimonials", { ...base, id: "tst_old1", status: "rejected", display_name: "Old", quote: "Q", consent_status: "withdrawn", role_org: "CEO" });
  await raw.insert("testimonials", { ...base, id: "tst_old2", status: "changes_requested", display_name: "Older", quote: "Q2", consent_status: "not_recorded" });
  // A testimonial that was live but held back by the old consent check
  await raw.insert("published", { id: "testimonials:tst_old2", record_id: "tst_old2", collection: "testimonials", slug: "", version: 2, state: "live", published_at: stamp, published_by: USERS.super, write_id: "w", payload: { id: "tst_old2", version: 2, display_name: "Older", quote: "Q2", consent_ok: false } });

  const get = async (c, id) => (await u.author.get(`/api/records/${c}/${id}`)).data;
  const e1 = (await get("events", "evt_old1")).record, e2 = (await get("events", "evt_old2")).record, e3 = (await get("events", "evt_old3")).record;
  assert.deepEqual([e1.status, e1.registration_type, e1.registration_url, e1.visible], ["draft", "external", "https://faithph.ai/old", true], "Approved is read as Draft");
  assert.deepEqual([e2.status, e2.registration_type, e2.cta_label], ["draft", "none", ""], "the old notify form becomes no registration link");
  assert.deepEqual([e3.registration_type, e3.registration_url, e3.event_page], ["external", "/programs/ai-workforce-accelerator/", true], "a site path keeps its address; page content keeps the page");
  const t1 = (await get("testimonials", "tst_old1")).record, t2 = (await get("testimonials", "tst_old2")).record;
  assert.deepEqual([t1.status, t1.visible], ["draft", false], "withdrawn consent stays hidden");
  assert.deepEqual([t2.status, t2.visible], ["draft", true]);
  assert.ok(!(await u.author.get("/api/public/content")).data.testimonials.length, "a live copy held back for consent stays off the website");
  const views = (await get("events", "evt_old1"));
  assert.deepEqual(views.actions.sort(), ["archive", "publish"]);

  // Saving writes the new fields; the retired values stay stored
  const saved = rec(await u.author.put("/api/records/events/evt_old1", { version: 3, data: { ...e1, summary: "Now saved" } }));
  assert.equal(saved.registration_type, "external");
  const row = JSON.parse(readFileSync(join(t.dir, "store.json"), "utf8")).events.find((x) => x.id === "evt_old1");
  assert.deepEqual([row.status, row.registration_type, row.related_program_id, row.cta_type], ["draft", "external", "prg_x", "external"], "nothing is deleted");
  t.cleanup();
});

test("unsafe HTML is kept in the draft but never published", async () => {
  const { u, cleanup } = await setup();
  const html = `<h2 class="x">Title</h2><p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src="x.png" onerror="alert(1)" alt="">`;
  let r = rec(await u.super.post("/api/records/resources", { data: article({ body_html: html }) }));
  assert.equal(r.body_html, html, "draft keeps the original source");
  await u.super.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  const pub = (await u.author.get("/api/public/content")).data.resources.find((x) => x.id === r.id);
  assert.equal(pub.body_html, `<h2 class="x">Title</h2><p>Hi</p><a>bad</a><img src="x.png" alt="">`);
  cleanup();
});

test("a publish whose second step fails is flagged and can be finished", async () => {
  const t = testApp();
  const u = await signedIn(t.app);
  const r = rec(await u.super.post("/api/records/resources", { data: article() }));
  const store = t.app.store;
  const original = store.update;
  store.update = async (tab, ...rest) => { if (tab === "resources") throw new Error("Simulated Google outage"); return original(tab, ...rest); };
  const pub = await u.super.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  store.update = original;
  assert.equal(pub.status, 200);
  assert.match(pub.data.warning, /live on the website/);
  const view = (await u.super.get(`/api/records/resources/${r.id}`)).data;
  assert.equal(view.needs_repair, true);
  assert.ok(view.actions.includes("reconcile"));
  const fixed = await u.super.post(`/api/records/resources/${r.id}/actions/reconcile`, {});
  assert.equal(rec(fixed).status, "published");
  assert.equal(fixed.data.needs_repair, false);
  t.cleanup();
});

test("a failing first publish step changes nothing", async () => {
  const t = testApp();
  const u = await signedIn(t.app);
  const r = rec(await u.super.post("/api/records/resources", { data: article() }));
  const original = t.app.store.insert;
  t.app.store.insert = async (tab, ...rest) => { if (tab === "published") throw Object.assign(new Error("Google Sheets is temporarily unavailable"), { status: 503 }); return original(tab, ...rest); };
  const pub = await u.super.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  t.app.store.insert = original;
  assert.equal(pub.status, 500);
  const view = (await u.super.get(`/api/records/resources/${r.id}`)).data;
  assert.equal(view.record.status, "draft");
  assert.equal(view.live, null);
  t.cleanup();
});

test("draft page preview renders with the site templates", async () => {
  const { u, cleanup } = await setup();
  const res = await u.author.post("/api/preview", { collection: "resources", data: article({ body_html: "<h2>Preview heading</h2><script>x()</script>" }) });
  assert.equal(res.status, 200);
  assert.match(res.data.html, /Preview heading/);
  assert.match(res.data.html, /class="site-header"/);
  assert.ok(!res.data.html.includes("x()"));
  assert.ok(res.data.report.some((m) => m.includes("script")));
  cleanup();
});

test("resource preview shows the article contents sidebar and drops an empty Keep reading", async () => {
  const { u, cleanup } = await setup();
  const body = `<article class="article"><div class="article__body"><h2>First step</h2><p>One.</p><h2>Second step</h2><p>Two.</p></div></article>
<section class="section wrap" aria-labelledby="related-title"><h2 id="related-title" class="h3">Keep reading</h2><ul class="more" data-cms-component="related-articles"></ul></section>`;
  const res = await u.author.post("/api/preview", { collection: "resources", data: article({ doc_version: 2, body_html: body }) });
  assert.equal(res.status, 200);
  assert.match(res.data.html, /<div class="article__layout wrap"><aside class="article__aside"><details class="toc" open data-toc>/);
  assert.match(res.data.html, /<a class="toc__link" href="#first-step">First step<\/a>/);
  assert.match(res.data.html, /<h2 id="second-step">Second step<\/h2>/);
  assert.ok(!res.data.html.includes("fw:empty-section"), "no marker left in the preview");
  cleanup();
});
