// Submission providers. Each adapter turns one provider's request into the same neutral shape;
// everything after that (validation, storage, alerts, the CMS screens) is provider-independent.
//
//   cms_endpoint   The website's own forms (js/forms.js) POST JSON to /api/forms/submit. Works on
//                  any host (Vercel today, Netlify later): the CMS API receives it directly.
//   netlify_forms  Native Netlify Forms, if the website moves to Netlify and uses them: Netlify's
//                  outgoing "form submission" webhook POSTs to /api/forms/netlify, signed with a
//                  JWS secret (NETLIFY_FORMS_WEBHOOK_SECRET) that is verified before anything else.
//
// Neutral shape: { provider, provider_id, form_id, input (raw answers), context, submitted_at,
// honeypot, elapsed_ms, ip }.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "../http.mjs";
import { FORMS } from "../../shared/forms.mjs";

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const str = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max) : "");
const isoOrNull = (v) => (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

/* ---- Website forms (js/forms.js) ---- */
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

/* ---- Netlify Forms (outgoing webhook) ---- */
// Netlify signs the webhook with a JWS (HS256) in X-Webhook-Signature. Its payload names the
// issuer ("netlify") and the SHA-256 of the exact request body.
export function verifyNetlifySignature(rawBody, signature, secret) {
  const parts = String(signature || "").split(".");
  if (!secret || parts.length !== 3) return false;
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  let given;
  try { given = Buffer.from(parts[2], "base64url"); } catch { return false; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { return false; }
  if (header.alg !== "HS256" || claims.iss !== "netlify") return false;
  return claims.sha256 === createHash("sha256").update(rawBody).digest("hex");
}

export function fromNetlify(payload) {
  const formId = payload?.form_name;
  if (typeof formId !== "string" || !FORMS[formId]) throw new HttpError(422, "This Netlify form is not one of the website's forms.", "unknown_form");
  if (typeof payload.id !== "string" || !TOKEN.test(payload.id)) throw new HttpError(400, "The Netlify submission has no id.", "bad_request");
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const utm = {};
  for (const k of UTM_KEYS) if (typeof data[k] === "string" && data[k].trim()) utm[k] = str(data[k], 200);
  let sourcePage = "";
  try { sourcePage = new URL(data.referrer || "").pathname; } catch { /* no referrer */ }
  return {
    provider: "netlify_forms",
    provider_id: payload.id,
    form_id: formId,
    input: data,
    context: {
      offer_id: TOKEN.test(data.offer_id || "") ? data.offer_id : "",
      offer_title: str(data.offer_title, 200),
      source_page: sourcePage.slice(0, 300),
      utm,
      consent: data.consent_marketing !== undefined ? { marketing: data.consent_marketing === "yes" ? "yes" : "no", wording: "", wording_version: str(data.consent_wording_version, 80), recorded_at: null } : null,
    },
    submitted_at: isoOrNull(payload.created_at),
    // Netlify has already filtered spam (its webhook fires for verified submissions only).
    honeypot: "",
    elapsed_ms: null,
    ip: typeof data.ip === "string" ? data.ip : "",
  };
}
