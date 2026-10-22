// Builds cms/fixtures/seed.json from the site's verified content in assets/data/*.json.
// Run once per content migration: `node cms/scripts/seed-from-site.mjs`.
//
// Rules: nothing is invented. Every content item is imported as a Draft (the CMS has no
// approval states; an item goes live when someone publishes it). Testimonials are imported as
// drafts: confirm the person agreed to be quoted before publishing them. Only Site settings
// are seeded as published, because the website cannot be built without them. Dev users use the reserved example.test domain and
// are only usable through the local development login.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { block } from "../../tools/render.mjs";
import { blankRecord } from "../shared/schema.mjs";
import { normalize } from "../shared/validate.mjs";
import { toPublic } from "../shared/public.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const data = (f) => JSON.parse(readFileSync(join(ROOT, "assets/data", f), "utf8"));
const id = (prefix, key) => `${prefix}_${createHash("sha256").update(key).digest("hex").slice(0, 10)}`;
const IMPORTED_AT = "2026-10-15T00:00:00.000Z";
const ACTOR = "system:import";

const registerStatus = () => ({ status: "draft" }); // content-register states are not imported

function record(collection, fields, extra = {}) {
  const rec = { ...blankRecord(collection), ...normalize(collection, { ...blankRecord(collection), ...fields }) };
  // Imported content is in the pre-page-document shape: the CMS and the build upgrade it on read
  if (!("doc_version" in fields)) { delete rec.doc_version; delete rec.page_layout; }
  return {
    id: extra.id, status: extra.status || "draft", version: 1, write_id: "seed",
    created_at: IMPORTED_AT, created_by: ACTOR, updated_at: IMPORTED_AT, updated_by: ACTOR,
    published_at: "", published_by: "",
    published_version: "", published_slug: "", previous_slugs: "", deleted_at: "", deleted_by: "",
    ...rec,
  };
}

const CTA = { waitlist: "Join the waitlist", inquiry: "Ask about the next run", planned: "Register your interest", open: "Register" };

/* ---- Programs ---- */
const programs = data("programs.json").programs.map((p, i) => {
  const { status, note } = registerStatus(p.approval);
  return record("programs", {
    title: p.title, slug: p.slug, short_title: p.shortTitle, category: p.category, summary: p.summary, problem: p.problem,
    target_audience: p.audience, learning_outcomes: p.outcomes, outputs: p.outputs, requirements: p.requirements,
    inclusions: p.inclusions || [], exclusions: p.exclusions || [], format: p.format, time_commitment: p.timeCommitment,
    location: p.location, instructor: p.instructor, price_text: p.fee, enrollment_status: p.statusKey, enrollment_label: p.statusLabel,
    next_intake: p.nextIntake, agenda: p.agenda, faq: p.faq, cta_label: CTA[p.statusKey] || "Ask about this program",
    tone: p.tone, preview_kind: p.preview || "", history: typeof p.history === "string" ? p.history : p.history ? JSON.stringify(p.history) : "",
    content_owner: p.owner, sort_order: (i + 1) * 10,
  }, { id: id("prg", p.slug), status });
});

/* ---- Events ---- */
function parseTimes(t) {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return ["", ""];
  const to24 = (h, min, ap) => `${String((Number(h) % 12) + (ap.toUpperCase() === "PM" ? 12 : 0)).padStart(2, "0")}:${min}`;
  return [to24(m[1], m[2], m[3] || m[6]), to24(m[4], m[5], m[6])];
}
function delivery(format) {
  const f = String(format || "");
  if (/zoom|hybrid/i.test(f)) return "hybrid";
  if (/in person|face-to-face|onsite/i.test(f)) return "in_person";
  if (/online|virtual/i.test(f)) return "online";
  return "tbc";
}
const events = data("events.json").events.map((e, i) => {
  const [start, end] = parseTimes(e.time);
  // An existing registration page (e.g. a GHL funnel) stays the button's destination
  const external = ["external", "internal"].includes(e.destination?.type) && e.destination?.url;
  return record("events", {
    title: e.title, slug: e.id, summary: e.summary, event_date: e.date, start_time: start, end_time: end, time_zone: "Asia/Manila",
    venue: e.venue, registration_type: external ? "external" : "none", registration_url: external ? e.destination.url : "",
    cta_label: external ? e.destination.label : "", event_page: false, visible: true,
    featured_image_url: e.image?.src, featured_image_alt: e.image?.alt, sort_order: (i + 1) * 10,
  }, { id: id("evt", e.id), status: "draft" });
});

/* ---- Resources: articles (insights.json) and guides (resources.json) ---- */
const articles = data("insights.json").insights.map((a, i) => {
  const { status, note } = registerStatus(a.status);
  const w = Math.max(...a.image.widths);
  return record("resources", {
    title: a.title, slug: a.slug, resource_type: "article", category: a.category, summary: a.excerpt, author: a.author,
    publish_date: a.date, read_time: a.readTime, featured: !!a.featured, access_rule: "open",
    body_html: a.content.map(block).join("\n"),
    cover_image_url: `/${a.image.base}-${w}.jpg`, cover_image_alt: a.image.alt,
    cover_image_meta: { base: a.image.base, widths: a.image.widths, width: a.image.width, height: a.image.height, position: a.image.position, source: a.image.source },
    tags: a.topics, sort_order: (i + 1) * 10,
  }, { id: id("res", a.slug), status });
});
const guides = data("resources.json").resources.map((r, i) => {
  const { status, note } = registerStatus(r.approval);
  return record("resources", {
    title: r.title, slug: r.id, resource_type: /worksheet/i.test(r.kind) && !/guide/i.test(r.kind) ? "worksheet" : "guide",
    category: r.kind, summary: r.summary, author: "Faith Works", access_rule: r.access, access_label: r.accessLabel,
    file_url: r.url, cta_label: r.ctaLabel, featured: !!r.featured, sort_order: (i + 1) * 10,
  }, { id: id("res", r.id), status });
});

/* ---- Testimonials ---- */
// No card colours: the website picks them from the brand palette by position.
const testimonials = data("success-stories.json").stories.map((s, i) => record("testimonials", {
  quote: s.quote, display_name: s.name, role: "", visible: true, sort_order: (i + 1) * 10,
}, { id: id("tst", s.id), status: "draft" }));

/* ---- Site settings ---- */
const site = data("site.json");
const settings = record("settings", {
  brand: site.brand, logo_url: "/assets/icons/wordmark.svg", logo_reversed_url: "/assets/icons/wordmark-reversed.svg",
  contact_email: site.contactEmail, response_time: site.responseTime, social: site.social,
  community_name: site.community?.name, community_url: site.community?.url,
  primary_cta_label: "Start Your AI Journey", primary_cta_url: "/free-ai-starter-kit/",
  footer_tagline: "Work better with AI, without becoming a tech expert.", footer_motto: "Learn. Implement. Scale.",
  privacy_url: "/privacy/", terms_url: "/terms/", origin: site.origin, staging: site.staging, starter_kit_ready: site.starterKitReady,
}, { id: "site", status: "published" }); // URLs need verification before launch (docs/02)
Object.assign(settings, { published_at: IMPORTED_AT, published_by: ACTOR, published_version: 1 });

/* ---- Tags (from article topics) ---- */
const TAG_LABELS = { ai: "AI", business: "Business", leadership: "Leadership", lifestyle: "Lifestyle", "faith-purpose": "Faith and purpose" };
const topicIds = [...new Set(articles.flatMap((a) => a.tags))];
const tags = topicIds.map((t) => ({ id: t, label: TAG_LABELS[t] || t, description: "", archived: false, version: 1, write_id: "seed", created_at: IMPORTED_AT, created_by: ACTOR, updated_at: IMPORTED_AT, updated_by: ACTOR }));

const devUser = (email, name, role) => ({ id: email, email, name, role, active: true, version: 1, write_id: "seed", created_at: IMPORTED_AT, created_by: ACTOR, updated_at: IMPORTED_AT, updated_by: ACTOR });

const store = {
  _readme: "Development fixture for the Faith Works CMS (JSON adapter). Generated by cms/scripts/seed-from-site.mjs from assets/data/*.json. Not the production content store: production uses Google Sheets. The example.test users only work with the local development login.",
  programs, events, resources: [...articles, ...guides], testimonials, settings: [settings], tags,
  users: [devUser("super.admin@example.test", "Dev Super Admin", "super_admin"), devUser("author@example.test", "Dev Author", "author"), devUser("second.author@example.test", "Dev Second Author", "author")],
  published: [{ id: "settings:site", record_id: "site", collection: "settings", slug: "", version: 1, state: "live", published_at: IMPORTED_AT, published_by: ACTOR, write_id: "seed", payload: toPublic("settings", settings) }],
  history: [], audit_log: [],
};

const out = join(ROOT, "cms/fixtures/seed.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(store, null, 2) + "\n");
const count = (k) => store[k].length;
console.log(`Wrote ${out}: ${count("programs")} programs, ${count("events")} events, ${count("resources")} resources, ${count("testimonials")} testimonials, ${count("tags")} tags.`);
