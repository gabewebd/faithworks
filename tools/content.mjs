// The website's content interface. tools/build.mjs asks for content here and never needs to
// know where it is stored. Two sources, one shape:
//
//   fixtures  cms/fixtures/seed.json (default; or cms/.data/store.json with --content=local)
//   cms       the CMS public endpoint (Supabase behind it): CMS_CONTENT_URL
//
// and two views:
//
//   published only live content (published, and not hidden). The production build.
//   preview   current drafts, for review on staging. Refused unless site settings say staging
//             (noindex + staging bar), so drafts can never reach an indexable production build.
//
// If the CMS cannot be reached the build stops (the host keeps serving the previous deploy).
// --allow-stale uses the last snapshot this machine fetched successfully (.cache/), clearly logged.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSnapshot, checkSnapshot } from "../cms/shared/public.mjs";
import { sanitizeHtml } from "../cms/shared/sanitize-html.mjs";
import { sanitizeCss, scopeCss } from "../cms/shared/sanitize-css.mjs";
import { upgradeRecord, extractList, extractText, readingTime, featuredImage, bylineOf, timeRange, eventInstant } from "../cms/shared/page-doc.mjs";
import { eventHasPage } from "../cms/shared/schema.mjs";
import { resolveImage } from "./gallery.mjs";
import { eventGalleryEntries } from "./event-gallery.mjs";
import { STATIC_PROGRAMS } from "../cms/shared/static-programs.mjs";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// The public address of this deployment: canonical URLs, link-preview tags (og:url, og:image),
// share links, sitemap and robots.txt. Chosen from the build's environment, never from a request:
//   1. PUBLIC_SITE_URL, set per deployment (e.g. https://faithworks.vercel.app while testing);
//   2. on Vercel, the project's production domain (VERCEL_PROJECT_PRODUCTION_URL, set by Vercel);
//   3. the CMS Site setting "Website address" (origin).
// So a test deployment never advertises a domain that does not serve this site.
export function siteOrigin(settingsOrigin, env = process.env) {
  const given = String(env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (given) {
    if (!/^https?:\/\/[^/\s?#]+$/i.test(given)) throw new Error(`PUBLIC_SITE_URL must be an origin such as https://example.com, without a path (got "${given}").`);
    return given;
  }
  const vercel = String(env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (env.VERCEL && /^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel}`;
  return settingsOrigin;
}

async function fetchSnapshot(view) {
  const base = (process.env.CMS_CONTENT_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("CMS_CONTENT_URL is not set (the CMS address, e.g. https://cms.example.com)");
  const url = `${base}/api/public/${view === "preview" ? "preview" : "content"}`;
  const headers = { accept: "application/json" };
  if (view === "preview") headers.authorization = `Bearer ${process.env.CMS_PREVIEW_TOKEN}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
      // The CMS serves its last good snapshot when the database is unreachable: still published
      // content, but possibly missing the newest changes.
      if (res.headers.get("x-content-stale")) console.warn("WARNING: the CMS database was unreachable; the CMS served its last good snapshot. Newer changes may be missing.");
      return await res.json();
    } catch (e) {
      lastError = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function loadSnapshot({ root, source = "fixtures", view = "auto", allowStale = false }) {
  let snap;
  if (source === "fixtures" || source === "local") {
    const file = source === "local" ? join(root, "cms/.data/store.json") : join(root, "cms/fixtures/seed.json");
    if (!existsSync(file)) throw new Error(`${file} not found. ${source === "local" ? "Start the CMS locally first (cd cms && npm run dev)." : "Run: node cms/scripts/seed-from-site.mjs"}`);
    const store = readJson(file);
    const make = (v) => buildSnapshot({ records: store, published: store.published || [], tags: store.tags || [], view: v });
    snap = view === "auto" ? (make("preview").settings?.staging ? make("preview") : make("published")) : make(view);
  } else if (source === "cms") {
    const want = view === "auto" ? (process.env.CMS_PREVIEW_TOKEN ? "preview" : "published") : view;
    const cache = join(root, ".cache", `content-${want}.json`);
    try {
      snap = await fetchSnapshot(want);
      const problems = checkSnapshot(snap);
      if (problems.length) throw new Error(problems.join(" "));
      mkdirSync(dirname(cache), { recursive: true });
      writeFileSync(cache, JSON.stringify(snap));
    } catch (e) {
      if (!allowStale || !existsSync(cache)) throw new Error(`Could not load content from the CMS: ${e.message}. Nothing was built; the live site is unchanged.`);
      snap = readJson(cache);
      console.warn(`WARNING: CMS unavailable (${e.message}). Building from the cached snapshot of ${snap.generated_at}.`);
    }
  } else throw new Error(`Unknown content source "${source}" (use fixtures, local or cms).`);

  // TEMPORARY: the public site shows the hardcoded programs (cms/shared/static-programs.mjs),
  // whatever the content source, while the CMS programs feed is sorted out. Imported, not read
  // from disk, because Vercel bundles vercel.mjs into .vercel/ where relative file paths break.
  // The CMS Programs dashboard and its page preview are unaffected. Remove this block to render
  // programs from the CMS again.
  if (snap) snap = { ...snap, programs: buildSnapshot({ records: { programs: STATIC_PROGRAMS }, view: "preview" }).programs };

  const problems = checkSnapshot(snap);
  if (problems.length) throw new Error(`Content snapshot is not usable: ${problems.join(" ")}`);
  if (snap.view === "preview" && snap.settings.staging !== true) {
    throw new Error("Refusing to build draft (preview) content into a non-staging site. Turn staging on in Site settings, or build the published view.");
  }
  return snap;
}

/* ---- Snapshot → the shapes tools/render.mjs renders ------------------------------ */
const nz = (v) => (v === "" || v === undefined ? null : v);
const list = (v) => (Array.isArray(v) ? v : []);
const scopeClass = (id) => `cms-body--${String(id).replace(/[^a-z0-9_-]/gi, "")}`;
export { timeRange };

// The page document of a record (shared/page-doc.mjs). Records saved before page documents
// are upgraded here exactly as the CMS editor upgrades them, so the website and the editor
// always show the same page. HTML and CSS are sanitized again (defense in depth) and the CSS
// is scoped to the page wrapper so a page's styles cannot affect the rest of the site.
function pageDoc(collection, p) {
  const r = upgradeRecord(collection, p);
  const html = sanitizeHtml(r.body_html || "", { extractStyles: true });
  if (!html.html.trim()) return null;
  const css = [sanitizeCss(r.body_css || "").css, html.css].filter((x) => x.trim()).join("\n");
  const cls = scopeClass(p.id);
  return { html: html.html, css: css ? scopeCss(css, `.${cls}`) : "", scope: cls, layout: r.page_layout === "custom" ? "custom" : "site", rec: r };
}
const seo = (p) => ({ seoTitle: nz(p.seo_title), metaDescription: nz(p.meta_description), socialImage: nz(p.social_image_url) }); // each template falls back to its own image

// Resources: every type (article, guide, worksheet…) is the same kind of page, edited and
// rendered like an article. The Type is only the badge on its card and a filter on Resources.
export const TYPE_LABELS = { article: "Article", guide: "Guide", worksheet: "Worksheet", template: "Template", checklist: "Checklist", playbook: "Playbook", tool: "Free tool", other: "Resource" };
export const typeOf = (r) => (TYPE_LABELS[r.resource_type] ? r.resource_type : r.resource_type ? "other" : "article");
// Renamed site pages: links saved in the CMS before a rename point at the new address
// (tools/build.mjs and vercel.mjs redirect the old one too).
export const SITE_REDIRECTS = [
  { from: "/individuals/", to: "/professionals/" },
  { from: "/free-ai-starter-kit/", to: "/start-your-ai-journey/" },
  { from: "/free-ai-starter-kit/thank-you/", to: "/start-your-ai-journey/thank-you/" },
];
export function currentUrl(u) {
  if (!u) return u;
  const r = SITE_REDIRECTS.find((x) => u === x.from || u.startsWith(x.from));
  return r ? r.to + u.slice(r.from.length) : u;
}
const isFile = (u) => /\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt|png|jpe?g)([?#]|$)/i.test(String(u || ""));

export function toRenderData(snap) {
  const programs = snap.programs.map((p) => {
    const doc = pageDoc("programs", p);
    const h = doc?.html || "";
    return {
      id: p.id, slug: p.slug, title: p.title, shortTitle: p.short_title || p.title, tone: p.tone || "stone", category: p.category,
      summary: p.summary,
      // Card facts come from the page (lists marked data-cms-list), so they never disagree with it
      audience: extractList(h, "audience") ?? list(p.target_audience), outputs: extractList(h, "outputs") ?? list(p.outputs),
      requirements: extractList(h, "requirements") ?? list(p.requirements), format: nz(extractText(h, "format") ?? p.format),
      fee: nz(p.price_text), statusKey: p.enrollment_status, statusLabel: nz(p.enrollment_label),
      image: p.featured_image_url ? { url: p.featured_image_url, alt: p.featured_image_alt || "" } : null,
      doc, rec: p, ...seo(p),
    };
  });
  // Events: the card and calendar need only the dates; a page is built when the event has one
  // (CMS event page, or "its own page") and the page has content.
  const events = snap.events.map((e) => {
    const doc = eventHasPage(e) ? pageDoc("events", e) : null;
    const im = featuredImage("events", e);
    const tz = e.time_zone || "Asia/Manila";
    return {
      id: e.slug, rid: e.id, slug: e.slug, title: e.title, summary: nz(e.summary),
      date: nz(e.event_date), endDate: nz(e.end_date), time: timeRange(e.start_time, e.end_time), timeZone: tz,
      start: eventInstant(e.event_date, e.start_time, tz), end: eventInstant(e.end_date || e.event_date, e.end_time, tz),
      venue: nz(e.venue), registration: { type: e.registration_type || "none", url: nz(e.registration_url), label: nz(e.cta_label) },
      image: im ? { src: im.url, width: im.width ?? null, height: im.height ?? null, alt: im.alt } : null,
      // Event images (cover first): the Events gallery shows the ones marked for it
      gallery: eventGalleryEntries(e.gallery),
      doc, hasPage: !!doc, rec: e, ...seo(e),
    };
  });

  // A cover that points at a retired image (or at a registered photo) is pointed at that photo's
  // web files on the record itself, so cards, the article's own cover block and its link preview
  // all show the same picture (tools/gallery.mjs, src/data/gallery.json "replaces").
  const covered = (r) => {
    const im = featuredImage("resources", r), photo = resolveImage(im);
    if (!im || photo === im) return r;
    const { alt, social, ...meta } = photo;
    return { ...r, cover_image_url: `/${photo.base}-1280.webp`, cover_image_alt: alt, cover_image_meta: meta };
  };
  snap = { ...snap, resources: snap.resources.map(covered) };
  // Each resource's card opens its page. A guide or worksheet saved without page content
  // keeps its older link instead (a file, or a page such as Start Your AI Journey).
  const articles = snap.resources.map((a) => {
    const doc = pageDoc("resources", a), type = typeOf(a);
    const link = doc ? null : nz(currentUrl(String(a.file_url || "").trim()));
    return {
      id: a.slug, rid: a.id, slug: a.slug, title: a.title, type, typeLabel: TYPE_LABELS[type], category: a.category, topics: list(a.tags),
      date: a.publish_date, author: bylineOf(a), readTime: readingTime(a.body_html) || a.read_time || "", featured: !!a.featured, excerpt: a.summary,
      href: doc ? `/resources/${a.slug}/` : link, external: !!link && /^https?:\/\//i.test(link), download: !!link && isFile(link),
      image: resolveImage(featuredImage("resources", a)), doc, hasPage: !!doc, rec: a, status: a.status, ...seo(a),
    };
  });

  // Testimonials: the quote, the name, an optional role and round photo. Card colours are not
  // content: tools/render.mjs picks them from the brand palette by position.
  const stories = snap.testimonials.map((t) => ({
    id: t.id, name: t.display_name, role: nz(t.role), quote: t.quote, photo: nz(t.featured_image_url),
  }));

  const s = snap.settings;
  const site = {
    origin: siteOrigin(s.origin), staging: s.staging === true, brand: s.brand, contactEmail: s.contact_email, contactPhone: nz(s.contact_phone),
    responseTime: nz(s.response_time), social: list(s.social), community: { name: s.community_name, url: s.community_url },
    starterKitReady: s.starter_kit_ready === true, logo: nz(s.logo_url), logoReversed: nz(s.logo_reversed_url),
    primaryCta: { label: nz(s.primary_cta_label), url: nz(currentUrl(s.primary_cta_url)) }, footerTagline: nz(s.footer_tagline), footerMotto: nz(s.footer_motto),
    // Booking link (Calendly) and the homepage video: both optional; nothing renders until set
    bookingUrl: nz(s.booking_url), video: s.featured_video_url ? { url: s.featured_video_url, title: nz(s.featured_video_title), poster: nz(s.featured_video_poster_url) } : null,
    privacyUrl: nz(s.privacy_url), termsUrl: nz(s.terms_url), tracking: { ga4: nz(s.ga4_id), gtm: nz(s.gtm_id), metaPixel: nz(s.meta_pixel_id) },
  };
  return { site, programs, events, articles, stories, redirects: snap.redirects || [] };
}
