// Team email alert for a new submission, sent through Resend (https://resend.com) over HTTPS; no
// SDK. Server-side only (RESEND_API_KEY). The email says which form, who, when, what they asked
// about (the form's answers, long text shortened) and links to the submission in the signed-in
// CMS. Contact details (email address, phone) and consent records stay behind the CMS sign-in.
//
// Resend's Idempotency-Key (the submission id) makes a repeated send of the same alert, after a
// timeout or a retry, deliver at most one email within Resend's 24-hour idempotency window.
import { recipientsFor } from "../config.mjs";
import { FORMS, formLabel, optionValue } from "../../shared/forms.mjs";

const API = "https://api.resend.com/emails";

const manila = (iso) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) + " (Manila)";
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SNIPPET = 300;
const shorten = (v) => (v.length > SNIPPET ? `${v.slice(0, SNIPPET).trimEnd()}… (full text in the CMS)` : v);

// [label, value] for each answer worth reading in an inbox, in the form's own order.
function details(sub) {
  const form = FORMS[sub.form_id];
  if (!form) return [];
  const answers = sub.answers || {};
  const out = [];
  for (const f of form.fields) {
    const v = answers[f.name];
    if (!v || f.name === form.nameField || f.type === "email" || f.type === "tel") continue;
    const opt = Array.isArray(f.options) ? f.options.find((o) => optionValue(o) === v) : null;
    out.push([f.label, opt && typeof opt === "object" ? opt.label : shorten(String(v))]);
  }
  const ctx = sub.context || {};
  if (ctx.offer_title) out.push(["Offer", ctx.offer_title]);
  if (ctx.source_page) out.push(["Sent from", ctx.source_page]);
  return out;
}

export function alertEmail(sub, { baseUrl }) {
  const form = formLabel(sub.form_id);
  const test = sub.kind === "test";
  const link = `${baseUrl}/#/submissions/${encodeURIComponent(sub.id)}`;
  const name = sub.name || "(no name given)";
  const rows = [["Form", form], ["Name", name], ["Received", manila(sub.received_at)], ...details(sub)];
  return {
    subject: `${test ? "[TEST] " : ""}New ${form}: ${name}`.slice(0, 200),
    text: `${test ? "TEST SUBMISSION (not a real inquiry)\n\n" : ""}A new website submission arrived.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nOpen it in the CMS (sign-in required) for the email address and full answers:\n${link}\n`,
    html: `${test ? "<p><strong>TEST SUBMISSION (not a real inquiry)</strong></p>" : ""}<p>A new website submission arrived.</p><table cellpadding="4">${rows.map(([k, v]) => `<tr><td valign="top"><strong>${escapeHtml(k)}</strong></td><td style="white-space:pre-line">${escapeHtml(v)}</td></tr>`).join("")}</table><p><a href="${escapeHtml(link)}">Open it in the CMS</a> (sign-in required) for the email address and full answers.</p>`,
  };
}

export function createNotifier({ cfg, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
  const f = cfg.forms;
  return {
    enabled: f.email,
    async send(sub) {
      const to = recipientsFor(f, sub.form_id);
      if (!to.length) return { ok: false, error: `No recipients are configured for ${sub.form_id} (FORMS_NOTIFY_TO).` };
      const mail = alertEmail(sub, { baseUrl: cfg.baseUrl });
      let res;
      try {
        res = await fetchImpl(API, {
          method: "POST",
          headers: { authorization: `Bearer ${f.resendKey}`, "content-type": "application/json", "idempotency-key": `${sub.id}-alert` },
          body: JSON.stringify({ from: f.emailFrom, to, subject: mail.subject, text: mail.text, html: mail.html }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return { ok: false, error: "The email service (Resend) could not be reached." };
      }
      if (res.ok) return { ok: true };
      let detail = "";
      try { detail = (await res.json()).message || ""; } catch { /* not JSON */ }
      return { ok: false, error: `Resend refused the email (HTTP ${res.status})${detail ? `: ${String(detail).slice(0, 200)}` : ""}.` };
    },
  };
}
