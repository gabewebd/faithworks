// Website form submissions: the shared form definitions, the public endpoint (validation, CORS,
// spam, test records, rate limits, duplicates), team email alerts (Resend, faked here), the Google
// Sheets copy (faked Sheets API), retries after failures, Netlify Forms webhooks, and the Super
// Admin screens' API. No real email is sent and no real spreadsheet or database is touched: every
// outside service is an in-memory fake, and every submission here is a labelled test record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { testApp, signedIn } from "./helpers.mjs";
import { FORMS, FORM_IDS, validateAnswers } from "../shared/forms.mjs";
import { formsConfig, recipientsFor, DEFAULT_NOTIFY_TO } from "../server/config.mjs";
import { alertEmail } from "../server/forms/notify.mjs";
import { submissionId } from "../server/forms/submissions.mjs";
import * as R from "../../tools/render.mjs";

const ORIGIN = "https://example.test";
const EMAIL_ENV = {
  RESEND_API_KEY: "re_test_not_a_real_key", FORMS_EMAIL_FROM: "Faith Works Forms <forms@example.test>",
  FORMS_NOTIFY_TO: "team@example.test", FORMS_NOTIFY_TO_CORPORATE_INQUIRY: "corporate@example.test, owner@example.test",
};
const ENV = { FORMS_ALLOWED_ORIGINS: ORIGIN, CMS_BASE_URL: "http://localhost:5174", ...EMAIL_ENV };

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

// Resend fake: records each email; `faults` makes the next calls fail (HTTP status or "network").
function fakeResend() {
  const sent = [];
  const faults = [];
  let onSend = null;
  const fetchImpl = async (url, init) => {
    if (!String(url).startsWith("https://api.resend.com/emails")) throw new Error(`unexpected request to ${url}`);
    const f = faults.shift();
    if (f === "network") throw new TypeError("fetch failed");
    if (f) return new Response(JSON.stringify({ message: "Something went wrong" }), { status: f });
    if (onSend) await onSend();
    sent.push({ ...JSON.parse(init.body), key: init.headers["idempotency-key"], auth: init.headers.authorization });
    return new Response(JSON.stringify({ id: `em_${sent.length}` }), { status: 200 });
  };
  return { sent, faults, fetchImpl, set onSend(fn) { onSend = fn; } };
}

const rows = (app) => app.store.list("form_submissions");

/* ---- Shared definitions ---------------------------------------------------- */

test("the website renders exactly the fields the server accepts", () => {
  R.init({ events: [], programs: [], site: {} });
  const rendered = {
    starter_kit: R.starterKitForm(), corporate_inquiry: R.proposalForm(), speaking_inquiry: R.speakingForm(),
    faith_ai_demo: R.demoForm(), general_contact: R.contactForm(), event_notify: R.notifyForm(),
  };
  for (const [id, html] of Object.entries(rendered)) {
    assert.match(html, new RegExp(`data-fw-form="${id}"`));
    const names = [...html.matchAll(/<(?:input|select|textarea)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]).filter((n) => !["website", "consent_marketing"].includes(n));
    assert.deepEqual(names, [...FORMS[id].fields.map((f) => f.name), ...(FORMS[id].hidden || [])], `${id} fields`);
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

test("configuration: forms problems never stop the CMS, and per-form recipients override the default", () => {
  const f = formsConfig({ RESEND_API_KEY: "re_x", FORMS_NOTIFY_TO: "a@example.test, not-an-address", FORMS_ALLOWED_ORIGINS: "https://example.test/, http://evil.example" });
  assert.equal(f.email, false, "no sender, and an invalid recipient");
  assert.ok(f.problems.some((p) => /FORMS_EMAIL_FROM/.test(p)));
  assert.ok(f.problems.some((p) => /invalid address/.test(p)));
  assert.deepEqual(f.allowedOrigins, ["https://example.test"], "trailing slash removed; plain http refused");
  const { app, cleanup } = testApp({ env: { RESEND_API_KEY: "re_x" } });
  assert.deepEqual(app.cfg.errors, [], "the CMS itself stays configured");
  cleanup();
  const g = formsConfig(EMAIL_ENV);
  assert.equal(g.email, true);
  assert.deepEqual(g.notifyToByForm.corporate_inquiry, ["corporate@example.test", "owner@example.test"]);
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
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: fakeResend().fetchImpl });
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

test("a valid submission is stored first, then the team is emailed with a link and no private details", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
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
  assert.equal(row.notify_state, "sent");
  assert.equal(row.notify_attempts, 1);
  assert.equal(row.sheets_state, "off", "no Sheets copy unless FORMS_SHEETS_MIRROR=true");

  assert.equal(mail.sent.length, 1);
  const m = mail.sent[0];
  assert.deepEqual(m.to, ["corporate@example.test", "owner@example.test"], "per-form recipients");
  assert.equal(m.from, EMAIL_ENV.FORMS_EMAIL_FROM);
  assert.equal(m.key, `${row.id}-alert`, "idempotency key = the submission");
  assert.match(m.subject, /^New Corporate inquiry: Dana Cruz$/);
  assert.match(m.text, new RegExp(`http://localhost:5174/#/submissions/${row.id}`));
  assert.match(m.text, /Received: .*\(Manila\)/);
  for (const detail of ["Company: Test Company", "Team size: 11–50", "practical AI for the team", "Sent from: /business/"]) {
    assert.ok(m.text.includes(detail), `email includes: ${detail}`);
  }
  assert.ok(!m.text.includes("dana@genuine.invalid") && !m.html.includes("dana@genuine.invalid"), "email leaves out the address");
  cleanup();
});

test("invalid answers are refused with field messages the form can show (and CORS headers)", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: fakeResend().fetchImpl });
  const r = await submit(app, body({}, { email: "nope", goals: "" }));
  assert.equal(r.status, 422);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN, "the browser can read the error");
  assert.deepEqual(r.data.error.fields.map((f) => f.field).sort(), ["email", "goals"]);
  assert.equal((await submit(app, { ...body(), form_id: "admin" })).status, 400);
  assert.equal((await submit(app, { ...body(), request_id: "../x" })).status, 400);
  assert.equal((await rows(app)).length, 0, "nothing stored");
  cleanup();
});

test("duplicates: the same request id (retry, double click, replay) is stored and emailed once", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
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
  assert.equal(mail.sent.length, 1);
  cleanup();
});

test("spam: the honeypot or an instant submit is kept as spam, answered like success, and never emailed", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
  const hp = await submit(app, body({ hp: "http://spam.example" }, { email: "garbage" }));
  const fast = await submit(app, body({ elapsed_ms: 300 }));
  assert.equal(hp.status, 201, "a bot is not told it was caught");
  assert.equal(fast.status, 201);
  const all = await rows(app);
  assert.deepEqual(all.map((r) => r.kind), ["spam", "spam"]);
  assert.ok(all.every((r) => r.notify_state === "off" && r.spam_reason));
  assert.equal(mail.sent.length, 0);
  cleanup();
});

test("test records: example/test addresses or a [TEST] name are labelled, and their alert says TEST", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
  await submit(app, body());
  await submit(app, body({}, { name: "Test person", email: "someone@genuine.invalid" }));
  assert.deepEqual((await rows(app)).map((r) => r.kind), ["test", "test"]);
  assert.match(mail.sent[0].subject, /^\[TEST\] /);
  assert.match(mail.sent[0].text, /TEST SUBMISSION/);
  cleanup();
});

test("rate limit: a connection gets FORMS_RATE_LIMIT submissions per 10 minutes", async () => {
  const { app, cleanup } = testApp({ env: { ...ENV, FORMS_RATE_LIMIT: "3" }, fetchImpl: fakeResend().fetchImpl });
  for (let i = 0; i < 3; i++) assert.equal((await submit(app, body())).status, 201);
  const blocked = await submit(app, body());
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal((await submit(app, body(), { "x-nf-client-connection-ip": "198.51.100.9" })).status, 201, "another connection is not affected");
  assert.equal((await rows(app)).length, 4);
  cleanup();
});

/* ---- Partial failures and retries ----------------------------------------------- */

test("email failure: the submission is kept, the error is shown, and a retry sends exactly one alert", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
  const u = await signedIn(app);
  mail.faults.push(500);
  const r = await submit(app, body());
  assert.equal(r.status, 201, "the visitor sees success: their submission is stored");
  let [row] = await rows(app);
  assert.equal(row.notify_state, "failed");
  assert.match(row.notify_error, /HTTP 500/);
  assert.equal(mail.sent.length, 0);

  const list = await u.super.get("/api/submissions");
  assert.equal(list.data.items[0].has_error, true, "flagged in the list");

  mail.faults.push("network");
  const auto = await app.services.forms.processPending();
  assert.deepEqual(auto, { checked: 1, sent: 0, failed: 1 });
  [row] = await rows(app);
  assert.equal(row.notify_attempts, 2);
  assert.match(row.notify_error, /could not be reached/);

  const manual = await u.super.post(`/api/submissions/${row.id}/retry`);
  assert.equal(manual.status, 200);
  assert.equal(manual.data.result.notify, true);
  assert.equal(manual.data.submission.notify_state, "sent");
  assert.equal(manual.data.submission.notify_error, "");
  assert.equal(mail.sent.length, 1);
  assert.equal(mail.sent[0].key, `${row.id}-alert`, "same idempotency key on every attempt");

  assert.deepEqual(await app.services.forms.processPending(), { checked: 0, sent: 0, failed: 0 }, "nothing left to do");
  const audit = await app.store.list("audit_log");
  assert.ok(audit.some((a) => a.action === "submission_retry" && a.record_id === row.id));
  cleanup();
});

test("automatic retries stop after 6 attempts; a Super Admin can still retry by hand", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
  mail.faults.push(503, 503, 503, 503, 503, 503, 503);
  await submit(app, body());
  for (let i = 0; i < 7; i++) await app.services.forms.processPending();
  const [row] = await rows(app);
  assert.equal(row.notify_attempts, 6);
  assert.equal(row.notify_state, "failed");
  const u = await signedIn(app);
  mail.faults.length = 0;
  assert.equal((await u.super.post(`/api/submissions/${row.id}/retry`)).data.result.notify, true);
  cleanup();
});

test("an interrupted alert (stuck in sending) is picked up after 10 minutes, not before", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
  mail.faults.push(500);
  await submit(app, body());
  const [row] = await rows(app);
  await app.store.update("form_submissions", row.id, { ...row, notify_state: "sending", updated_at: new Date().toISOString(), write_id: "w_stuck" });
  assert.equal((await app.services.forms.processPending()).checked, 0);
  await app.store.update("form_submissions", row.id, { ...row, notify_state: "sending", updated_at: new Date(Date.now() - 11 * 60_000).toISOString(), write_id: "w_stuck2" });
  assert.deepEqual(await app.services.forms.processPending(), { checked: 1, sent: 1, failed: 0 });
  cleanup();
});

test("a status change made while an alert is being sent is not overwritten", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
  const u = await signedIn(app);
  mail.faults.push(500);
  await submit(app, body());
  const [row] = await rows(app);
  mail.onSend = async () => { await u.super.put(`/api/submissions/${row.id}`, { status: "in_progress" }); };
  await u.super.post(`/api/submissions/${row.id}/retry`);
  const [after] = await rows(app);
  assert.equal(after.status, "in_progress");
  assert.equal(after.notify_state, "sent");
  cleanup();
});

test("database unavailable: the visitor gets an error (never a false success) and can resend", async () => {
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: mail.fetchImpl });
  const insert = app.store.insert;
  app.store.insert = async () => { throw Object.assign(new Error("The CMS database (Supabase) could not be reached."), { status: 503, code: "db_unavailable" }); };
  const b = body();
  const r = await submit(app, b);
  assert.ok(r.status >= 500);
  assert.notEqual(r.data.ok, true);
  assert.equal(mail.sent.length, 0, "no alert for something not stored");
  app.store.insert = insert;
  assert.equal((await submit(app, b)).status, 201, "the browser's retry (same request id) succeeds");
  assert.equal((await rows(app)).length, 1);
  cleanup();
});

/* ---- Google Sheets copy ------------------------------------------------------- */

const { privateKey: SA_KEY } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const SHEETS_ENV = { ...ENV, FORMS_SHEETS_MIRROR: "true", GOOGLE_SHEETS_SPREADSHEET_ID: "sheet123", GOOGLE_SERVICE_ACCOUNT_EMAIL: "cms@project.iam.gserviceaccount.com", GOOGLE_PRIVATE_KEY: SA_KEY };

// Minimal Sheets API: metadata, addSheet, values get/update/append, plus Resend for alerts.
function fakeSheetsAndMail(tabs) {
  const sheets = structuredClone(tabs);
  const writes = [];
  const faults = [];
  const mail = fakeResend();
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const letter = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const range = (r) => { const m = decodeURIComponent(r).match(/^'((?:[^']|'')+)'(?:!(.*))?$/); return { tab: m[1].replace(/''/g, "'"), a1: m[2] || "" }; };
  const fetchImpl = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith("https://api.resend.com")) return mail.fetchImpl(url, init);
    if (url.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "tok", expires_in: 3600 });
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    const method = init.method || "GET";
    if (method !== "GET") writes.push({ path, method, body: init.body });
    const fault = faults.findIndex((f) => path.includes(f.match));
    if (fault >= 0) {
      const f = faults.splice(fault, 1)[0];
      if (f.status) return json({ error: { message: "backend error" } }, f.status);
      if (f.after) { const res = await handle(); throw new Error(`connection reset after ${res.status}`); }
    }
    return handle();
    async function handle() {
      if (path.endsWith(":batchUpdate")) {
        for (const r of JSON.parse(init.body).requests) if (r.addSheet) sheets[r.addSheet.properties.title] = [];
        return json({});
      }
      if (/\/spreadsheets\/[^/]+$/.test(path)) return json({ properties: { title: "Faith Works" }, sheets: Object.keys(sheets).map((title) => ({ properties: { title } })) });
      const m = path.match(/\/values\/(.+?)(:append)?$/);
      const { tab, a1 } = range(m[1]);
      const rows = sheets[tab];
      if (method === "GET") {
        if (a1 === "1:1") return json({ values: rows.slice(0, 1) });
        const c = a1.match(/^([A-Z]+)2:\1$/);
        if (c) return json({ values: rows.slice(1).map((r) => [r[letter(c[1])] ?? ""]) });
        return json({ values: rows });
      }
      assert.equal(u.searchParams.get("valueInputOption"), "RAW", "values are never parsed as formulas");
      if (m[2]) { rows.push(...JSON.parse(init.body).values); return json({}); }
      rows[0] = JSON.parse(init.body).values[0];
      return json({});
    }
  };
  return { sheets, writes, faults, mail, fetchImpl };
}

test("Sheets: creates its own tab, copies each submission once, and never writes any other tab", async () => {
  const existing = { programs: [["id", "title"], ["prg_1", "Kept as is"]], settings: [["id"], ["site"]] };
  const g = fakeSheetsAndMail(existing);
  const { app, cleanup } = testApp({ env: SHEETS_ENV, fetchImpl: g.fetchImpl });
  const b = body({}, { goals: "=HYPERLINK(\"http://x\")" });
  await submit(app, b);
  await submit(app, b); // duplicate
  await submit(app, body({ form_id: "general_contact", fields: { name: "[TEST] Lee", email: "lee@example.test", inquiry_type: "faith-ai", message: "TEST message" } }));
  const tab = g.sheets.form_submissions;
  assert.equal(tab[0][0], "submission_id");
  assert.equal(tab.length, 3, "header + two submissions");
  const [row] = await rows(app);
  assert.equal(row.sheets_state, "sent");
  assert.equal(tab[1][0], row.id);
  assert.ok(tab[1].join("|").includes("Team size: 11–50"), "answers by label");
  assert.ok(tab[2].join("|").includes("Inquiry type: Faith AI"), "option labels, not codes");
  assert.deepEqual(g.sheets.programs, existing.programs);
  assert.deepEqual(g.sheets.settings, existing.settings);
  for (const w of g.writes) assert.ok(w.path.endsWith(":batchUpdate") ? JSON.parse(w.body).requests.every((r) => r.addSheet?.properties.title === "form_submissions") : w.path.includes("'form_submissions'"), `write only to the new tab: ${w.path}`);
  cleanup();
});

test("Sheets: an existing tab's own column order is respected and hand-added columns are left empty", async () => {
  const g = fakeSheetsAndMail({ form_submissions: [["notes", "email", "submission_id", "form"], ["kept", "old@example.test", "sub_old", "Old"]] });
  const { app, cleanup } = testApp({ env: SHEETS_ENV, fetchImpl: g.fetchImpl });
  await submit(app, body());
  const [row] = await rows(app);
  assert.deepEqual(g.sheets.form_submissions[0], ["notes", "email", "submission_id", "form"], "header untouched");
  assert.deepEqual(g.sheets.form_submissions[1], ["kept", "old@example.test", "sub_old", "Old"], "existing rows untouched");
  assert.deepEqual(g.sheets.form_submissions[2], ["", "dana@example.test", row.id, "Corporate inquiry"]);
  cleanup();
});

test("Sheets failures: Google down → retried later; a lost reply after the append → no duplicate row", async () => {
  const g = fakeSheetsAndMail({});
  const { app, cleanup } = testApp({ env: SHEETS_ENV, fetchImpl: g.fetchImpl });
  g.faults.push({ match: ":append", status: 500 });
  await submit(app, body());
  let [row] = await rows(app);
  assert.equal(row.sheets_state, "failed");
  assert.equal(row.notify_state, "sent", "the email alert does not depend on Sheets");
  g.faults.push({ match: ":append", after: true });
  await app.services.forms.processPending();
  [row] = await rows(app);
  assert.equal(row.sheets_state, "failed", "the append landed but the reply was lost");
  await app.services.forms.processPending();
  [row] = await rows(app);
  assert.equal(row.sheets_state, "sent");
  assert.equal(g.sheets.form_submissions.filter((r) => r[0] === row.id).length, 1, "exactly one row");
  const u = await signedIn(app);
  assert.equal((await u.super.get(`/api/submissions/${row.id}`)).status, 200, "the CMS reads submissions without Google");
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
  const mail = fakeResend();
  const { app, cleanup } = testApp({ env: { ...ENV, NETLIFY_FORMS_WEBHOOK_SECRET: SECRET }, fetchImpl: mail.fetchImpl });
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
  assert.equal(mail.sent.length, 1);

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

test("only Super Admins can list, open, change or retry submissions", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: fakeResend().fetchImpl });
  const u = await signedIn(app);
  const { data } = await submit(app, body());
  for (const r of [await u.author.get("/api/submissions"), await u.author.get(`/api/submissions/${data.id}`),
    await u.author.put(`/api/submissions/${data.id}`, { status: "completed" }), await u.author.post(`/api/submissions/${data.id}/retry`)]) {
    assert.equal(r.status, 403);
  }
  assert.equal((await rows(app))[0].status, "new");
  const s = await u.super.get(`/api/submissions/${data.id}`);
  assert.equal(s.status, 200);
  assert.ok(!("ip_hash" in s.data), "the rate-limit hash is not shown");
  cleanup();
});

test("Super Admins search and filter by type, date and status, and change the status (audited)", async () => {
  const { app, cleanup } = testApp({ env: ENV, fetchImpl: fakeResend().fetchImpl });
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

test("alert email text (unit)", () => {
  const m = alertEmail({ id: "sub_1", form_id: "starter_kit", name: "<b>Ana</b>", kind: "genuine", received_at: "2026-10-21T01:30:00.000Z" }, { baseUrl: "https://cms.example" });
  assert.equal(m.subject, "New Starter Kit request: <b>Ana</b>");
  assert.match(m.html, /&lt;b&gt;Ana&lt;\/b&gt;/, "names are escaped in HTML");
  assert.match(m.text, /Received: Oct 21, 2026, 9:30\s?AM \(Manila\)/);
  assert.match(m.text, /https:\/\/cms\.example\/#\/submissions\/sub_1/);

  const long = "x".repeat(400);
  const c = alertEmail({ id: "sub_2", form_id: "general_contact", name: "Ben", kind: "genuine", received_at: "2026-10-21T01:30:00.000Z",
    answers: { name: "Ben", email: "ben@x.test", phone: "+63 900 000 0000", inquiry_type: "faith-ai", message: long } }, { baseUrl: "https://cms.example" });
  assert.match(c.text, /Inquiry type: Faith AI/, "option labels, not values");
  assert.match(c.text, /Message: x{300}… \(full text in the CMS\)/, "long text shortened");
  for (const s of ["ben@x.test", "+63 900"]) assert.ok(!c.text.includes(s) && !c.html.includes(s), `contact details left out: ${s}`);
  assert.ok(!/Name: Ben\n[\s\S]*Name: Ben/.test(c.text), "the name is not repeated");
});

test("alerts go to default recipient unless FORMS_NOTIFY_TO is set", () => {
  const f = formsConfig({ RESEND_API_KEY: "re_x", FORMS_EMAIL_FROM: "forms@example.test" });
  assert.equal(f.email, true);
  assert.deepEqual(FORM_IDS.map((id) => recipientsFor(f, id)), FORM_IDS.map(() => [DEFAULT_NOTIFY_TO]), "every form");
  assert.equal(formsConfig({ RESEND_API_KEY: "re_x", FORMS_EMAIL_FROM: "forms@example.test", FORMS_NOTIFY_TO: "nope" }).email, false, "an invalid override is not silently replaced");
});
