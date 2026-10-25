// What the website build and anonymous visitors can reach: the public endpoints only, published
// content only, and the website rebuild hook on publish and unpublish (never revealed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { testApp, signedIn, client, article } from "./helpers.mjs";

const HOOK = "https://api.vercel.com/v1/integrations/deploy/prj_test/secret-hook-id";

test("anonymous requests reach only the public endpoints", async () => {
  const { app, cleanup } = testApp();
  const anon = client(app, "");
  for (const p of ["/api/dashboard", "/api/records/programs", "/api/records/resources", "/api/records/settings", "/api/records/testimonials/x",
    "/api/records/events/x/history", "/api/authors", "/api/tags", "/api/users", "/api/audit", "/api/recovery", "/api/backup", "/api/submissions", "/api/submissions/sub_x"]) {
    assert.equal((await anon.get(p)).status, 401, `GET ${p} needs a session`);
  }
  for (const p of ["/api/records/resources", "/api/records/resources/x/actions/publish", "/api/preview", "/api/tags", "/api/users", "/api/deploy"]) {
    assert.equal((await anon.post(p, {})).status, 401, `POST ${p} needs a session`);
  }
  assert.equal((await anon.get("/api/public/preview")).status, 401, "drafts need the preview token");

  const health = await anon.get("/api/health");
  assert.equal(health.status, 200);
  assert.deepEqual(Object.keys(health.data).sort(), ["configured", "forms", "ok", "store"]);
  assert.deepEqual(Object.keys(health.data.forms).sort(), ["endpoint", "netlify", "problems"], "forms setup as booleans and a count only");
  assert.equal((await anon.put("/api/submissions/sub_x", { status: "completed" })).status, 401, "PUT /api/submissions/:id needs a session");

  const pub = await anon.get("/api/public/content");
  assert.equal(pub.status, 200);
  assert.equal(pub.data.view, "published");
  for (const k of ["users", "audit_log", "history", "published"]) assert.ok(!(k in pub.data), `no ${k} in public content`);
  assert.ok(!/@example\.test/.test(JSON.stringify(pub.data)), "no editors' emails");
  cleanup();
});

test("public content is not cached by the CDN, so a build started by a publish sees it", async () => {
  const { u, cleanup } = await (async () => { const t = testApp(); return { ...t, u: await signedIn(t.app) }; })();
  const first = await u.author.get("/api/public/content");
  assert.equal(first.headers.get("cache-control"), "no-store");
  const r = (await u.author.post("/api/records/resources", { data: article() })).data.record;
  await u.author.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  assert.ok((await u.author.get("/api/public/content")).data.resources.some((x) => x.id === r.id), "visible straight after publishing");
  cleanup();
});

test("publish and unpublish start a website rebuild; the hook URL is never revealed", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); };
  const t = testApp({ env: { PUBLIC_SITE_DEPLOY_HOOK_URL: HOOK }, fetchImpl });
  const u = await signedIn(t.app);

  let r = (await u.author.post("/api/records/resources", { data: article() })).data.record;
  assert.equal(calls.length, 0, "saving a draft does not rebuild");
  const pub = await u.author.post(`/api/records/resources/${r.id}/actions/publish`, { version: r.version });
  assert.equal(pub.data.deploy.triggered, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, HOOK);
  assert.equal(calls[0].init.method, "POST");

  r = pub.data.record;
  const un = await u.author.post(`/api/records/resources/${r.id}/actions/unpublish`, { version: r.version });
  assert.equal(un.status, 200);
  assert.equal(un.data.deploy.triggered, true);
  assert.equal(calls.length, 2, "unpublishing rebuilds too");
  assert.ok(!(await u.author.get("/api/public/content")).data.resources.some((x) => x.id === r.id), "gone from public content");

  const session = await u.super.get("/api/session");
  assert.equal(session.data.config.deployHook, true);
  for (const res of [pub, un, session, await u.author.get("/api/public/content"), await u.author.get("/api/health")]) {
    assert.ok(!JSON.stringify(res.data).includes("secret-hook-id"), "hook URL not in any response");
  }
  t.cleanup();
});
