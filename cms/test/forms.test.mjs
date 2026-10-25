// Website form submissions that post to the CMS: the shared form definitions, the public endpoint
// (validation, CORS, spam, test records, rate limits, duplicates), Netlify Forms webhooks, and the
// Super Admin screens' API. The CMS sends no email and writes no Google Sheet: every test runs with
// a fetch that records outbound requests and checks there are none. Every submission here is a
// labelled test record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { testApp, signedIn } from "./helpers.mjs";
import { FORMS, validateAnswers } from "../shared/forms.mjs";
import { formsConfig } from "../server/config.mjs";
import { submissionId } from "../server/forms/submissions.mjs";
import * as R from "../../tools/render.mjs";

const ORIGIN = "https://example.test";
// Settings of the removed email alerts and Sheets copy: set here to show they no longer do anything.
const RETIRED_ENV = {
  RESEND_API_KEY: "re_test_not_a_real_key", FORMS_EMAIL_FROM: "Faith Works Forms <forms@example.test>", FORMS_NOTIFY_TO: "team@example.test",
  FORMS_SHEETS_MIRROR: "true", GOOGLE_SHEETS_SPREADSHEET_ID: "sheet123", GOOGLE_SERVICE_ACCOUNT_EMAIL: "cms@project.iam.gserviceaccount.com",
};
const ENV = { FORMS_ALLOWED_ORIGINS: ORIGIN, CMS_BASE_URL: "http://localhost:5174", ...RETIRED_ENV };

// A corporate inquiry. Defaults to a labelled test record ([TEST] name, example.test address).
function body(over = {}, fields = {}) {
  return {
    form_id: "corporate_inquiry", request_id: randomUUID(), offer_id: "corporate-training", offer_title: "Corporate AI training",
    source_page: "/business/", submitted_at: new Date().toISOString(), utm: { utm_source: "newsletter", utm_bogus: "x" }, hp: "", elapsed_ms: 9000,
    consent: { marketing: "no", wording: null, wording_version: "marketing-optin-v1-draft", recorded_at: new Date().toISOString() },
    fields: { name: "[TEST] Dana Cruz", email: "Dana@Example.test", company: "Test Company", job_role: "HR lead", team_size: "11–50", goals: "TEST: practical AI for the team", ...fields },
    ...over,
  };
}
// A record classified as genuine: a reserved .invalid domain, so it can never reach a real inbox.
const genuine = (over = {}) => body(over, { name: "Dana Cruz", email: "dana@genuine.invalid" });

async function submit(app, b, headers = {}) {
  const res = await app.handle(new Request("http://localhost/api/forms/submit", {
    method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, "x-nf-client-connection-ip": "203.0.113.7", ...headers }, body: JSON.stringify(b),
  }));
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null, headers: res.headers };
}

// Records every outbound request (there must be none: no email service, no Google Sheets).
function noOutbound() {
  const calls = [];
  return { calls, fetchImpl: async (url) => { calls.push(String(url)); throw new Error(`unexpected request to ${url}`); } };
}

const rows = (app) => app.store.list("form_submissions");

/* ---- Shared definitions ---------------------------------------------------- */

test("the website renders exactly the fields the server accepts; the other forms are GoHighLevel embeds", () => {
  R.init({ events: [], programs: [], site: {} });
  const html = R.contactForm();
  assert.match(html, /data-fw-form="general_contact"/);
  const names = [...html.matchAll(/<(?:input|select|textarea)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]).filter((n) => !["website", "consent_marketing"].includes(n));
  assert.deepEqual(names, [...FORMS.general_contact.fields.map((f) => f.name), ...(FORMS.general_contact.hidden || [])], "general_contact fields");
  for (const embed of [R.starterKitForm(), R.proposalForm(), R.speakingForm(), R.demoForm(), R.notifyForm(), R.programForm({ title: "X" })]) {
    assert.match(embed, /class="form form--ghl"[^]*<iframe[^>]+src="https:\/\/api\.faithph\.ai\/widget\/form\/[A-Za-z0-9]+"/);
    assert.doesNotMatch(embed, /data-fw-form/, "not sent to the CMS");
  }
});

test("validation: required fields, formats, options, limits; unknown fields dropped", () => {
  const ok = validateAnswers("speaking_inquiry", {
    organization: "  Test Org ", name: "[TEST] Sam", email: "SAM@EXAMPLE.TEST", event_name: "Test\u0000 Summit", event_date: "2027-02-14",
    location: "Online", audience_size: "120", requested_format: "Not sure yet", audience_profile: "Line one\nLine two", extra: "dropped",
  });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.answers.email, "sam@example.test");
  assert.equal(ok.answers.organization, "Test Org");
  assert.equal(ok.answers.event_name, "Test Summit", "control characters removed");
  assert.equal(ok.answers.audience_profile, "Line one\nLine two", "line breaks kept in long answers");
  assert.ok(!("extra" in ok.answers));

  const bad = validateAnswers("speaking_inquiry", { email: "not-an-email", event_date: "next week", audience_size: "0", requested_format: "Something else", name: "x".repeat(161) });
  const fields = Object.fromEntries(bad.errors.map((e) => [e.field, e.message]));
  for (const k of ["organization", "event_name", "location", "audience_profile"]) assert.match(fields[k], /required/);
  assert.match(fields.email, /valid email/);
  assert.match(fields.event_date, /date/);
  assert.match(fields.audience_size, /number/);
  assert.match(fields.requested_format, /options/);
  assert.match(fields.name, /too long/);

  assert.deepEqual(validateAnswers("general_contact", { name: "A", email: "a@b.test", inquiry_type: "faith-ai", message: "Hi" }).errors, [], "option values, not labels");
  assert.equal(validateAnswers("starter_kit", { first_name: "A", email: "a@b.test", lead_magnet_version: "v1.0-draft" }).answers.lead_magnet_version, "v1.0-draft");
  assert.equal(validateAnswers("nope", {}).errors[0].field, "form_id");
});

test("configuration: forms problems never stop the CMS; email and Sheets settings are ignored", () => {
  const f = formsConfig({ ...RETIRED_ENV, FORMS_ALLOWED_ORIGINS: "https://example.test/, http://evil.example" });
  assert.ok(f.problems.some((p) => /FORMS_ALLOWED_ORIGINS/.test(p)));
  assert.deepEqual(f.allowedOrigins, ["https://example.test"], "trailing slash removed; plain http refused");
  for (const gone of ["email", "resendKey", "notifyTo", "sheetsMirror"]) assert.ok(!(gone in f), `no ${gone} setting`);
  const { app, cleanup } = testApp({ env: RETIRED_ENV });
  assert.deepEqual(app.cfg.errors, [], "the CMS itself stays configured");
  cleanup();
});

/* ---- The public endpoint ----------------------------------------------------- */

test("the endpoint is off until FORMS_ALLOWED_ORIGINS is set", async () => {
  const { app, cleanup } = testApp();
  const r = await submit(app, body());
  assert.equal(r.status, 503);
  assert.equal(r.data.error.code, "forms_off");
  assert.equal((await rows(app)).length, 0);
  cleanup();
});

test("CORS: only the listed website origin may submit", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: noOutbound().fetchImpl });
  const pre = await app.handle(new Request("http://localhost/api/forms/submit", { method: "OPTIONS", headers: { origin: ORIGIN, "access-control-request-method": "POST" } }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(pre.headers.get("access-control-allow-headers"), /idempotency-key/);
  const evil = await app.handle(new Request("http://localhost/api/forms/submit", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  assert.equal((await submit(app, body(), { origin: "https://evil.example" })).status, 403);
  assert.equal((await submit(app, body(), { origin: "" })).status, 403, "no Origin header (not a browser form)");
  assert.equal((await rows(app)).length, 0);
  cleanup();
});

test("a valid submission is stored, and nothing is emailed or copied anywhere", async () => {
  const net = noOutbound();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: net.fetchImpl });
  const b = genuine();
  const r = await submit(app, b);
  assert.equal(r.status, 201);
  assert.equal(r.data.ok, true);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  const [row] = await rows(app);
  assert.equal(row.id, r.data.id);
  assert.equal(row.id, submissionId("cms_endpoint", b.request_id));
  assert.equal(row.form_id, "corporate_inquiry");
  assert.equal(row.kind, "genuine");
  assert.equal(row.status, "new");
  assert.equal(row.name, "Dana Cruz");
  assert.equal(row.email, "dana@genuine.invalid");
  assert.deepEqual(row.context.utm, { utm_source: "newsletter" }, "unknown UTM keys dropped");
  assert.equal(row.context.source_page, "/business/");
  assert.match(row.ip_hash, /^[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(row).includes("203.0.113.7"), "the IP address itself is never stored");
  assert.equal(row.notify_state, "off", "no email alert");
  assert.equal(row.sheets_state, "off", "no Google Sheets copy, even with the old settings present");
  assert.deepEqual(net.calls, [], "no request to an email service or Google");
  const u = await signedIn(app);
  assert.equal((await u.super.post(`/api/submissions/${row.id}/retry`)).status, 404, "the delivery retry route is gone");
  cleanup();
});

test("invalid answers are refused with field messages the form can show (and CORS headers)", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: noOutbound().fetchImpl });
  const r = await submit(app, body({}, { email: "nope", goals: "" }));
  assert.equal(r.status, 422);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN, "the browser can read the error");
  assert.deepEqual(r.data.error.fields.map((f) => f.field).sort(), ["email", "goals"]);
  assert.equal((await submit(app, { ...body(), form_id: "admin" })).status, 400);
  assert.equal((await submit(app, { ...body(), request_id: "../x" })).status, 400);
  assert.equal((await rows(app)).length, 0, "nothing stored");
  cleanup();
});

test("duplicates: the same request id (retry, double click, replay) is stored once", async () => {
  const net = noOutbound();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: net.fetchImpl });
  const b = body();
  const first = await submit(app, b);
  const again = await submit(app, b);
  const changed = await submit(app, { ...b, fields: { ...b.fields, goals: "TEST: different text" } });
  assert.equal(first.status, 201);
  assert.equal(again.status, 200);
  assert.equal(again.data.id, first.data.id);
  assert.equal(changed.data.id, first.data.id, "the first version wins");
  const all = await rows(app);
  assert.equal(all.length, 1);
  assert.equal(all[0].answers.goals, "TEST: practical AI for the team");
  assert.deepEqual(net.calls, []);
  cleanup();
});

test("spam: the honeypot or an instant submit is kept as spam and answered like success", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: noOutbound().fetchImpl });
  const hp = await submit(app, body({ hp: "http://spam.example" }, { email: "garbage" }));
  const fast = await submit(app, body({ elapsed_ms: 300 }));
  assert.equal(hp.status, 201, "a bot is not told it was caught");
  assert.equal(fast.status, 201);
  const all = await rows(app);
  assert.deepEqual(all.map((r) => r.kind), ["spam", "spam"]);
  assert.ok(all.every((r) => r.notify_state === "off" && r.spam_reason));
  cleanup();
});

test("test records: example/test addresses or a [TEST] name are labelled", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: noOutbound().fetchImpl });
  await submit(app, body());
  await submit(app, body({}, { name: "Test person", email: "someone@genuine.invalid" }));
  assert.deepEqual((await rows(app)).map((r) => r.kind), ["test", "test"]);
  cleanup();
});

test("rate limit: a connection gets FORMS_RATE_LIMIT submissions per 10 minutes", async () => {
  const { app, cleanup } = testApp({ env: { ...ENV, FORMS_RATE_LIMIT: "3" }, fetchImpl: noOutbound().fetchImpl });
  for (let i = 0; i < 3; i++) assert.equal((await submit(app, body())).status, 201);
  const blocked = await submit(app, body());
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal((await submit(app, body(), { "x-nf-client-connection-ip": "198.51.100.9" })).status, 201, "another connection is not affected");
  assert.equal((await rows(app)).length, 4);
  cleanup();
});

/* ---- Failures ------------------------------------------------------------------- */

test("database unavailable: the visitor gets an error (never a false success) and can resend", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: noOutbound().fetchImpl });
  const insert = app.store.insert;
  app.store.insert = async () => { throw Object.assign(new Error("The CMS database (Supabase) could not be reached."), { status: 503, code: "db_unavailable" }); };
  const b = body();
  const r = await submit(app, b);
  assert.ok(r.status >= 500);
  assert.notEqual(r.data.ok, true);
  app.store.insert = insert;
  assert.equal((await submit(app, b)).status, 201, "the browser's retry (same request id) succeeds");
  assert.equal((await rows(app)).length, 1);
  cleanup();
});

/* ---- Netlify Forms adapter ---------------------------------------------------- */

const SECRET = "n".repeat(40);
const jws = (raw, secret = SECRET, claims = {}) => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const payload = enc({ iss: "netlify", sha256: createHash("sha256").update(raw).digest("hex"), ...claims });
  return `${head}.${payload}.${createHmac("sha256", secret).update(`${head}.${payload}`).digest("base64url")}`;
};
const netlifyPayload = (over = {}) => JSON.stringify({
  id: "6720aa1b2c3d4e5f60718293", form_name: "general_contact", created_at: "2026-10-21T02:00:00.000Z",
  data: { name: "[TEST] Netlify Person", email: "netlify@example.test", inquiry_type: "programs", message: "TEST via Netlify", ip: "198.51.100.20", referrer: "https://faithworks.netlify.app/contact/", utm_source: "ad" },
  ...over,
});
const hook = (app, raw, sig) => app.handle(new Request("http://localhost/api/forms/netlify", { method: "POST", headers: { "content-type": "application/json", "x-webhook-signature": sig }, body: raw }));

test("Netlify webhook: verified signatures only; stored once under Netlify's submission id", async () => {
  const net = noOutbound();
  const { app, cleanup } = testApp({ env: { ...ENV, NETLIFY_FORMS_WEBHOOK_SECRET: SECRET }, fetchImpl: net.fetchImpl });
  const raw = netlifyPayload();
  assert.equal((await hook(app, raw, jws(raw, "w".repeat(40)))).status, 401, "wrong secret");
  assert.equal((await hook(app, raw, jws(netlifyPayload({ id: "other" })))).status, 401, "signature for a different body");
  assert.equal((await hook(app, raw, jws(raw, SECRET, { iss: "someone" }))).status, 401, "wrong issuer");
  assert.equal((await hook(app, raw, "")).status, 401);
  assert.equal((await rows(app)).length, 0);

  const ok = await hook(app, raw, jws(raw));
  assert.equal(ok.status, 200);
  assert.equal((await hook(app, raw, jws(raw))).status, 200, "Netlify redelivery");
  const all = await rows(app);
  assert.equal(all.length, 1);
  assert.equal(all[0].provider, "netlify_forms");
  assert.equal(all[0].id, submissionId("netlify_forms", "6720aa1b2c3d4e5f60718293"));
  assert.equal(all[0].context.source_page, "/contact/");
  assert.equal(all[0].answers.inquiry_type, "programs");
  assert.ok(!("ip" in all[0].answers), "Netlify's metadata is not stored as an answer");
  assert.deepEqual(net.calls, []);

  const bad = netlifyPayload({ id: "x2", form_name: "not_ours" });
  assert.equal((await hook(app, bad, jws(bad))).status, 422);
  cleanup();
});

test("Netlify webhook route is closed without NETLIFY_FORMS_WEBHOOK_SECRET", async () => {
  const { app, cleanup } = testApp({ env: ENV });
  const raw = netlifyPayload();
  assert.equal((await hook(app, raw, jws(raw))).status, 404);
  cleanup();
});

/* ---- The CMS screens' API -------------------------------------------------------- */

test("only Super Admins can list, open or change submissions", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: noOutbound().fetchImpl });
  const u = await signedIn(app);
  const { data } = await submit(app, body());
  for (const r of [await u.author.get("/api/submissions"), await u.author.get(`/api/submissions/${data.id}`),
    await u.author.put(`/api/submissions/${data.id}`, { status: "completed" })]) {
    assert.equal(r.status, 403);
  }
  assert.equal((await rows(app))[0].status, "new");
  const s = await u.super.get(`/api/submissions/${data.id}`);
  assert.equal(s.status, 200);
  assert.ok(!("ip_hash" in s.data), "the rate-limit hash is not shown");
  cleanup();
});

test("Super Admins search and filter by type, date and status, and change the status (audited)", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: noOutbound().fetchImpl });
  const u = await signedIn(app);
  const a = (await submit(app, body())).data.id;
  const b = (await submit(app, body({ form_id: "faith_ai_demo", fields: { name: "[TEST] Robin", email: "robin@example.test", company: "Demo Co", use_case: "TEST inquiry tracking" } }))).data.id;
  await submit(app, body({ hp: "bot" }));
  const list = (qs = "") => u.super.get(`/api/submissions${qs}`).then((r) => r.data.items.map((x) => x.id));

  assert.equal((await list()).length, 3);
  assert.equal((await list("?kind=not_spam")).length, 2);
  assert.equal((await list("?kind=spam")).length, 1);
  assert.deepEqual(await list("?form=faith_ai_demo"), [b]);
  assert.deepEqual(await list("?q=inquiry%20tracking"), [b], "search covers answers");
  assert.deepEqual(await list("?q=ROBIN"), [b]);
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  assert.equal((await list(`?from=${today}&to=${today}`)).length, 3, "dates are Manila calendar days");
  assert.equal((await list("?to=2020-01-01")).length, 0);

  const up = await u.super.put(`/api/submissions/${a}`, { status: "in_progress" });
  assert.equal(up.status, 200);
  assert.equal(up.data.status, "in_progress");
  assert.equal(up.data.updated_by, "super.admin@example.test");
  assert.deepEqual(await list("?status=in_progress"), [a]);
  await u.super.put(`/api/submissions/${a}`, { status: "completed", kind: "genuine" });
  assert.equal((await u.super.put(`/api/submissions/${a}`, { status: "deleted" })).status, 400);
  assert.equal((await u.super.put(`/api/submissions/${a}`, { kind: "vip" })).status, 400);
  const audit = (await app.store.list("audit_log")).filter((x) => x.record_id === a);
  assert.deepEqual(audit.map((x) => x.detail), ["status new → in_progress", "status in_progress → completed, type test → genuine"]);
  assert.ok(audit.every((x) => !x.detail.includes("@")), "no personal data in the audit log");
  assert.equal((await u.super.get("/api/submissions/sub_missing")).status, 404);
  cleanup();
});
