// Submission providers. Each adapter turns one provider's request into the same neutral shape;
// everything after that (validation, storage, the CMS screens) is provider-independent.
//
//   cms_endpoint   The website's own forms (js/main.js) POST JSON to /api/forms/submit. Works on
//                  any host: the CMS API receives it directly.
//
// Every other website form is a GoHighLevel embed; GHL stores and follows up on those. Rows
// stored earlier with provider "netlify_forms" are kept and still shown.
//
// Neutral shape: { provider, provider_id, form_id, input (raw answers), context, submitted_at,
// honeypot, elapsed_ms, ip }.
import { HttpError } from "../http.mjs";
import { FORMS } from "../../shared/forms.mjs";

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const str = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max) : "");
const isoOrNull = (v) => (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

/* ---- Website forms (js/main.js) ---- */
export function fromWebsite(body) {
  if (!body || typeof body !== "object") throw new HttpError(400, "Send the form as JSON.", "bad_request");
  const formId = body.form_id;
  if (typeof formId !== "string" || !FORMS[formId]) throw new HttpError(400, "Unknown form.", "unknown_form");
  if (typeof body.request_id !== "string" || !TOKEN.test(body.request_id)) throw new HttpError(400, "A request id is required.", "bad_request");
  const utm = {};
  for (const k of UTM_KEYS) if (body.utm && typeof body.utm[k] === "string" && body.utm[k].trim()) utm[k] = str(body.utm[k], 200);
  const c = body.consent && typeof body.consent === "object" ? body.consent : null;
  const sourcePage = str(body.source_page, 300);
  return {
    provider: "cms_endpoint",
    provider_id: body.request_id,
    form_id: formId,
    input: body.fields,
    context: {
      offer_id: TOKEN.test(body.offer_id || "") ? body.offer_id : "",
      offer_title: str(body.offer_title, 200),
      source_page: sourcePage.startsWith("/") ? sourcePage : "",
      utm,
      consent: c ? {
        marketing: c.marketing === "yes" ? "yes" : "no",
        wording: c.marketing === "yes" ? str(c.wording, 500) : "",
        wording_version: str(c.wording_version, 80),
        recorded_at: isoOrNull(c.recorded_at),
      } : null,
    },
    submitted_at: isoOrNull(body.submitted_at),
    honeypot: typeof body.hp === "string" ? body.hp : "",
    elapsed_ms: Number.isFinite(body.elapsed_ms) ? body.elapsed_ms : null,
  };
}
