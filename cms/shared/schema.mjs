// Faith Works CMS content model. One source of truth for:
//  - the spreadsheet layout (tab names, column headers),
//  - the dashboard forms (labels, help, groups, widgets),
//  - server-side validation and field-level permissions,
//  - which fields are public (copied into the published snapshot) and which stay internal.
// Pure data + small helpers: imported by the CMS server, the dashboard (browser) and the
// public site build (tools/content.mjs). No Node or browser APIs here.
import { TIME_ZONES, DOC_VERSION } from "./page-doc.mjs";

export const ROLES = {
  super_admin: { label: "Super Admin", rank: 2, help: "Full CMS and administrative access." },
  author: { label: "Author", rank: 1, help: "Can create, edit and publish their own content, but cannot manage users or administrative settings." },
};
// Any other stored role is refused at sign-in and flagged on Users and roles until a Super
// Admin assigns a current role.
export const normalizeRole = (role) => (ROLES[role] ? role : null);
export const isSuperAdmin = (role) => normalizeRole(role) === "super_admin";

// Publishing statuses. There is no approval step: whoever may edit an item publishes it.
//   Draft: saved, not on the website.  Published: on the website (events and testimonials
//   also need "Show on the website" on).  Archived: kept for the record, off the website.
export const STATUSES = {
  draft: { label: "Draft", tone: "stone", help: "Saved, but not on the website. Press Publish when it is ready." },
  published: { label: "Published", tone: "green", help: "On the website exactly as shown." },
  archived: { label: "Archived", tone: "stone", help: "Kept for the record. Not on the website." },
};
// Records saved with any other status are read as Drafts (nothing is rewritten until the item
// is saved); whether an item is live is decided by the `published` tab, never by its status.
export const statusOf = (status) => (STATUSES[status] ? status : "draft");

// Production domain and route conventions (tools/build.mjs).
export const SITE_ORIGIN_DEFAULT = "https://faithph.ai";

/* ---- Field helpers ---------------------------------------------------------
   type: text | textarea | slug | url | email | date | time | number | boolean | select |
         tags | authors | ref | list | pairs | html | css | json
   required: needed to publish (drafts may be incomplete)
   public: false keeps the field out of the published snapshot (internal data)
   adminOnly: field-level write permission (enforced on the server)
   long: number of spreadsheet cells the value may span (a cell holds 50,000 characters)
   hidden: stored, but not a form field (set by the page editor or the server)
   computed: calculated by the server on save (never typed in)
   retired: (in a collection's `retired` list, not `fields`) a field this CMS no longer uses. Old
           rows are still read so migrateRecord() can convert them, and the stored value is kept
           on every write, but new sheets do not get the column and it is never published.
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
  f("social_image_url", "Social sharing image URL", "url", { hidden: true }), // kept for existing items; pages share the featured image
];
const FEATURED = [
  f("featured_image_url", "Featured image URL", "url", { group: "media", image: true, help: "Optional. Paste an image address (https://… or /assets/images/…). The page shows it wherever its template has the featured image block." }),
  f("featured_image_alt", "Image description (alt text)", "text", { group: "media", max: 200, help: "Describe what the image shows, for screen readers. Required when an image is set." }),
];
// Authors replace the old free-text owner and per-item editor list. The people listed here
// (and whoever created the item) own it: they may edit and publish it (shared/workflow.mjs).
const PUBLISHING = [
  f("authors", "Authors", "authors", { group: "publishing", public: false, help: "People on the CMS user list. They can edit and publish this item, and are shown as the byline where the page has one." }),
  f("byline", "Byline", "text", { hidden: true, computed: true }),
  f("tags", "Tags", "tags", { group: "publishing", help: "Type to search. Type a new name, or use “New tag” in the list, to create one (Super Admins)." }),
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

// An event has its own page when the registration button goes to it, or when the author asks for one.
export const eventHasPage = (r) => r?.registration_type === "page" || r?.event_page === true;

export const COLLECTIONS = {
  programs: {
    label: "Programs", singular: "Program", prefix: "prg", labelField: "title", route: "/programs/{slug}/", page: "Program page",
    description: "Learning programs shown on Learn AI and as their own pages.",
    groups: { main: "Program", enrol: "Enrolment and price", media: "Featured image", seo: "Search (SEO)", publishing: "Authors and tags" },
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
    description: "Events on the Workshops page and its calendar. Upcoming and past are separated automatically from the dates.",
    groups: { main: "Event", when: "Date and time", where: "Location", reg: "Registration", media: "Event image", page: "Event page", visibility: "Visibility and authors" },
    fields: [
      f("title", "Event title", "text", { group: "main", required: true, max: 160, help: "Shown on the event card and the calendar." }),
      f("summary", "Short description", "textarea", { group: "main", max: 500, rows: 3, help: "Optional. One or two sentences for the event card." }),
      f("event_date", "Start date", "date", { group: "when", required: true, help: "Needed to publish. The calendar and the upcoming and past lists use it." }),
      f("start_time", "Start time", "time", { group: "when" }),
      f("end_date", "End date", "date", { group: "when", help: "Optional. Only for events over several days." }),
      f("end_time", "End time", "time", { group: "when", help: "Optional. Leave empty when the duration is not known." }),
      f("time_zone", "Time zone", "select", { group: "when", required: true, searchable: true, options: TIME_ZONES.map(([value, label]) => ({ value, label })), help: "Times are stored exactly as entered, in this zone. Changing the zone never moves the event." }),
      f("venue", "Location or meeting details", "text", { group: "where", max: 200, help: "Optional. e.g. “Makati City, Metro Manila” or “Online (Zoom link sent after you register)”. Do not paste a private meeting link." }),
      f("registration_type", "Where should the registration button go?", "select", { group: "reg", required: true, widget: "radio", options: [
        { value: "external", label: "External link", note: "A GoHighLevel page, form or funnel, or any other address." },
        { value: "page", label: "CMS event page", note: "A page for this event on the website, built with the page editor." },
        { value: "none", label: "No registration link", note: "Information only. The card shows no button." },
      ] }),
      f("registration_url", "Registration link", "url", { group: "reg", showIf: (r) => r.registration_type === "external", help: "The existing registration page, e.g. the GHL funnel. It opens in a new tab." }),
      f("cta_label", "Button text", "text", { group: "reg", max: 60, showIf: (r) => r.registration_type !== "none", help: "Optional. Leave empty for “Register”." }),
      f("event_page", "Also give this event its own page on the website", "boolean", { group: "reg", showIf: (r) => r.registration_type !== "page", help: "Optional. The card then links to “Event details”, while the button still goes to the registration link." }),
      f("featured_image_url", "Image URL", "url", { group: "media", image: true, help: "Optional. Shown on the event card (and on the event page, if it has one). Paste https://… or /assets/images/…" }),
      f("featured_image_alt", "Image description (alt text)", "text", { group: "media", max: 200, help: "Describe what the image shows, for screen readers. Needed when an image is set." }),
      f("slug", "Page address (URL slug)", "slug", { group: "page", required: true, showIf: (r) => eventHasPage(r), help: "Created from the title. Only used when the event has its own page." }),
      ...SEO.map((x) => (x.hidden ? x : { ...x, group: "page", showIf: (r) => eventHasPage(r) })),
      ...PAGE("Event page"),
      f("visible", "Show on the website", "boolean", { group: "visibility", help: "Turn off to hide a published event without deleting it. Press Publish to apply the change." }),
      ...PUBLISHING.filter((x) => ["authors", "byline", "sort_order"].includes(x.key)),
    ],
    // Earlier versions: related program, event type and status, the old registration options, venue details.
    retired: [
      f("event_type", "Event type"), f("related_program_id", "Related program"), f("date_label", "Text while no date is set"),
      f("registration_deadline", "Registration deadline", "date"), f("delivery_format", "Delivery format"), f("map_url", "Map link", "url"),
      f("meeting_url", "Online meeting link", "url"), f("capacity", "Capacity", "number"), f("event_status", "Event status"), f("cta_type", "Registration destination"),
      f("tags", "Tags", "tags"), f("review_date", "Next review date", "date"),
      f("featured_image_caption", "Image caption"), f("image_width", "Image width (px)", "number"), f("image_height", "Image height (px)", "number"),
      f("format_label", "Format text shown on the page"), f("online_info", "Online joining information", "textarea"), f("is_past", "This is a past event", "boolean"),
      ...OLD_OWNERSHIP,
    ],
  },

  resources: {
    label: "Resources", singular: "Resource", prefix: "res", labelField: "title", route: "/resources/{slug}/", page: "Resource page",
    description: "Articles, guides, templates, checklists and other resources.",
    groups: { main: "Resource", dest: "Card button", media: "Featured image", seo: "Search (SEO)", publishing: "Authors and tags" },
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
    label: "Testimonials", singular: "Testimonial", prefix: "tst", labelField: "display_name", route: null,
    description: "Quotes from participants and clients. Published testimonials set to “Show on the website” appear on the home page.",
    groups: { main: "Testimonial", look: "Photo", visibility: "Visibility" },
    fields: [
      f("quote", "Testimonial", "textarea", { group: "main", required: true, max: 2000, rows: 5, help: "The quote or feedback, as the person gave it." }),
      f("display_name", "Person’s name", "text", { group: "main", required: true, max: 120 }),
      f("role", "Role or title", "text", { group: "main", max: 120, help: "Optional. Shown below the name, e.g. HR Manager." }),
      f("featured_image_url", "Profile photo", "url", { group: "look", image: true, round: true, help: "Optional. A small round photo beside the name. Paste https://… or /assets/images/…" }),
      f("visible", "Show on the website", "boolean", { group: "visibility", help: "Turn off to hide it from the website. It stays saved here, so you can show it again later. Press Publish to apply the change." }),
      f("authors", "Authors", "authors", { hidden: true, public: false }),
      f("sort_order", "Display order", "number", { hidden: true }),
    ],
    // Earlier versions: role line, kind, source and consent tracking, display approval, card templates
    // and the card colour (the website now picks card colours from the brand palette by position).
    retired: [
      f("tone", "Card colour"),
      f("role_org", "Role or organization shown"), f("kind", "Kind"), f("attribution", "Attribution"), f("source", "Source"), f("source_ref", "Source link"),
      f("consent_status", "Consent"), f("consent_evidence", "Consent evidence", "textarea"), f("consent_date", "Consent date", "date"),
      f("display_approved", "Approved for display", "boolean"), f("featured_image_alt", "Photo description"),
      f("body_html", "Card template", "html", { long: 2 }), f("body_css", "Card styles (CSS)", "css"), f("doc_version", "Page document version", "number"),
      f("byline", "Byline"), f("tags", "Tags", "tags"), f("review_date", "Next review date", "date"), ...OLD_OWNERSHIP,
    ],
  },

  settings: {
    label: "Site settings", singular: "Site settings", prefix: "set", labelField: "brand", route: null, singleton: "site",
    description: "Logo, contacts, social links, global calls to action, footer, legal links and tracking IDs.",
    groups: { main: "Brand and contact", social: "Social and community", cta: "Global call to action", media: "Homepage media", footer: "Footer and legal", system: "Launch and tracking" },
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
      f("booking_url", "Booking link (Calendly)", "url", { group: "cta", help: "Your Calendly event link, e.g. https://calendly.com/your-name/discovery-call. Shows a 'Book a call' option on Contact and For Business. Leave empty to hide it." }),
      f("featured_video_url", "Homepage video (YouTube or Vimeo link)", "url", { group: "media", help: "A real Faith Works video. It loads only when a visitor presses play. Leave empty to hide the video block." }),
      f("featured_video_title", "Homepage video title", "text", { group: "media", max: 120 }),
      f("featured_video_poster_url", "Homepage video cover image", "url", { group: "media", image: true, help: "Optional. A session photo works well. Defaults to a photo from a past session." }),
      f("footer_tagline", "Footer line", "text", { group: "footer", max: 160 }),
      f("footer_motto", "Footer tagline", "text", { group: "footer", max: 80 }),
      f("privacy_url", "Privacy Notice URL", "url", { group: "footer" }),
      f("terms_url", "Terms URL", "url", { group: "footer" }),
      f("origin", "Website address (canonical origin)", "url", { group: "system", required: true, adminOnly: true }),
      f("staging", "Staging mode (noindex, staging bar, draft preview builds)", "boolean", { group: "system", adminOnly: true }),
      f("starter_kit_ready", "Starter Kit is ready for public traffic", "boolean", { group: "system", adminOnly: true }),
      f("ga4_id", "Google Analytics 4 measurement ID", "text", { group: "system", adminOnly: true, pattern: "^G-[A-Z0-9]{4,16}$", help: "Approved IDs only, e.g. G-ABC123XYZ. Never paste secrets or API keys." }),
      f("gtm_id", "Google Tag Manager container ID", "text", { group: "system", adminOnly: true, pattern: "^GTM-[A-Z0-9]{4,12}$" }),
      f("meta_pixel_id", "Meta Pixel ID", "text", { group: "system", adminOnly: true, pattern: "^[0-9]{6,20}$" }),
    ],
  },
};

export const CONTENT_COLLECTIONS = ["programs", "events", "resources", "testimonials"];
export const ALL_COLLECTIONS = [...CONTENT_COLLECTIONS, "settings"];

// Workflow and bookkeeping columns stored on every content row. Written only by the server.
export const SYSTEM_FIELDS = [
  "id", "status", "version", "write_id",
  "created_at", "created_by", "updated_at", "updated_by",
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
// Retired fields of a collection (readable from older rows; see the field notes above).
export const retiredOf = (collection) => COLLECTIONS[collection]?.retired || [];
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
  if (collection === "events") { rec.time_zone = "Asia/Manila"; rec.registration_type = "none"; rec.visible = true; }
  if (collection === "programs") { rec.enrollment_status = "waitlist"; rec.tone = "stone"; }
  if (collection === "resources") { rec.resource_type = "article"; }
  if (collection === "testimonials") { rec.visible = true; }
  return rec;
}

// Records and published copies saved by earlier versions, converted when they are read (by the
// server's store, the public snapshot and the website build). Idempotent; nothing is written
// until someone saves, and the retired values it reads stay stored.
//   statuses      Needed, Under Review, Changes Requested, Approved, Rejected → Draft
//   events        the old "Registration destination": an external page, or a page on this
//                 website (a /path), becomes External link with the same address; the
//                 "Get notified" form and No button become No registration link. Events with
//                 page content keep their page (event_page). Shown on the website.
//   testimonials  from before "Show on the website" (no card colour, no role field): shown,
//                 unless consent was declined or withdrawn or (live copies) the website was
//                 holding the live copy back for missing consent.
export function migrateRecord(collection, rec) {
  if (!rec || typeof rec !== "object") return rec;
  const out = { ...rec };
  if (CONTENT_COLLECTIONS.includes(collection) && out.status !== undefined) out.status = statusOf(out.status);
  if (collection === "events" && !out.registration_type) {
    const url = String(out.registration_url || "").trim();
    out.registration_type = ["external", "internal"].includes(out.cta_type) && url ? "external" : "none";
    if (out.registration_type === "none") out.registration_url = "";
    if (out.event_page !== true) out.event_page = !!String(out.body_html || "").trim();
    if (out.cta_type === "notify") out.cta_label = "";
    out.visible = true;
  }
  // Every save since then stores `role` (even empty); copies saved while cards had a colour keep it
  if (collection === "testimonials" && !out.tone && !("role" in out)) {
    out.visible = "consent_ok" in out ? out.consent_ok === true : !["declined", "withdrawn"].includes(out.consent_status);
  }
  return out;
}
