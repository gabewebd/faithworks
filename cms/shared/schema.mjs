// Faith Works CMS content model. One source of truth for:
//  - the spreadsheet layout (tab names, column headers),
//  - the dashboard forms (labels, help, groups, widgets),
//  - server-side validation and field-level permissions,
//  - which fields are public (copied into the published snapshot) and which stay internal.
// Pure data + small helpers: imported by the CMS server, the dashboard (browser) and the
// public site build (tools/content.mjs). No Node or browser APIs here.
import { TIME_ZONES, DOC_VERSION } from "./page-doc.mjs";

export const ROLES = {
  super_admin: { label: "Super Admin", rank: 3 },
  main_admin: { label: "Main Admin", rank: 2 },
  author: { label: "Author", rank: 1 },
};
export const isAdmin = (role) => role === "super_admin" || role === "main_admin";

// Workflow statuses (brief §7 content register + review states). Tags are separate.
export const STATUSES = {
  needed: { label: "Needed", tone: "stone", help: "Planned, no content yet." },
  draft: { label: "Draft", tone: "stone", help: "Being written. Not visible on the website." },
  in_review: { label: "Under Review", tone: "yellow", help: "Submitted. Waiting for an admin to review." },
  changes_requested: { label: "Changes Requested", tone: "pink", help: "The reviewer asked for changes." },
  approved: { label: "Approved", tone: "green", help: "Approved. An admin can publish it." },
  published: { label: "Published", tone: "green", help: "Live on the website exactly as shown." },
  rejected: { label: "Rejected", tone: "red", help: "Not approved for the website." },
  archived: { label: "Archived", tone: "stone", help: "Kept for the record. Not on the website." },
};

// Production domain and route conventions (tools/build.mjs).
export const SITE_ORIGIN_DEFAULT = "https://faithph.ai";

/* ---- Field helpers ---------------------------------------------------------
   type: text | textarea | slug | url | email | date | time | number | boolean | select |
         tags | authors | ref | list | pairs | html | css | json
   required: needed to submit/approve/publish (drafts may be incomplete)
   public: false keeps the field out of the published snapshot (internal data)
   adminOnly / superOnly: field-level write permission (enforced on the server)
   long: number of spreadsheet cells the value may span (a cell holds 50,000 characters)
   hidden: stored, but not a form field (set by the page editor or the server)
   computed: calculated by the server on save (never typed in)
   legacy: a field from before page documents. Its stored value is kept (nothing is deleted)
           and still read for records that have not been re-saved, but it is no longer
           edited: that content now lives in the page itself (see shared/page-doc.mjs).
   showIf(record): the field only applies when this returns true (e.g. per resource type)
*/
const f = (key, label, type = "text", opts = {}) => ({ key, label, type, ...opts });
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const legacy = (...fields) => fields.map((x) => ({ ...x, legacy: true, hidden: true, required: false }));

const SEO = [
  f("seo_title", "SEO title (browser tab and search)", "text", { group: "seo", max: 120, help: "Leave empty to use “{title} · Faith Works”. Shown as the <title> in the page editor’s HTML." }),
  f("meta_description", "Meta description", "textarea", { group: "seo", max: 300, rows: 3, help: "One or two sentences for search results and link previews. Leave empty to use the summary." }),
  f("social_image_url", "Social sharing image URL", "url", { group: "seo", help: "Optional. Leave empty to use the featured image." }),
];
const FEATURED = [
  f("featured_image_url", "Featured image URL", "url", { group: "media", image: true, help: "Optional. Paste an image address (https://… or /assets/images/…). The page shows it wherever its template has the featured image block." }),
  f("featured_image_alt", "Image description (alt text)", "text", { group: "media", max: 200, help: "Describe what the image shows, for screen readers. Required when an image is set." }),
];
// Authors replace the old free-text owner and per-item editor list. Every CMS user can edit
// content (publishing still needs an admin); authors only say who wrote it.
const PUBLISHING = [
  f("authors", "Authors", "authors", { group: "publishing", public: false, help: "People on the CMS user list. Shown as the byline where the page has one." }),
  f("byline", "Byline", "text", { hidden: true, computed: true }),
  f("tags", "Tags", "tags", { group: "publishing", help: "Type to search. Type a new name, or use “New tag” in the list, to create one (admins)." }),
  // Kept for existing items (list order, review reminders) but no longer edited
  f("sort_order", "Display order", "number", { hidden: true }),
  f("review_date", "Next review date", "date", { hidden: true, public: false }),
];
const OLD_OWNERSHIP = [
  f("content_owner", "Content owner", "text", { public: false }),
  f("assigned_to", "Authors who may edit", "text", { public: false }),
];
export const PAGE_LAYOUTS = opt([["site", "Use global navbar and footer"], ["custom", "Custom page layout"]]);
const PAGE = (label) => [
  f("body_html", label, "html", { group: "body", long: 6, cssField: "body_css" }),
  f("body_css", "Page styles (CSS)", "css", { group: "body", long: 2, hidden: true }),
  f("page_layout", "Page layout", "select", { group: "body", hidden: true, options: PAGE_LAYOUTS }),
  f("doc_version", "Page document version", "number", { hidden: true }),
];

export const COLLECTIONS = {
  programs: {
    label: "Programs", singular: "Program", prefix: "prg", labelField: "title", route: "/programs/{slug}/", page: "Program page",
    description: "Learning programs shown on Learn AI and as their own pages.",
    groups: { main: "Program", enrol: "Enrolment and price", media: "Featured image", seo: "Search and sharing", publishing: "Authors and tags" },
    fields: [
      f("title", "Title", "text", { group: "main", required: true, max: 160, help: "The page’s main heading. Editing the heading in the page editor changes it here too." }),
      f("slug", "URL slug", "slug", { group: "main", required: true }),
      f("summary", "Summary", "textarea", { group: "main", required: true, max: 500, rows: 3, help: "The introduction under the page title and the text on program cards." }),
      f("category", "Card label", "text", { group: "main", max: 80, help: "Small label on program cards, e.g. “Workflow & productivity”." }),
      f("tone", "Card colour", "select", { group: "main", options: opt([["stone", "Stone"], ["pink", "Faith Pink"], ["yellow", "AI Yellow"], ["ink", "Charcoal"]]) }),
      f("enrollment_status", "Enrolment status", "select", { group: "enrol", required: true, options: opt([["open", "Registration open"], ["waitlist", "Waitlist"], ["inquiry", "Ask about the next run"], ["planned", "Planned · not yet open"]]) }),
      f("enrollment_label", "Status wording", "text", { group: "enrol", max: 120, help: "Optional. Replaces the standard wording on status badges." }),
      f("price_text", "Price", "text", { group: "enrol", max: 200, help: "Exactly as approved, e.g. “PHP 9,897 (VAT inclusive)”. Never show historical prices. The page shows it wherever its template has the price." }),
      ...PAGE("Program page"), ...FEATURED, ...SEO, ...PUBLISHING,
      ...legacy(
        f("short_title", "Short title"), f("problem", "Problem it solves", "textarea"),
        f("target_audience", "Target audience", "list"), f("learning_outcomes", "Learning outcomes", "list"), f("outputs", "What participants leave with", "list"),
        f("requirements", "What participants need", "list"), f("inclusions", "Included", "list"), f("exclusions", "Not included", "list"),
        f("format", "Format"), f("time_commitment", "Time commitment"), f("location", "Location"), f("instructor", "Instructor"), f("next_intake", "Next intake"),
        f("agenda", "Agenda", "pairs", { subfields: [f("title", "Step"), f("text", "Description", "textarea")] }),
        f("faq", "Questions and answers", "pairs", { subfields: [f("q", "Question"), f("a", "Answer", "textarea")] }),
        f("cta_label", "Button label"), f("cta_url", "Button destination URL", "url"),
        f("preview_kind", "Example output illustration"), f("history", "Previous runs (internal note)", "textarea", { public: false }),
        ...OLD_OWNERSHIP),
    ],
  },

  events: {
    label: "Events", singular: "Event", prefix: "evt", labelField: "title", route: "/events/{slug}/", page: "Event page",
    description: "Workshops and events on the Workshops page. Upcoming and past are separated automatically.",
    groups: { main: "Event", when: "Date and time", where: "Venue and registration", media: "Featured image", seo: "Search and sharing", publishing: "Authors and tags" },
    fields: [
      f("title", "Event title", "text", { group: "main", required: true, max: 160, help: "The page’s main heading. Editing the heading in the page editor changes it here too." }),
      f("slug", "URL slug", "slug", { group: "main", required: true }),
      f("summary", "Summary", "textarea", { group: "main", required: true, max: 500, rows: 3, help: "Shown on the Workshops list and as the page introduction." }),
      f("event_type", "Event type", "text", { group: "main", max: 80, help: "e.g. “Masterclass”, “Workshop”." }),
      f("related_program_id", "Related program", "ref", { group: "main", ref: "programs", help: "Optional. Links the event to a program page." }),
      f("event_date", "Start date", "date", { group: "when", help: "Leave empty while the date is not confirmed." }),
      f("start_time", "Start time", "time", { group: "when" }),
      f("end_date", "End date", "date", { group: "when", help: "Only for events over several days." }),
      f("end_time", "End time", "time", { group: "when" }),
      f("time_zone", "Time zone", "select", { group: "when", required: true, searchable: true, options: TIME_ZONES.map(([value, label]) => ({ value, label })), help: "Times are stored exactly as entered, in this zone. Changing the zone never moves the event." }),
      f("date_label", "Text while no date is set", "text", { group: "when", max: 80, help: "e.g. “Dates to be announced”." }),
      f("registration_deadline", "Registration deadline", "date", { group: "when" }),
      f("delivery_format", "Delivery format", "select", { group: "where", required: true, options: opt([["in_person", "In person (offline)"], ["online", "Online"], ["hybrid", "Hybrid"], ["tbc", "To be confirmed"]]) }),
      f("venue", "Venue", "text", { group: "where", max: 200, half: true, showIf: (r) => r.delivery_format !== "online" }),
      f("map_url", "Map link", "url", { group: "where", showIf: (r) => r.delivery_format !== "online" }),
      f("meeting_url", "Online meeting link", "url", { group: "where", showIf: (r) => r.delivery_format === "online" || r.delivery_format === "hybrid", help: "Shown on the event page. Do not use a link that must stay private." }),
      f("capacity", "Capacity", "number", { group: "where" }),
      f("event_status", "Event status", "select", { group: "where", required: true, options: opt([["open", "Registration open"], ["waitlist", "Waitlist"], ["sold-out", "Sold out · waitlist open"], ["tba", "Dates to be announced"], ["past", "Past event"]]) }),
      f("cta_type", "Registration destination", "select", { group: "where", required: true, options: opt([["external", "External page (e.g. a GHL funnel)"], ["internal", "A page on this website"], ["notify", "“Get notified” form on Workshops"], ["none", "No button"]]) }),
      f("registration_url", "Registration URL", "url", { group: "where", showIf: (r) => r.cta_type === "external" || r.cta_type === "internal", help: "The existing registration or payment page. Never invent one. Page buttons marked “registration URL” follow it." }),
      f("cta_label", "Button label", "text", { group: "where", max: 80, showIf: (r) => r.cta_type !== "none" }),
      ...PAGE("Event page"), ...FEATURED, ...SEO, ...PUBLISHING,
      ...legacy(
        f("format_label", "Format text shown on the page"), f("online_info", "Online joining information", "textarea"), f("is_past", "This is a past event", "boolean"),
        f("featured_image_caption", "Image caption"), f("image_width", "Image width (px)", "number"), f("image_height", "Image height (px)", "number"),
        ...OLD_OWNERSHIP),
    ],
  },

  resources: {
    label: "Resources", singular: "Resource", prefix: "res", labelField: "title", route: "/resources/{slug}/", page: "Resource page",
    description: "Articles, guides, templates, checklists and other resources.",
    groups: { main: "Resource", dest: "Card button", media: "Featured image", seo: "Search and sharing", publishing: "Authors and tags" },
    fields: [
      f("title", "Title", "text", { group: "main", required: true, max: 160, help: "The page’s main heading. Editing the heading in the page editor changes it here too." }),
      f("slug", "URL slug", "slug", { group: "main", required: true }),
      f("resource_type", "Type", "select", { group: "main", required: true, options: opt([["article", "Article"], ["guide", "Guide"], ["worksheet", "Worksheet"], ["template", "Template"], ["checklist", "Checklist"], ["playbook", "Playbook"], ["tool", "Free tool"], ["other", "Other"]]), help: "Articles are read on this site. Other types are listed on Resources with a button to their destination, and have their own page only when the page editor has content." }),
      f("category", "Category label", "text", { group: "main", required: true, max: 80, help: "Shown on cards, e.g. “AI” or “Guide and worksheets”." }),
      f("summary", "Summary", "textarea", { group: "main", required: true, max: 500, rows: 3, help: "Shown on cards and as the article introduction." }),
      f("publish_date", "Publish date", "date", { group: "main", required: true }),
      f("read_time", "Reading time", "text", { group: "main", computed: true, showIf: (r) => r.resource_type === "article", help: "Calculated from the article text whenever it changes." }),
      f("featured", "Feature this resource", "boolean", { group: "main" }),
      f("file_url", "Destination URL", "url", { group: "dest", showIf: (r) => r.resource_type !== "article", help: "Where the card’s button goes: the file, the sign-up page or the external site." }),
      f("cta_label", "Button label", "text", { group: "dest", max: 80, showIf: (r) => r.resource_type !== "article" }),
      ...PAGE("Resource page"),
      f("cover_image_url", "Featured image URL", "url", { group: "media", image: true, help: "Optional. Shown on article cards and at the top of the article." }),
      f("cover_image_alt", "Image description (alt text)", "text", { group: "media", max: 200 }),
      f("cover_image_meta", "Responsive image data", "json", { group: "media", hidden: true }),
      ...SEO, ...PUBLISHING,
      ...legacy(f("author", "Author"), f("access_rule", "Access"), f("access_label", "Access text shown on the card"), ...OLD_OWNERSHIP),
    ],
  },

  testimonials: {
    label: "Testimonials", singular: "Testimonial", prefix: "tst", labelField: "display_name", route: null, page: "Card template",
    description: "Participant quotes and success stories. Published only with recorded consent and display approval.",
    groups: { main: "Quote", consent: "Source and consent", media: "Photo", publishing: "Authors and tags" },
    fields: [
      f("display_name", "Name shown on the website", "text", { group: "main", required: true, max: 160, help: "As approved by the person." }),
      f("role_org", "Role or organization shown", "text", { group: "main", max: 160, help: "Only if the person approved showing it." }),
      f("quote", "Exact quote or result", "textarea", { group: "main", required: true, max: 2000, rows: 5, help: "Exactly as the person wrote or said it. Do not polish or shorten. The card shows it word for word; it cannot be edited in the card template." }),
      f("kind", "Kind", "select", { group: "main", required: true, options: opt([["testimonial", "Testimonial (quote)"], ["success_story", "Success story (result)"]]) }),
      f("attribution", "Attribution (full name as given)", "text", { group: "consent", required: true, public: false, max: 160 }),
      f("source", "Source", "text", { group: "consent", required: true, public: false, max: 200, help: "Where the quote came from, e.g. “Post-workshop feedback form, Batch 3”." }),
      f("source_ref", "Source link or internal reference", "text", { group: "consent", public: false, max: 500 }),
      f("consent_status", "Consent", "select", { group: "consent", required: true, public: false, options: opt([["not_recorded", "Not recorded yet"], ["requested", "Requested"], ["obtained", "Obtained"], ["declined", "Declined"], ["withdrawn", "Withdrawn"]]) }),
      f("consent_evidence", "Consent evidence", "textarea", { group: "consent", public: false, max: 1000, rows: 2, help: "Where the written consent is kept (file name, email subject and date). Do not paste personal data." }),
      f("consent_date", "Consent date", "date", { group: "consent", public: false }),
      f("display_approved", "Approved for display", "boolean", { group: "consent", public: false, adminOnly: true, help: "Admins only. Required before publishing." }),
      ...FEATURED.map((x) => ({ ...x, label: x.key === "featured_image_url" ? "Photo URL" : x.label, help: x.key === "featured_image_url" ? "Optional. Only with the person’s permission." : x.help })),
      f("body_html", "Card template", "html", { group: "body", long: 2, cssField: "body_css" }),
      f("body_css", "Card styles (CSS)", "css", { group: "body", hidden: true }),
      f("doc_version", "Page document version", "number", { hidden: true }),
      ...PUBLISHING,
      ...legacy(...OLD_OWNERSHIP),
    ],
  },

  settings: {
    label: "Site settings", singular: "Site settings", prefix: "set", labelField: "brand", route: null, singleton: "site",
    description: "Logo, contacts, social links, global calls to action, footer, legal links and tracking IDs.",
    groups: { main: "Brand and contact", social: "Social and community", cta: "Global call to action", footer: "Footer and legal", system: "Launch and tracking (Super Admin)" },
    fields: [
      f("brand", "Brand name", "text", { group: "main", required: true, max: 80 }),
      f("logo_url", "Logo URL", "url", { group: "main", image: true }),
      f("logo_reversed_url", "Logo on dark backgrounds URL", "url", { group: "main", image: true }),
      f("contact_email", "Contact email", "email", { group: "main", required: true }),
      f("contact_phone", "Contact phone", "text", { group: "main", max: 40 }),
      f("response_time", "Response time shown on Contact", "text", { group: "main", max: 200, help: "Only once agreed. Leave empty to show the standard wording." }),
      f("social", "Social links", "pairs", { group: "social", subfields: [f("name", "Network"), f("label", "Accessible label"), f("url", "URL", "url")] }),
      f("community_name", "Community name", "text", { group: "social", max: 80 }),
      f("community_url", "Community group URL", "url", { group: "social" }),
      f("primary_cta_label", "Header button label", "text", { group: "cta", max: 80 }),
      f("primary_cta_url", "Header button destination", "url", { group: "cta" }),
      f("footer_tagline", "Footer line", "text", { group: "footer", max: 160 }),
      f("footer_motto", "Footer tagline", "text", { group: "footer", max: 80 }),
      f("privacy_url", "Privacy Notice URL", "url", { group: "footer" }),
      f("terms_url", "Terms URL", "url", { group: "footer" }),
      f("origin", "Website address (canonical origin)", "url", { group: "system", required: true, superOnly: true }),
      f("staging", "Staging mode (noindex, staging bar, draft preview builds)", "boolean", { group: "system", superOnly: true }),
      f("starter_kit_ready", "Starter Kit is ready for public traffic", "boolean", { group: "system", superOnly: true }),
      f("ga4_id", "Google Analytics 4 measurement ID", "text", { group: "system", superOnly: true, pattern: "^G-[A-Z0-9]{4,16}$", help: "Approved IDs only, e.g. G-ABC123XYZ. Never paste secrets or API keys." }),
      f("gtm_id", "Google Tag Manager container ID", "text", { group: "system", superOnly: true, pattern: "^GTM-[A-Z0-9]{4,12}$" }),
      f("meta_pixel_id", "Meta Pixel ID", "text", { group: "system", superOnly: true, pattern: "^[0-9]{6,20}$" }),
    ],
  },
};

export const CONTENT_COLLECTIONS = ["programs", "events", "resources", "testimonials"];
export const ALL_COLLECTIONS = [...CONTENT_COLLECTIONS, "settings"];

// Workflow and bookkeeping columns stored on every content row. Written only by the server.
export const SYSTEM_FIELDS = [
  "id", "status", "version", "write_id",
  "created_at", "created_by", "updated_at", "updated_by",
  "submitted_at", "submitted_by", "reviewed_at", "reviewed_by", "review_note",
  "approved_at", "approved_by", "approved_version",
  "published_at", "published_by", "published_version", "published_slug", "previous_slugs",
  "deleted_at", "deleted_by",
];

// System tabs. Columns ending in __N are overflow cells for long values.
export const SYSTEM_TABS = {
  published: { columns: ["id", "record_id", "collection", "slug", "version", "state", "published_at", "published_by", "write_id", { key: "payload", long: 10 }] },
  history: { columns: ["id", "record_id", "collection", "version", "kind", "status", "at", "by", "write_id", { key: "data", long: 10 }] },
  audit_log: { columns: ["id", "at", "actor", "role", "action", "collection", "record_id", "version", "detail", "request_id"] },
  users: { columns: ["id", "email", "name", "role", "active", "version", "write_id", "created_at", "created_by", "updated_at", "updated_by"] },
  tags: { columns: ["id", "label", "description", "archived", "version", "write_id", "created_at", "created_by", "updated_at", "updated_by"] },
};

export function fieldsOf(collection) {
  const c = COLLECTIONS[collection];
  if (!c) throw new Error(`Unknown collection: ${collection}`);
  return c.fields;
}
export function field(collection, key) { return fieldsOf(collection).find((x) => x.key === key); }
export const hasSlug = (collection) => !!field(collection, "slug");

// Spreadsheet columns for a tab, in order, with overflow cells for long values.
export function columnsFor(tab) {
  const defs = COLLECTIONS[tab]
    ? [...SYSTEM_FIELDS, ...COLLECTIONS[tab].fields.map((x) => (x.long ? { key: x.key, long: x.long } : x.key))]
    : SYSTEM_TABS[tab].columns;
  const out = [];
  for (const d of defs) {
    if (typeof d === "string") { if (!out.includes(d)) out.push(d); continue; }
    out.push(d.key);
    for (let i = 2; i <= d.long; i++) out.push(`${d.key}__${i}`);
  }
  return out;
}
export const ALL_TABS = [...ALL_COLLECTIONS, ...Object.keys(SYSTEM_TABS)];

export function longCells(tab, key) {
  if (COLLECTIONS[tab]) return COLLECTIONS[tab].fields.find((x) => x.key === key)?.long || 1;
  const d = SYSTEM_TABS[tab]?.columns.find((c) => typeof c === "object" && c.key === key);
  return d ? d.long : 1;
}

// Public URL of a record (null when the collection has no pages).
export function publicPath(collection, slug) {
  const route = COLLECTIONS[collection]?.route;
  return route && slug ? route.replace("{slug}", slug) : null;
}

// Empty value for a field type (used for new records and missing cells).
export function emptyValue(fieldDef) {
  switch (fieldDef.type) {
    case "list": case "tags": case "authors": case "pairs": return [];
    case "boolean": return false;
    case "number": return null;
    case "json": return null;
    default: return "";
  }
}

export function blankRecord(collection) {
  const rec = {};
  for (const x of fieldsOf(collection)) rec[x.key] = emptyValue(x);
  if (fieldsOf(collection).some((x) => x.key === "doc_version")) rec.doc_version = DOC_VERSION;
  if (fieldsOf(collection).some((x) => x.key === "page_layout")) rec.page_layout = "site";
  if (collection === "events") { rec.time_zone = "Asia/Manila"; rec.cta_type = "notify"; rec.event_status = "tba"; rec.delivery_format = "tbc"; }
  if (collection === "programs") { rec.enrollment_status = "waitlist"; rec.tone = "stone"; }
  if (collection === "resources") { rec.resource_type = "article"; }
  if (collection === "testimonials") { rec.kind = "testimonial"; rec.consent_status = "not_recorded"; }
  return rec;
}
