// Newsletter generator: published-only selection, one AI call per selection, approve/reject,
// RSS 2.0 output for GoHighLevel, the scheduled draft run and its guards. The AI is faked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { testApp, signedIn, client, article } from "./helpers.mjs";

const ENV = { ANTHROPIC_API_KEY: "test-key", NEWSLETTER_ASSET_ORIGIN: "https://cdn.example.test", CRON_SECRET: "c".repeat(40), CMS_BASE_URL: "http://localhost" };
function fakeAi() {
  const calls = [];
  const generateCopy = async (resources) => {
    calls.push(resources.map((r) => r.id));
    return { subject: "This week <b>at</b> Faith Works", preview_text: "Three practical reads", intro: "Hello & welcome.", cta_label: "See all resources", closing: "See you soon.",
      items: resources.map((r) => ({ id: r.id, summary: `Summary of ${r.title}` })) };
  };
  return { calls, generateCopy };
}
async function setup() {
  const ai = fakeAi();
  const t = testApp({ env: ENV, generateCopy: ai.generateCopy });
  const u = await signedIn(t.app);
  const ids = [];
  for (const [i, over] of [{ slug: "one", title: "One & only", cover_image_url: "/assets/one.png", cover_image_alt: "Cover" }, { slug: "two", title: "Two" }].entries()) {
    const c = await u.author.post("/api/records/resources", { data: article({ ...over, publish_date: `2026-10-1${i}` }) });
    const p = await u.author.post(`/api/records/resources/${c.data.record.id}/actions/publish`, { version: c.data.record.version });
    assert.equal(p.status, 200, JSON.stringify(p.data));
    ids.push(c.data.record.id);
  }
  const draft = await u.author.post("/api/records/resources", { data: article({ slug: "secret-draft", title: "Secret draft" }) });
  return { ...t, u, ai, ids, draftId: draft.data.record.id };
}

test("newsletter: requires sign-in; lists published resources only", async () => {
  const s = await setup();
  try {
    assert.equal((await client(s.app, "nobody@example.test").get("/api/newsletter")).status, 401);
    const o = await s.u.author.get("/api/newsletter");
    assert.equal(o.status, 200, JSON.stringify(o.data));
    assert.ok(o.data.resources.some((r) => r.slug === "one"));
    assert.ok(!o.data.resources.some((r) => r.slug === "secret-draft"), "drafts never listed");
    const one = o.data.resources.find((r) => r.slug === "one");
    assert.equal(one.url, "https://faithph.ai/resources?one");
    assert.equal(one.image, "https://cdn.example.test/assets/one.png");
    assert.equal(o.data.feed_url, "http://localhost/rss.xml");
  } finally { s.cleanup(); }
});

test("newsletter: generate rejects drafts, empty and oversized selections; no CSRF -> 403", async () => {
  const s = await setup();
  try {
    assert.equal((await s.u.author.post("/api/newsletter/generate", { resourceIds: [s.draftId] })).status, 422);
    assert.equal((await s.u.author.post("/api/newsletter/generate", { resourceIds: [] })).status, 422);
    assert.equal((await s.u.author.post("/api/newsletter/generate", { resourceIds: Array.from({ length: 9 }, (_, i) => `x${i}`) })).status, 422);
    assert.equal((await s.u.author.call("POST", "/api/newsletter/generate", { resourceIds: s.ids }, { "x-cms-csrf": "" })).status, 403);
    assert.equal(s.ai.calls.length, 0, "no AI call for invalid input");
  } finally { s.cleanup(); }
});

test("newsletter: generate once per selection, edit, approve -> RSS; reject; supersede", async () => {
  const s = await setup();
  try {
    const g = await s.u.author.post("/api/newsletter/generate", { resourceIds: s.ids });
    assert.equal(g.status, 201, JSON.stringify(g.data));
    const issue = g.data.issue;
    assert.equal(issue.status, "draft");
    assert.equal(issue.data.subject, "This week at Faith Works", "HTML stripped from AI copy");
    const again = await s.u.author.post("/api/newsletter/generate", { resourceIds: [...s.ids].reverse() });
    assert.equal(again.data.reused, true);
    assert.equal(s.ai.calls.length, 1, "same selection: no second AI call");

    let rss = await client(s.app, "x").get("/api/public/newsletter/rss");
    assert.equal(rss.status, 200);
    assert.match(rss.headers.get("content-type"), /application\/rss\+xml/);
    assert.ok(!rss.data.includes("<item>"), "feed empty until approval");

    const e = await s.u.author.put(`/api/newsletter/${issue.id}`, { version: issue.version, data: { subject: "Edited subject", items: [{ resource_id: s.ids[1], summary: "Better summary" }] } });
    assert.equal(e.status, 200, JSON.stringify(e.data));
    assert.equal((await s.u.author.post(`/api/newsletter/${issue.id}/approve`, { version: issue.version })).status, 409, "stale version refused");
    const a = await s.u.author.post(`/api/newsletter/${issue.id}/approve`, { version: e.data.issue.version });
    assert.equal(a.status, 200, JSON.stringify(a.data));
    assert.equal(a.data.webhook.sent, false);

    rss = await client(s.app, "x").get("/api/public/newsletter/rss");
    const x = rss.data;
    assert.match(x, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    assert.match(x, /<title>Edited subject<\/title>/);
    assert.match(x, /<description>Hello &amp; welcome.<\/description>/);
    assert.match(x, /<title>One &amp; only<\/title>/);
    assert.match(x, /<link>https:\/\/faithph.ai\/resources\?one<\/link>/);
    assert.match(x, /<description>Better summary<\/description>/);
    assert.match(x, /<enclosure url="https:\/\/cdn.example.test\/assets\/one.png" length="0" type="image\/png"\/>/);
    assert.equal((x.match(/<item>/g) || []).length, 2);
    assert.equal((x.match(/<guid isPermaLink="false">/g) || []).length, 2);
    assert.ok(!x.includes("Secret draft") && !x.includes("@example.test") && !x.includes("test-key"), "no drafts, emails or secrets");

    const o = await s.u.author.get("/api/newsletter");
    assert.ok(o.data.resources.every((r) => r.already_sent));
    const g2 = await s.u.author.post("/api/newsletter/generate", { resourceIds: [s.ids[0]] });
    const g3 = await s.u.author.post("/api/newsletter/generate", { resourceIds: [s.ids[1]] });
    assert.equal((await s.u.author.get("/api/newsletter")).data.recent.find((r) => r.id === g2.data.issue.id).status, "rejected", "older draft superseded");
    const r = await s.u.author.post(`/api/newsletter/${g3.data.issue.id}/reject`, { version: g3.data.issue.version });
    assert.equal(r.status, 200);
    assert.equal((await s.u.author.post(`/api/newsletter/${g3.data.issue.id}/approve`, { version: r.data.issue.version })).status, 409);
    assert.match((await client(s.app, "x").get("/api/public/newsletter/rss")).data, /<title>Edited subject<\/title>/, "feed keeps the approved issue");
    assert.match((await client(s.app, "x").get("/rss.xml")).data, /<title>Edited subject<\/title>/, "/rss.xml serves the same feed");
  } finally { s.cleanup(); }
});

test("newsletter: approve refuses resources that were unpublished since generation", async () => {
  const s = await setup();
  try {
    const g = await s.u.author.post("/api/newsletter/generate", { resourceIds: [s.ids[0]] });
    const rec = (await s.u.author.get(`/api/records/resources/${s.ids[0]}`)).data.record;
    assert.equal((await s.u.author.post(`/api/records/resources/${s.ids[0]}/actions/unpublish`, { version: rec.version })).status, 200);
    const a = await s.u.author.post(`/api/newsletter/${g.data.issue.id}/approve`, { version: g.data.issue.version });
    assert.equal(a.status, 422);
  } finally { s.cleanup(); }
});

test("newsletter cron: secret required; drafts only; no duplicates; respects interval", async () => {
  const s = await setup();
  try {
    const anon = client(s.app, "x");
    assert.equal((await anon.get("/api/cron/newsletter")).status, 401);
    assert.equal((await anon.get("/api/cron/newsletter", { authorization: "Bearer wrong" })).status, 401);
    const auth = { authorization: `Bearer ${ENV.CRON_SECRET}` };
    const first = await anon.get("/api/cron/newsletter", auth);
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.created, true);
    const second = await anon.get("/api/cron/newsletter", auth);
    assert.equal(second.data.created, false);
    assert.match(second.data.reason, /draft is already waiting/);
    assert.equal(s.ai.calls.length, 1);
    const o = (await s.u.author.get("/api/newsletter")).data;
    assert.equal(o.draft.data.source, "cron");
    assert.ok(!(await anon.get("/api/public/newsletter/rss")).data.includes("<item>"), "cron never publishes to the feed");
    await s.u.author.post(`/api/newsletter/${o.draft.id}/approve`, { version: o.draft.version });
    const third = await anon.get("/api/cron/newsletter", auth);
    assert.equal(third.data.created, false);
    assert.equal(s.ai.calls.length, 1);
  } finally { s.cleanup(); }
});

test("newsletter: generation refuses without an AI key", async () => {
  const t = testApp({ env: { ...ENV, ANTHROPIC_API_KEY: "" } });
  const u = await signedIn(t.app);
  try { assert.equal((await u.author.post("/api/newsletter/generate", { resourceIds: ["x"] })).status, 503); } finally { t.cleanup(); }
});
