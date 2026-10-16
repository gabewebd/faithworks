// End-to-end API tests on the JSON store: roles, workflow, publishing, concurrency, public output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { testApp, signedIn, client, article, USERS } from "./helpers.mjs";
import { loadConfig } from "../server/config.mjs";

async function setup() {
  const t = testApp();
  const u = await signedIn(t.app);
  return { ...t, u };
}
const rec = (r) => r.data.record;

test("configuration fails closed on hosted deployments", () => {
  const cfg = loadConfig({ VERCEL: "1", CMS_DEV_LOGIN: "true" });
  assert.ok(cfg.errors.some((e) => e.includes("CMS_SESSION_SECRET")));
  assert.ok(cfg.errors.some((e) => e.includes("GOOGLE_SHEETS_SPREADSHEET_ID")));
  assert.ok(cfg.errors.some((e) => e.includes("CMS_DEV_LOGIN cannot be enabled")));
  assert.equal(cfg.devLogin, false);
  assert.ok(loadConfig({ NETLIFY: "true", CMS_STORE: "json" }).errors.some((e) => e.includes("must use the Google Sheets store")));
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

test("author workflow: draft → submit → review; any author can co-edit; only admins approve and publish", async () => {
  const { u, cleanup } = await setup();
  const created = await u.author.post("/api/records/resources", { data: article({ summary: "" }) });
  assert.equal(created.status, 201);
  const r = rec(created);
  assert.equal(r.status, "draft");
  assert.equal(r.created_by, USERS.author);

  // Strict validation on submit
  const bad = await u.author.post(`/api/records/resources/${r.id}/actions/submit`, { version: r.version });
  assert.equal(bad.status, 422);
  assert.ok(bad.data.error.errors.summary);

  const saved = await u.author.put(`/api/records/resources/${r.id}`, { version: r.version, data: article() });
  assert.equal(saved.status, 200);
  assert.equal(rec(saved).version, 2);

  // Every CMS user may edit content (no per-item editor list); nobody can skip the version check
  assert.equal((await u.author2.put(`/api/records/resources/${r.id}`, { version: 1, data: article({ title: "Stale" }) })).status, 409);
  const co = await u.author2.put(`/api/records/resources/${r.id}`, { version: 2, data: article({ title: "Co-edited" }) });
  assert.equal(co.status, 200);
  assert.equal(rec(co).updated_by, USERS.author2);
  assert.equal((await u.author.post(`/api/records/resources/${r.id}/actions/approve`, { version: 3 })).status, 403);
  assert.equal((await u.author.post(`/api/records/resources/${r.id}/actions/publish`, { version: 3 })).status, 403);

  const sub = await u.author.post(`/api/records/resources/${r.id}/actions/submit`, { version: 3 });
  assert.equal(sub.status, 200);
  assert.equal(rec(sub).status, "in_review");
  // Locked while under review
  assert.equal((await u.author.put(`/api/records/resources/${r.id}`, { version: 4, data: article({ title: "Edit" }) })).status, 403);
  const wd = await u.author.post(`/api/records/resources/${r.id}/actions/withdraw`, { version: 4 });
  assert.equal(rec(wd).status, "draft");
  cleanup();
});

test("only approved content is published; live copy is separate from draft edits", async () => {
  const { u, cleanup } = await setup();
  let r = rec(await u.author.post("/api/records/resources", { data: article() }));
  r = rec(await u.author.post(`/api/records/resources/${r.id}/actions/submit`, { version: r.version }));
  assert.equal((await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version })).status, 409, "cannot publish unapproved");
  const ch = await u.main.post(`/api/records/resources/${r.id}/actions/request_changes`, { version: r.version, note: "" });
  assert.equal(ch.status, 422, "a note is required");
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/request_changes`, { version: r.version, note: "Add a source." }));
  assert.equal(r.status, "changes_requested");
  assert.equal(r.review_note, "Add a source.");
  r = rec(await u.author.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ summary: "With a source." }) }));
  r = rec(await u.author.post(`/api/records/resources/${r.id}/actions/submit`, { version: r.version }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/approve`, { version: r.version }));
  assert.equal(r.status, "approved");
  const pub = await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  assert.equal(pub.status, 200);
  assert.equal(rec(pub).status, "published");
  assert.equal(pub.data.live.version, rec(pub).version);
  assert.equal(pub.data.deploy.triggered, false, "no hook configured");

  let content = (await u.author.get("/api/public/content")).data;
  assert.equal(content.view, "published");
  assert.equal(content.resources.find((x) => x.id === r.id).summary, "With a source.");

  // Editing the live item: back to draft, live copy unchanged
  const edited = await u.main.put(`/api/records/resources/${r.id}`, { version: rec(pub).version, data: article({ summary: "Unapproved change" }) });
  assert.equal(rec(edited).status, "draft");
  assert.equal(edited.data.draft_differs, true);
  content = (await u.author.get("/api/public/content")).data; // cache invalidated on publish only, so read through the service
  const fresh = await u.main.get(`/api/records/resources/${r.id}`);
  assert.equal(fresh.data.live.version, rec(pub).version);
  assert.equal(content.resources.find((x) => x.id === r.id).summary, "With a source.");
  cleanup();
});

test("public content never includes drafts or internal fields", async () => {
  const { u, cleanup } = await setup();
  const content = (await u.author.get("/api/public/content")).data;
  assert.equal(content.programs.length, 0, "seeded programs are drafts");
  assert.equal(content.testimonials.length, 0, "no testimonial has recorded consent");
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
  const r = rec(await u.main.post("/api/records/resources", { data: article() }));
  const a = await u.main.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ summary: "Admin A" }) });
  assert.equal(a.status, 200);
  const b = await u.super.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ summary: "Admin B" }) });
  assert.equal(b.status, 409);
  assert.equal(b.data.error.code, "conflict");
  assert.equal(b.data.error.current.updated_by, USERS.main);
  cleanup();
});

test("slugs: format, duplicates and live slug changes", async () => {
  const { u, cleanup } = await setup();
  const dup = await u.author.post("/api/records/resources", { data: article({ slug: "from-learning-to-doing" }) });
  assert.equal(dup.status, 422);
  assert.match(dup.data.error.errors.slug, /already used/);
  assert.equal((await u.author.post("/api/records/resources", { data: article({ slug: "Bad Slug!" }) })).status, 422);

  let r = rec(await u.main.post("/api/records/resources", { data: article() }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/approve`, { version: r.version }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version }));
  const needsConfirm = await u.main.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ slug: "renamed-article" }) });
  assert.equal(needsConfirm.status, 409);
  assert.equal(needsConfirm.data.error.code, "slug_change_confirm");
  r = rec(await u.main.put(`/api/records/resources/${r.id}`, { version: r.version, data: article({ slug: "renamed-article" }), confirmSlugChange: true }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/approve`, { version: r.version }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version }));
  const content = (await u.author.get("/api/public/content")).data;
  assert.deepEqual(content.redirects, [{ from: "/resources/testing-the-cms/", to: "/resources/renamed-article/" }]);
  // The old slug stays reserved for the redirect
  assert.equal((await u.author.post("/api/records/resources", { data: article({ slug: "testing-the-cms" }) })).status, 422);
  cleanup();
});

test("testimonials need consent evidence and admin display approval", async () => {
  const { u, cleanup } = await setup();
  const data = { kind: "testimonial", quote: "It helped.", attribution: "Ana Cruz", display_name: "Ana C.", source: "Feedback form, Batch 3", consent_status: "obtained", consent_evidence: "Consent form 2026-10-01 (Drive: Consents/AnaC.pdf)", content_owner: "Faith", review_date: "2027-01-01", display_approved: true };
  let t = rec(await u.author.post("/api/records/testimonials", { data }));
  assert.equal(t.display_approved, false, "authors cannot set display approval");
  t = rec(await u.author.post(`/api/records/testimonials/${t.id}/actions/submit`, { version: t.version }));
  const refused = await u.main.post(`/api/records/testimonials/${t.id}/actions/approve`, { version: t.version });
  assert.equal(refused.status, 422);
  assert.match(refused.data.error.errors.consent_status, /Display approval/);
  t = rec(await u.main.post(`/api/records/testimonials/${t.id}/actions/withdraw`, { version: t.version }));
  t = rec(await u.main.put(`/api/records/testimonials/${t.id}`, { version: t.version, data }));
  assert.equal(t.display_approved, true);
  t = rec(await u.main.post(`/api/records/testimonials/${t.id}/actions/approve`, { version: t.version }));
  t = rec(await u.main.post(`/api/records/testimonials/${t.id}/actions/publish`, { version: t.version }));
  const content = (await u.author.get("/api/public/content")).data;
  const pub = content.testimonials.find((x) => x.id === t.id);
  assert.equal(pub.display_name, "Ana C.");
  assert.equal(pub.consent_ok, true);
  assert.equal(pub.attribution, undefined);
  assert.equal(pub.consent_evidence, undefined);
  cleanup();
});

test("site settings: admins only; security fields are Super Admin only", async () => {
  const { u, cleanup } = await setup();
  assert.equal((await u.author.get("/api/records/settings/site")).status, 403);
  const s = (await u.main.get("/api/records/settings/site")).data;
  const data = { ...s.record, contact_email: "hello@faithph.ai", origin: "https://evil.example", ga4_id: "G-HACKED1" };
  const saved = rec(await u.main.put("/api/records/settings/site", { version: s.record.version, data }));
  assert.equal(saved.contact_email, "hello@faithph.ai");
  assert.equal(saved.origin, "https://faithph.ai", "main admin cannot change the origin");
  assert.equal(saved.ga4_id, "", "main admin cannot add tracking");
  const bad = await u.super.put("/api/records/settings/site", { version: saved.version, data: { ...saved, ga4_id: "<script>" } });
  assert.equal(bad.status, 422);
  cleanup();
});

test("users: only Super Admins manage roles; nobody changes their own", async () => {
  const { u, cleanup } = await setup();
  assert.equal((await u.main.get("/api/users")).status, 403);
  assert.equal((await u.main.post("/api/users", { email: "x@example.test", role: "super_admin" })).status, 403);
  const created = await u.super.post("/api/users", { email: "New.Editor@Example.test", name: "New", role: "author" });
  assert.equal(created.status, 200);
  assert.equal(created.data.id, "new.editor@example.test");
  assert.equal((await u.super.post("/api/users", { email: USERS.super, role: "author" })).status, 409);
  // Deactivating a user takes effect on their next request
  await u.super.post("/api/users", { email: USERS.author2, name: "Gone", role: "author", active: false });
  assert.equal((await u.author2.get("/api/dashboard")).status, 401);
  cleanup();
});

test("archive, delete and recovery", async () => {
  const { u, cleanup } = await setup();
  let r = rec(await u.main.post("/api/records/resources", { data: article() }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/approve`, { version: r.version }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version }));
  assert.equal((await u.main.post(`/api/records/resources/${r.id}/actions/delete`, { version: r.version })).status, 403, "main admin cannot delete");
  const del = await u.super.post(`/api/records/resources/${r.id}/actions/delete`, { version: r.version });
  assert.equal(del.status, 200);
  const content = (await u.author.get("/api/public/content")).data;
  assert.ok(!content.resources.some((x) => x.id === r.id), "deleted items are taken offline");
  assert.ok(!(await u.main.get("/api/records/resources")).data.some((x) => x.id === r.id));
  const recovery = (await u.super.get("/api/recovery")).data;
  assert.ok(recovery.deleted.some((x) => x.id === r.id));
  const un = await u.super.post(`/api/records/resources/${r.id}/actions/undelete`, { version: rec(del).version });
  assert.equal(un.status, 200);
  // Version history and restore
  const hist = (await u.main.get(`/api/records/resources/${r.id}/history`)).data;
  assert.ok(hist.length >= 4);
  const first = hist[hist.length - 1];
  const restored = await u.main.post(`/api/records/resources/${r.id}/history/${first.id}/restore`, { version: rec(un).version });
  assert.equal(restored.status, 200);
  const audit = (await u.main.get("/api/audit")).data;
  assert.ok(audit.some((a) => a.action === "delete" && a.record_id === r.id));
  cleanup();
});

test("events must reference an existing program", async () => {
  const { u, cleanup } = await setup();
  const ev = { title: "Workshop", slug: "workshop-test", summary: "A test.", event_status: "tba", cta_type: "notify", delivery_format: "online", time_zone: "Asia/Manila", date_label: "Soon", related_program_id: "prg_missing" };
  const bad = await u.main.post("/api/records/events", { data: ev });
  assert.equal(bad.status, 422);
  const progs = (await u.main.get("/api/options/programs")).data;
  const ok = await u.main.post("/api/records/events", { data: { ...ev, related_program_id: progs[0].id, start_time: "13:00", end_time: "12:00" } });
  assert.equal(ok.status, 422, "end before start");
  assert.equal((await u.main.post("/api/records/events", { data: { ...ev, related_program_id: progs[0].id } })).status, 201);
  cleanup();
});

test("unsafe HTML is kept in the draft but never published", async () => {
  const { u, cleanup } = await setup();
  const html = `<h2 class="x">Title</h2><p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src="x.png" onerror="alert(1)" alt="">`;
  let r = rec(await u.main.post("/api/records/resources", { data: article({ body_html: html }) }));
  assert.equal(r.body_html, html, "draft keeps the original source");
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/approve`, { version: r.version }));
  await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  const pub = (await u.author.get("/api/public/content")).data.resources.find((x) => x.id === r.id);
  assert.equal(pub.body_html, `<h2 class="x">Title</h2><p>Hi</p><a>bad</a><img src="x.png" alt="">`);
  cleanup();
});

test("a publish whose second step fails is flagged and can be finished", async () => {
  const t = testApp();
  const u = await signedIn(t.app);
  let r = rec(await u.main.post("/api/records/resources", { data: article() }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/approve`, { version: r.version }));
  const store = t.app.store;
  const original = store.update;
  store.update = async (tab, ...rest) => { if (tab === "resources") throw new Error("Simulated Google outage"); return original(tab, ...rest); };
  const pub = await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  store.update = original;
  assert.equal(pub.status, 200);
  assert.match(pub.data.warning, /live on the website/);
  const view = (await u.main.get(`/api/records/resources/${r.id}`)).data;
  assert.equal(view.needs_repair, true);
  assert.ok(view.actions.includes("reconcile"));
  const fixed = await u.main.post(`/api/records/resources/${r.id}/actions/reconcile`, {});
  assert.equal(rec(fixed).status, "published");
  assert.equal(fixed.data.needs_repair, false);
  t.cleanup();
});

test("a failing first publish step changes nothing", async () => {
  const t = testApp();
  const u = await signedIn(t.app);
  let r = rec(await u.main.post("/api/records/resources", { data: article() }));
  r = rec(await u.main.post(`/api/records/resources/${r.id}/actions/approve`, { version: r.version }));
  const original = t.app.store.insert;
  t.app.store.insert = async (tab, ...rest) => { if (tab === "published") throw Object.assign(new Error("Google Sheets is temporarily unavailable"), { status: 503 }); return original(tab, ...rest); };
  const pub = await u.main.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  t.app.store.insert = original;
  assert.equal(pub.status, 500);
  const view = (await u.main.get(`/api/records/resources/${r.id}`)).data;
  assert.equal(view.record.status, "approved");
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
