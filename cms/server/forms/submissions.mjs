// Website form submissions: capture, team alerts, the Google Sheets copy, and the CMS screens.
//
// The canonical record is the cms_form_submissions row in Supabase (JSON store locally). Order of
// work for every submission, whichever provider delivered it (adapters.mjs):
//   1. validate (cms/shared/forms.mjs) and classify: genuine, spam (honeypot, too fast) or test;
//   2. store it once: the row id is derived from provider + provider id, so a retried or
//      repeated delivery finds the existing row and changes nothing (no second alert either);
//   3. only then send the team email and the Sheets copy. Each has its own state (pending →
//      sending → sent | failed) on the row; a failure never removes or hides the submission, it
//      is shown in the CMS and retried by the scheduled job (netlify/functions/forms-retry.mjs)
//      or by a Super Admin (Retry).
// Updates are read-modify-write guarded by write_id, so an alert finishing at the same moment as
// a status change never overwrites it. Rows are never deleted.
//
// Logs contain submission ids and error codes only, never answers, names or email addresses.
import { createHash, createHmac } from "node:crypto";
import { HttpError, now, randomId } from "../http.mjs";
import { FORMS, validateAnswers, SUBMISSION_STATUSES, SUBMISSION_KINDS } from "../../shared/forms.mjs";
import { isSuperAdmin } from "../../shared/schema.mjs";

export const TAB = "form_submissions";
const RATE_WINDOW_MS = 10 * 60_000;
const MIN_FILL_MS = 2500;          // the browser form's own time trap (js/forms.js)
const STALE_SENDING_MS = 10 * 60_000;
export const MAX_AUTO_ATTEMPTS = 6;
const TEST_DOMAINS = /@(example\.(com|org|net)|[a-z0-9-]+\.test|test\.invalid)$/i;
const CHANNELS = { notify: "notify", sheets: "sheets" };

export const submissionId = (provider, providerId) => `sub_${createHash("sha256").update(`${provider}:${providerId}`).digest("hex").slice(0, 32)}`;

export function createSubmissions({ store, cfg, audit, notifier, mirror, log = console, clock = () => Date.now() }) {
  const f = cfg.forms;
  const ipHash = (ip) => (ip ? createHmac("sha256", cfg.sessionSecret).update(`forms-ip:${ip}`).digest("hex").slice(0, 32) : "");
  const requireAdmin = (user) => { if (!isSuperAdmin(user?.role)) throw new HttpError(403, "Only Super Admins can see form submissions.", "forbidden"); };

  // Read-modify-write with the row's write_id; retried on a concurrent change.
  async function patch(id, change) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const cur = await store.get(TAB, id);
      if (!cur) throw new HttpError(404, "This submission no longer exists.", "not_found");
      const next = change(cur);
      if (!next) return cur;
      try {
        return await store.update(TAB, id, { ...cur, ...next, version: (cur.version || 1) + 1, write_id: randomId("w", 6) }, { expectWriteId: cur.write_id });
      } catch (e) {
        if (e.code !== "conflict" || attempt === 4) throw e;
      }
    }
  }

  function classify(n, answers) {
    if (n.honeypot) return { kind: "spam", spam_reason: "Hidden spam-trap field was filled in." };
    if (n.elapsed_ms !== null && n.elapsed_ms < MIN_FILL_MS) return { kind: "spam", spam_reason: `Sent ${Math.round(n.elapsed_ms)} ms after the form loaded (faster than a person can type).` };
    const name = answers[FORMS[n.form_id].nameField] || "";
    if (TEST_DOMAINS.test(answers.email || "") || /^\s*\[?test\]?\b/i.test(name)) return { kind: "test", spam_reason: "" };
    return { kind: "genuine", spam_reason: "" };
  }

  /* ---- Capture ---- */
  // Returns { id, duplicate }. Throws 422 with field errors, 429 when rate-limited.
  async function capture(n, { ip = "" } = {}) {
    const id = submissionId(n.provider, n.provider_id);
    const existing = await store.get(TAB, id);
    if (existing) return { id, duplicate: true, record: existing };

    const { answers, errors } = validateAnswers(n.form_id, n.input);
    const cls = classify(n, answers);
    // Website submissions must be valid (the browser checks the same rules first). Netlify has
    // already accepted its submission, so it is kept with what is valid and the problems noted.
    if (errors.length && n.provider === "cms_endpoint" && cls.kind !== "spam") throw new HttpError(422, "Please check the highlighted fields.", "invalid", { fields: errors });

    const hash = ipHash(ip || n.ip);
    if (hash && n.provider === "cms_endpoint") {
      const recent = await store.query(TAB, { eq: { ip_hash: hash }, gte: { received_at: new Date(clock() - RATE_WINDOW_MS).toISOString() }, order: "received_at.desc", limit: f.rateLimit });
      if (recent.length >= f.rateLimit) throw new HttpError(429, "Too many requests from this connection. Please wait a few minutes and try again.", "rate_limited");
    }

    const delivers = cls.kind !== "spam";
    const record = {
      id, provider: n.provider, provider_id: n.provider_id, form_id: n.form_id,
      name: answers[FORMS[n.form_id].nameField] || "", email: answers.email || "",
      answers, context: { ...n.context, ...(errors.length ? { validation_errors: errors } : {}) },
      status: "new", kind: cls.kind, spam_reason: cls.spam_reason, ip_hash: hash,
      submitted_at: n.submitted_at || "", received_at: new Date(clock()).toISOString(),
      notify_state: delivers && notifier.enabled ? "pending" : "off", notify_attempts: 0, notify_error: "", notified_at: "",
      sheets_state: delivers && mirror.enabled ? "pending" : "off", sheets_attempts: 0, sheets_error: "", sheets_at: "",
      version: 1, write_id: randomId("w", 6), updated_at: "", updated_by: "",
    };
    try {
      await store.insert(TAB, record);
    } catch (e) {
      // The same submission arriving twice at the same moment: the other request stored it.
      if (e.code === "duplicate_id") return { id, duplicate: true, record: await store.get(TAB, id) };
      throw e;
    }
    return { id, duplicate: false, record };
  }

  /* ---- Delivery (alert email, Sheets copy) ---- */
  const due = (sub, ch, { manual = false } = {}) => {
    const state = sub[`${ch}_state`];
    if (state === "pending") return true;
    if (state === "failed") return manual || (sub[`${ch}_attempts`] || 0) < MAX_AUTO_ATTEMPTS;
    if (state === "sending") return clock() - Date.parse(sub.updated_at || sub.received_at) > STALE_SENDING_MS;
    return false;
  };

  async function deliverChannel(id, ch, opts) {
    const worker = ch === CHANNELS.notify ? notifier : mirror;
    if (!worker.enabled) return null;
    let claimed;
    try {
      claimed = await patch(id, (cur) => (due(cur, ch, opts)
        ? { [`${ch}_state`]: "sending", [`${ch}_attempts`]: (cur[`${ch}_attempts`] || 0) + 1, updated_at: new Date(clock()).toISOString(), updated_by: "system" }
        : null));
    } catch (e) {
      log.error(`Form submission ${id}: could not start ${ch} (${e.code || e.message}).`);
      return false;
    }
    if (claimed[`${ch}_state`] !== "sending") return null; // not due, or another worker has it
    let result;
    try { result = ch === CHANNELS.notify ? await worker.send(claimed) : await worker.write(claimed); }
    catch (e) { result = { ok: false, error: String(e.message || "error").slice(0, 200) }; }
    const at = new Date(clock()).toISOString();
    try {
      await patch(id, () => (result.ok
        ? { [`${ch}_state`]: "sent", [`${ch}_error`]: "", [ch === CHANNELS.notify ? "notified_at" : "sheets_at"]: at, updated_at: at, updated_by: "system" }
        : { [`${ch}_state`]: "failed", [`${ch}_error`]: result.error, updated_at: at, updated_by: "system" }));
    } catch (e) {
      // Left as "sending": the retry job picks it up after STALE_SENDING_MS.
      log.error(`Form submission ${id}: ${ch} finished but its state was not saved (${e.code || e.message}).`);
    }
    if (!result.ok) log.error(`Form submission ${id}: ${ch} failed: ${result.error}`);
    return result.ok;
  }

  async function deliver(id, opts) {
    return { notify: await deliverChannel(id, CHANNELS.notify, opts), sheets: await deliverChannel(id, CHANNELS.sheets, opts) };
  }

  // Scheduled retry: everything pending, failed (under the attempt limit) or stuck in "sending".
  async function processPending({ limit = 50 } = {}) {
    const ids = new Set();
    for (const ch of Object.values(CHANNELS)) {
      for (const r of await store.query(TAB, { in: { [`${ch}_state`]: ["pending", "failed", "sending"] }, order: "received_at.asc", limit })) if (due(r, ch)) ids.add(r.id);
    }
    const out = { checked: ids.size, sent: 0, failed: 0 };
    for (const id of ids) {
      const r = await deliver(id);
      for (const v of Object.values(r)) { if (v === true) out.sent++; else if (v === false) out.failed++; }
    }
    return out;
  }

  /* ---- CMS (Super Admins only) ---- */
  const summary = (r) => ({
    id: r.id, form_id: r.form_id, provider: r.provider, name: r.name, email: r.email, status: r.status, kind: r.kind, received_at: r.received_at,
    notify_state: r.notify_state, sheets_state: r.sheets_state, has_error: r.notify_state === "failed" || r.sheets_state === "failed",
  });

  async function list(user, { q = "", form = "", status = "", kind = "", from = "", to = "" } = {}) {
    requireAdmin(user);
    const eq = {};
    if (form) eq.form_id = form;
    if (status) eq.status = status;
    const within = kind === "not_spam" ? { kind: ["genuine", "test"] } : {};
    if (kind && kind !== "not_spam") eq.kind = kind;
    const gte = /^\d{4}-\d{2}-\d{2}$/.test(from) ? { received_at: new Date(`${from}T00:00:00+08:00`).toISOString() } : {};
    const lt = /^\d{4}-\d{2}-\d{2}$/.test(to) ? { received_at: new Date(Date.parse(`${to}T00:00:00+08:00`) + 86_400_000).toISOString() } : {};
    const LIMIT = 1000;
    let rows = await store.query(TAB, { eq, in: within, gte, lt, order: "received_at.desc", limit: LIMIT });
    const truncated = rows.length >= LIMIT;
    const needle = q.trim().toLowerCase();
    if (needle) rows = rows.filter((r) => [r.name, r.email, ...Object.values(r.answers || {})].some((v) => String(v).toLowerCase().includes(needle)));
    return { items: rows.map(summary), truncated, setup: setup() };
  }

  async function get(user, id) {
    requireAdmin(user);
    const r = await store.get(TAB, id);
    if (!r) throw new HttpError(404, "This submission does not exist.", "not_found");
    const { ip_hash, ...rest } = r;
    return { ...rest, setup: setup() };
  }

  async function update(user, id, { status, kind } = {}, { requestId } = {}) {
    requireAdmin(user);
    if (status !== undefined && !SUBMISSION_STATUSES[status]) throw new HttpError(400, "Unknown status.", "bad_request");
    if (kind !== undefined && !SUBMISSION_KINDS[kind]) throw new HttpError(400, "Unknown type.", "bad_request");
    let before;
    const rec = await patch(id, (cur) => {
      before = cur;
      const next = {};
      if (status !== undefined && status !== cur.status) next.status = status;
      if (kind !== undefined && kind !== cur.kind) next.kind = kind;
      return Object.keys(next).length ? { ...next, updated_at: now(), updated_by: user.email } : null;
    });
    const changes = [status !== undefined && before.status !== rec.status ? `status ${before.status} → ${rec.status}` : "", kind !== undefined && before.kind !== rec.kind ? `type ${before.kind} → ${rec.kind}` : ""].filter(Boolean);
    if (changes.length) await audit(user, "submission_update", TAB, id, rec.version, changes.join(", "), requestId);
    return get(user, id);
  }

  async function retry(user, id, { requestId } = {}) {
    requireAdmin(user);
    const r = await store.get(TAB, id);
    if (!r) throw new HttpError(404, "This submission does not exist.", "not_found");
    const result = await deliver(id, { manual: true });
    await audit(user, "submission_retry", TAB, id, r.version, `alert: ${result.notify ?? "not due"}, sheets: ${result.sheets ?? "not due"}`, requestId);
    return { result, submission: await get(user, id) };
  }

  function setup() {
    return {
      endpoint: f.allowedOrigins.length > 0, email: notifier.enabled, sheets: mirror.enabled, netlify: !!f.netlifySecret,
      problems: f.problems,
    };
  }

  return { capture, deliver, processPending, list, get, update, retry, setup, enabled: () => f.allowedOrigins.length > 0 };
}
