// What may leave the CMS. toPublic() turns a record into its public payload: internal fields
// (owners, consent evidence, review notes, editors' emails) are dropped and page HTML/CSS are
// sanitized. buildSnapshot() assembles the content the website is built from:
//   view "published": only live copies from the `published` tab (what the public site shows);
//   view "preview":   current working copies, for staging builds only (never indexable).
import { COLLECTIONS, ALL_COLLECTIONS, publicPath } from "./schema.mjs";
import { sanitizeHtml, DEFAULT_IFRAME_HOSTS } from "./sanitize-html.mjs";
import { sanitizeCss } from "./sanitize-css.mjs";
import { testimonialPublishable } from "./validate.mjs";

export function toPublic(collection, rec, { iframeHosts = DEFAULT_IFRAME_HOSTS } = {}) {
  const out = { id: rec.id, version: Number(rec.version) || 0 };
  const doc = Number(rec.doc_version) >= 2;
  for (const fd of COLLECTIONS[collection].fields) {
    if (fd.public === false || fd.type === "css") continue;
    if (fd.legacy && doc) continue; // page documents carry this content in the page itself
    out[fd.key] = rec[fd.key];
  }
  if ("body_html" in out) {
    const { html, css: extracted } = sanitizeHtml(rec.body_html || "", { iframeHosts, extractStyles: true });
    out.body_html = html;
    out.body_css = [sanitizeCss(rec.body_css || "").css, extracted].filter((x) => x.trim()).join("\n");
  }
  if (collection === "testimonials") out.consent_ok = testimonialPublishable(rec).length === 0;
  const prev = String(rec.previous_slugs || "").split(",").map((s) => s.trim()).filter((s) => s && s !== rec.slug);
  if (prev.length) out.previous_slugs = prev;
  return out;
}

const HIDDEN_IN_PREVIEW = new Set(["archived", "rejected"]);
const bySortThenTitle = (a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9) || String(a.title || a.display_name || "").localeCompare(String(b.title || b.display_name || ""));

export function buildSnapshot({ records = {}, published = [], tags = [], view = "published", now = new Date(), iframeHosts } = {}) {
  const snap = { view, generated_at: now.toISOString(), settings: null, tags: [], redirects: [] };
  for (const c of ALL_COLLECTIONS) if (c !== "settings") snap[c] = [];

  if (view === "published") {
    for (const row of published) {
      if (row.state !== "live" || !row.payload || !COLLECTIONS[row.collection]) continue;
      if (row.collection === "settings") snap.settings = row.payload;
      else snap[row.collection].push(row.payload);
    }
    snap.testimonials = snap.testimonials.filter((t) => t.consent_ok === true); // never show proof without consent
  } else if (view === "preview") {
    for (const c of ALL_COLLECTIONS) {
      for (const rec of records[c] || []) {
        if (rec.deleted_at || HIDDEN_IN_PREVIEW.has(rec.status)) continue;
        if (c === "testimonials" && ["declined", "withdrawn"].includes(rec.consent_status)) continue;
        const p = toPublic(c, rec, { iframeHosts });
        p.status = rec.status;
        if (c === "settings") snap.settings = p;
        else snap[c].push(p);
      }
    }
  } else throw new Error(`Unknown view: ${view}`);

  for (const c of ALL_COLLECTIONS) if (c !== "settings") snap[c].sort(bySortThenTitle);
  snap.tags = tags.filter((t) => !t.archived && !t.deleted_at).map((t) => ({ id: t.id, label: t.label }));
  for (const c of ["programs", "events", "resources"]) {
    for (const p of snap[c]) for (const old of p.previous_slugs || []) snap.redirects.push({ from: publicPath(c, old), to: publicPath(c, p.slug) });
  }
  return snap;
}

// Minimal structural check of a snapshot received over the network (public build).
export function checkSnapshot(snap) {
  const problems = [];
  if (!snap || typeof snap !== "object") return ["The content response is not an object."];
  if (!["published", "preview"].includes(snap.view)) problems.push("Unknown snapshot view.");
  for (const c of ALL_COLLECTIONS) if (c !== "settings" && !Array.isArray(snap[c])) problems.push(`Missing ${c} list.`);
  if (!snap.settings) problems.push("Site settings have never been published. Publish them in the CMS first.");
  else if (!snap.settings.origin) problems.push("Site settings have no website address (origin).");
  return problems;
}
