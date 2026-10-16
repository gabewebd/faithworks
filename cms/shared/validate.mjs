// Normalize and validate record data. Used by the server (authoritative) and the dashboard
// (instant feedback). Drafts may be incomplete; `strict` (submit, approve, publish) checks
// every required field.
import { fieldsOf, emptyValue } from "./schema.mjs";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function slugify(s) {
  return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
}

// Accepts absolute http(s) URLs, site-relative paths (/learn/), in-page anchors (#register),
// mailto: and tel:. Everything else (javascript:, data:, protocol-relative //host) is rejected.
export function checkUrl(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (/[\u0000-\u001f\u007f\s]/.test(v)) return "URLs cannot contain spaces or control characters.";
  if (v.startsWith("#")) return null;
  if (v.startsWith("/")) return v.startsWith("//") ? "Use a full address starting with https://." : null;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(v) || /^tel:\+?[0-9 ()-]{5,}$/i.test(v)) return null;
  let u;
  try { u = new URL(v); } catch { return "Enter a full address starting with https:// or a site path starting with /."; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "Only https://, http://, mailto: and tel: links are allowed.";
  if (u.username || u.password) return "URLs cannot contain a username or password.";
  return null;
}

function toList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  return String(v ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}
function toBool(v) { return v === true || v === "true" || v === "TRUE" || v === "1" || v === 1 || v === "yes" || v === "on"; }

// Coerce raw input into the field's type. Unknown keys are dropped.
export function normalize(collection, input) {
  const out = {};
  for (const fd of fieldsOf(collection)) {
    const v = input?.[fd.key];
    if (v === undefined || v === null) { out[fd.key] = emptyValue(fd); continue; }
    switch (fd.type) {
      case "list": out[fd.key] = toList(v); break;
      case "authors": out[fd.key] = [...new Set((Array.isArray(v) ? v : String(v).split(",")).map((t) => String(t).trim().toLowerCase()).filter(Boolean))]; break;
      case "tags": out[fd.key] = [...new Set((Array.isArray(v) ? v : String(v).split(",")).map((t) => String(t).trim().toLowerCase()).filter(Boolean))]; break;
      case "boolean": out[fd.key] = toBool(v); break;
      case "number": {
        const s = String(v).trim();
        out[fd.key] = s === "" ? null : Number(s);
        break;
      }
      case "pairs": {
        const arr = Array.isArray(v) ? v : [];
        out[fd.key] = arr.map((row) => Object.fromEntries(fd.subfields.map((sf) => [sf.key, String(row?.[sf.key] ?? "").trim()])))
          .filter((row) => Object.values(row).some(Boolean));
        break;
      }
      case "json": out[fd.key] = v && typeof v === "object" ? v : null; break;
      case "html": case "css": case "textarea": out[fd.key] = String(v).replace(/\r\n/g, "\n"); break;
      default: out[fd.key] = String(v).trim();
    }
  }
  return out;
}

const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

// Returns { field: message } for every problem found.
export function validate(collection, rec, { strict = false, tags = null, refs = null, authors = null } = {}) {
  const errors = {};
  for (const fd of fieldsOf(collection)) {
    if (fd.legacy || fd.computed) continue; // kept as stored; no longer edited
    if (fd.showIf && !fd.showIf(rec)) continue; // does not apply (e.g. another resource type)
    const v = rec[fd.key];
    if (isEmpty(v)) {
      const alwaysNeeded = fd.key === "title" || (collection === "testimonials" && fd.key === "display_name") || (collection === "settings" && fd.key === "brand");
      if ((strict && fd.required) || alwaysNeeded) errors[fd.key] = `${fd.label} is required.`;
      continue;
    }
    if (fd.max && typeof v === "string" && v.length > fd.max) errors[fd.key] = `${fd.label} must be ${fd.max} characters or fewer.`;
    if (fd.pattern && typeof v === "string" && !new RegExp(fd.pattern).test(v)) errors[fd.key] = `${fd.label} is not in the expected format.`;
    switch (fd.type) {
      case "slug": if (!SLUG_RE.test(v) || v.length > 80) errors[fd.key] = "Use lowercase letters, numbers and single hyphens (e.g. ai-for-teams)."; break;
      case "url": { const e = checkUrl(v); if (e) errors[fd.key] = e; break; }
      case "email": if (!EMAIL_RE.test(v)) errors[fd.key] = "Enter a valid email address."; break;
      case "date": if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v + "T00:00:00Z"))) errors[fd.key] = "Use a valid date (YYYY-MM-DD)."; break;
      case "time": if (!TIME_RE.test(v)) errors[fd.key] = "Use a 24-hour time (HH:MM)."; break;
      case "number": if (!Number.isInteger(v) || v < 0) errors[fd.key] = `${fd.label} must be a whole number of 0 or more.`; break;
      case "select": if (!fd.options.some((o) => o.value === v)) errors[fd.key] = `Choose a valid ${fd.label.toLowerCase()}.`; break;
      case "authors": {
        const bad = v.filter((e) => !EMAIL_RE.test(e));
        if (bad.length) errors[fd.key] = `Not an email address: ${bad.join(", ")}`;
        else if (authors) { const unknown = v.filter((e) => !authors.has(e)); if (unknown.length) errors[fd.key] = `Not on the CMS user list: ${unknown.join(", ")}`; }
        break;
      }
      case "tags": if (tags) { const bad = v.filter((t) => !tags.has(t)); if (bad.length) errors[fd.key] = `Unknown tag: ${bad.join(", ")}. Create it first.`; } break;
      case "ref": if (refs && !refs.has(v)) errors[fd.key] = "The selected item no longer exists."; break;
      case "pairs":
        for (const sf of fd.subfields) {
          if (sf.type === "url") for (const row of v) { const e = row[sf.key] && checkUrl(row[sf.key]); if (e) errors[fd.key] = `${sf.label}: ${e}`; }
        }
        if (strict && v.some((row) => fd.subfields.some((sf) => !row[sf.key]))) errors[fd.key] = `Complete every row of ${fd.label}, or remove empty rows.`;
        break;
      case "html": case "css": if (v.length > 45000 * (fd.long || 1)) errors[fd.key] = `${fd.label} is too long to store (${v.length.toLocaleString()} characters).`; break;
    }
  }
  // Collection-specific rules
  const imgPairs = [["featured_image_url", "featured_image_alt"], ["cover_image_url", "cover_image_alt"]];
  for (const [u, a] of imgPairs) if (strict && rec[u] && !rec[a] && rec[a] !== undefined) errors[a] = "Describe the image (alt text) for screen readers.";
  if (collection === "events") {
    if (rec.end_date && !rec.event_date) errors.end_date = "Add the start date first.";
    else if (rec.end_date && rec.end_date < rec.event_date) errors.end_date = "The end date must be on or after the start date.";
    else if (rec.start_time && rec.end_time && (!rec.end_date || rec.end_date === rec.event_date) && rec.end_time <= rec.start_time) errors.end_time = "End time must be after the start time.";
    if (strict && rec.cta_type === "external" && !rec.registration_url) errors.registration_url = "An external destination needs its registration URL.";
    if (strict && rec.cta_type === "internal" && !String(rec.registration_url || "").startsWith("/")) errors.registration_url = "An internal destination needs a site path starting with /.";
    if (strict && !rec.event_date && !rec.date_label) errors.date_label = "Add a date, or the text to show while no date is set.";
  }
  if (collection === "resources" && strict && rec.resource_type !== "article" && !rec.file_url) errors.file_url = "Guides, downloads and external resources need a file URL or link.";
  if (collection === "resources" && strict && rec.resource_type === "article" && !String(rec.body_html || "").trim()) errors.body_html = "An article needs its content.";
  if (collection === "programs" && strict && Number(rec.doc_version) >= 2 && !String(rec.body_html || "").trim()) errors.body_html = "A program needs its page content.";
  return errors;
}

// Publishing a testimonial needs recorded consent and an admin's display approval (brief §6, decision D7).
export function testimonialPublishable(rec) {
  const problems = [];
  if (rec.consent_status !== "obtained") problems.push("Consent is not recorded as obtained.");
  if (!String(rec.consent_evidence || "").trim()) problems.push("Consent evidence is missing.");
  if (rec.display_approved !== true) problems.push("Display approval has not been given.");
  return problems;
}
