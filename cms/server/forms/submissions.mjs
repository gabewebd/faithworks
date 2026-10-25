// Website form submissions that still post to the CMS (the designed forms; most forms are
// GoHighLevel embeds, whose alerts and follow-up happen in GoHighLevel): capture and the CMS screens.
//
// The canonical record is the cms_form_submissions row in Supabase (JSON store locally). For every
// submission, whichever provider delivered it (adapters.mjs):
//   1. validate (cms/shared/forms.mjs) and classify: genuine, spam (honeypot, too fast) or test;
//   2. store it once: the row id is derived from provider + provider id, so a retried or
//      repeated delivery finds the existing row and changes nothing.
// The CMS sends no email and copies nothing to Google Sheets. Updates are read-modify-write
// guarded by write_id. Rows are never deleted.
//
// Logs contain submission ids and error codes only, never answers, names or email addresses.
import { createHash, createHmac } from "node:crypto";
import { HttpError, now, randomId } from "../http.mjs";
import { FORMS, validateAnswers, SUBMISSION_STATUSES, SUBMISSION_KINDS } from "../../shared/forms.mjs";
import { isSuperAdmin } from "../../shared/schema.mjs";

export const TAB = "form_submissions";
const RATE_WINDOW_MS = 10 * 60_000;
const MIN_FILL_MS = 2500;          // the browser form's own time trap (js/forms.js)
const TEST_DOMAINS = /@(example\.(com|org|net)|[a-z0-9-]+\.test|test\.invalid)$/i;

export const submissionId = (provider, providerId) => `sub_${createHash("sha256").update(`${provider}:${providerId}`).digest("hex").slice(0, 32)}`;

export function createSubmissions({ store, cfg, audit, clock = () => Date.now() }) {
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

    const record = {
      id, provider: n.provider, provider_id: n.provider_id, form_id: n.form_id,
      name: answers[FORMS[n.form_id].nameField] || "", email: answers.email || "",
      answers, context: { ...n.context, ...(errors.length ? { validation_errors: errors } : {}) },
      status: "new", kind: cls.kind, spam_reason: cls.spam_reason, ip_hash: hash,
      submitted_at: n.submitted_at || "", received_at: new Date(clock()).toISOString(),
      // Columns of the retired email alert and Sheets copy, kept in the table for older rows
      notify_state: "off", notify_attempts: 0, notify_error: "", notified_at: "",
      sheets_state: "off", sheets_attempts: 0, sheets_error: "", sheets_at: "",
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

  /* ---- CMS (Super Admins only) ---- */
  const summary = (r) => ({
    id: r.id, form_id: r.form_id, provider: r.provider, name: r.name, email: r.email, status: r.status, kind: r.kind, received_at: r.received_at,
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

  function setup() {
    return { endpoint: f.allowedOrigins.length > 0, netlify: !!f.netlifySecret, problems: f.problems };
  }

  return { capture, list, get, update, setup, enabled: () => f.allowedOrigins.length > 0 };
}
