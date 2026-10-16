// Page documents. The page body (body_html + body_css) is the single source of a page's
// content; a few values come from Details through explicit markers, never by matching text:
//
//   data-cms-bind="title"          the element's text is the Details value (title, summary, price…)
//   data-cms-empty="…"             text shown (as "to be confirmed") when the bound value is empty
//   data-cms-href="registration-url"  the link destination is the Details value; removed when empty
//   data-cms-component="…"         generated content (badges, featured image, forms, lists)
//   data-cms-list="outputs"        list items reused on cards (programs)
//   data-cms-extract="format"      short text reused on cards (programs)
//
// Pure string code (no DOM): the CMS server, the dashboard and the website build share it.
// Records saved before page documents existed (no doc_version) are upgraded on read by
// upgradeRecord(): their structured fields become an equivalent document. Nothing stored is
// changed until someone saves, and the live site is unchanged until the next publish.

export const DOC_VERSION = 2;
export const isDoc = (rec) => Number(rec?.doc_version) >= DOC_VERSION;

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
export const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
  return NAMED[e.toLowerCase()] ?? m;
});

/* ---- What Details controls ------------------------------------------------- */
// twoWay: editing the element in the page editor changes the Details field too.
export const BINDINGS = {
  title: { label: "Title", field: "title", twoWay: true },
  summary: { label: "Summary", field: "summary", twoWay: true },
  price: { label: "Price", field: "price_text" },
  "event-type": { label: "Event type", field: "event_type" },
  "event-date": { label: "Date", field: "event_date" },
  "event-time": { label: "Time", field: "start_time" },
  duration: { label: "Duration (calculated from the start and end)", field: "end_time" },
  timezone: { label: "Time zone", field: "time_zone" },
  venue: { label: "Venue", field: "venue" },
  "read-time": { label: "Reading time (calculated from the article)", field: null },
  byline: { label: "Authors", field: "authors" },
  "publish-date": { label: "Publish date", field: "publish_date" },
  category: { label: "Category", field: "category" },
  quote: { label: "Exact quote", field: "quote" },
  "display-name": { label: "Name shown", field: "display_name" },
  role: { label: "Role or organization", field: "role_org" },
};
export const LINKS = {
  "registration-url": { label: "Registration URL", field: "registration_url" },
  "resource-url": { label: "Destination URL", field: "file_url" },
  "map-url": { label: "Map link", field: "map_url" },
  "meeting-url": { label: "Online meeting link", field: "meeting_url" },
};
export const COMPONENTS = {
  "status-badge": { label: "Status badge", help: "Shows the enrolment or event status from Details." },
  "featured-image": { label: "Featured image", help: "The featured image and its description from Details." },
  "article-meta": { label: "Byline, date and reading time", help: "Authors and publish date from Details; reading time is calculated." },
  "event-facts": { label: "Event facts", help: "Date, time, duration, venue, format and capacity from Details." },
  "event-actions": { label: "Registration button", help: "The registration button from Details → Venue and registration." },
  "program-form": { label: "Interest form", help: "The program’s interest form. Added by the website." },
  "other-programs": { label: "Other programs", help: "Listed automatically from the published programs." },
  "related-articles": { label: "Keep reading", help: "Other articles, listed automatically." },
  portrait: { label: "Photo", help: "The person’s photo from Details (only with their permission)." },
  "online-info": { label: "Joining online", help: "Online joining information (older events)." },
};

/* ---- Formatting ------------------------------------------------------------ */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Calendar dates are formatted in UTC from noon UTC: the date never shifts with a time zone.
export function fmtDate(iso, opts = { day: "numeric", month: "long", year: "numeric" }) {
  if (!DATE_RE.test(String(iso || ""))) return "";
  return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", ...opts }).format(new Date(`${iso}T12:00:00Z`));
}
const LONG = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  return { s: `${h % 12 || 12}:${String(m).padStart(2, "0")}`, ap: h >= 12 ? "PM" : "AM" };
}
export function timeRange(start, end) {
  if (!start) return null;
  const a = fmtTime(start);
  if (!end) return `${a.s} ${a.ap}`;
  const b = fmtTime(end);
  return a.ap === b.ap ? `${a.s}–${b.s} ${b.ap}` : `${a.s} ${a.ap}–${b.s} ${b.ap}`;
}

// Event times are stored as wall-clock date + time in the event's own time zone. Changing the
// zone never converts the stored values; the zone is only shown next to them.
export const TIME_ZONES = [
  ["Asia/Manila", "Asia/Manila (PHT, UTC+8)", "PHT"], ["Asia/Singapore", "Asia/Singapore (SGT, UTC+8)", "SGT"], ["Asia/Hong_Kong", "Asia/Hong Kong (HKT, UTC+8)", "HKT"],
  ["Asia/Tokyo", "Asia/Tokyo (JST, UTC+9)", "JST"], ["Asia/Seoul", "Asia/Seoul (KST, UTC+9)", "KST"], ["Asia/Jakarta", "Asia/Jakarta (WIB, UTC+7)", "WIB"],
  ["Asia/Kolkata", "Asia/Kolkata (IST, UTC+5:30)", "IST"], ["Asia/Dubai", "Asia/Dubai (GST, UTC+4)", "GST"], ["Australia/Sydney", "Australia/Sydney (AET)", "AET"],
  ["Pacific/Auckland", "Pacific/Auckland (NZT)", "NZT"], ["Europe/London", "Europe/London (UK time)", "UK time"], ["Europe/Berlin", "Europe/Berlin (CET)", "CET"],
  ["America/New_York", "America/New York (ET)", "ET"], ["America/Chicago", "America/Chicago (CT)", "CT"], ["America/Denver", "America/Denver (MT)", "MT"],
  ["America/Los_Angeles", "America/Los Angeles (PT)", "PT"], ["Pacific/Honolulu", "Pacific/Honolulu (HST)", "HST"], ["UTC", "UTC", "UTC"],
];
export const tzAbbrev = (tz) => TIME_ZONES.find(([k]) => k === tz)?.[2] || tz || "";

export function eventDuration(rec) {
  const sd = rec.event_date, ed = rec.end_date || rec.event_date;
  if (!DATE_RE.test(sd || "") || !DATE_RE.test(ed || "")) return "";
  const days = Math.round((Date.parse(`${ed}T00:00:00Z`) - Date.parse(`${sd}T00:00:00Z`)) / 86400000);
  if (days < 0) return "";
  if (days > 0 && !(rec.start_time && rec.end_time)) return `${days + 1} days`;
  if (!rec.start_time || !rec.end_time) return "";
  const mins = (Date.parse(`${ed}T${rec.end_time}:00Z`) - Date.parse(`${sd}T${rec.start_time}:00Z`)) / 60000;
  if (!(mins > 0)) return "";
  if (days > 0) return `${days + 1} days`;
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return [h ? `${h} hour${h === 1 ? "" : "s"}` : "", m ? `${m} minute${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
}
export function eventDateText(rec) {
  if (!DATE_RE.test(rec.event_date || "")) return rec.date_label || "Date to be announced";
  const a = fmtDate(rec.event_date, LONG);
  return rec.end_date && rec.end_date !== rec.event_date && DATE_RE.test(rec.end_date) ? `${a} – ${fmtDate(rec.end_date, LONG)}` : a;
}
export function eventTimeText(rec) {
  const t = timeRange(rec.start_time, rec.end_time);
  if (!t) return "";
  const tz = rec.time_zone || "Asia/Manila";
  return `${t} ${tzAbbrev(tz)}`.trim();
}
export function isPastEvent(rec, today = new Date()) {
  if (rec.event_status === "past" || (rec.is_past === true && !isDoc(rec))) return true;
  const last = DATE_RE.test(rec.end_date || "") ? rec.end_date : rec.event_date;
  return DATE_RE.test(last || "") ? new Date(`${last}T12:00:00+08:00`) < today : false;
}

/* ---- Reading time ------------------------------------------------------------ */
export function textOf(html) {
  return decode(String(html || "").replace(/<!--[^]*?-->/g, " ").replace(/<(script|style|template)\b[^]*?<\/\1\s*>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
// Words of the page text, leaving out what Details and the website generate.
export function readingTime(html) {
  let src = String(html || "");
  for (const attr of ["data-cms-bind", "data-cms-component"]) src = removeMarked(src, attr);
  const words = textOf(src).split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  if (!words) return "";
  return `${Math.max(1, Math.round(words / 180))} min read`;
}

/* ---- A small tag scanner ----------------------------------------------------------
   Finds elements carrying a marker and the extent of their content. It understands quoted
   attributes, comments and raw-text elements, which is all the page markup needs. */
const VOID = new Set("area base br col embed hr img input link meta source track wbr".split(" "));
const RAW = new Set("script style textarea title xmp iframe noscript noembed noframes".split(" "));

function scanTag(src, i) { // src[i] === "<"; returns { end, name, closing } or null
  let j = i + 1;
  const closing = src[j] === "/";
  if (closing) j++;
  const m = /^[a-zA-Z][^\s/>]*/.exec(src.slice(j, j + 64));
  if (!m) return null;
  let k = j + m[0].length, q = "";
  while (k < src.length) {
    const c = src[k];
    if (q) { if (c === q) q = ""; }
    else if (c === '"' || c === "'") { if (/=\s*$/.test(src.slice(Math.max(j, k - 8), k))) q = c; }
    else if (c === ">") return { end: k + 1, name: m[0].toLowerCase(), closing, selfClosing: src[k - 1] === "/" };
    k++;
  }
  return null;
}
function* tags(src) {
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) return;
    if (src.startsWith("<!--", lt)) { const e = src.indexOf("-->", lt + 4); i = e < 0 ? src.length : e + 3; continue; }
    if (src[lt + 1] === "!" || src[lt + 1] === "?") { const e = src.indexOf(">", lt); i = e < 0 ? src.length : e + 1; continue; }
    const t = scanTag(src, lt);
    if (!t) { i = lt + 1; continue; }
    yield { ...t, start: lt };
    i = t.end;
    if (!t.closing && RAW.has(t.name) && !t.selfClosing) {
      const re = new RegExp(`</${t.name}\\s*>`, "ig");
      re.lastIndex = i;
      const m = re.exec(src);
      if (!m) return;
      yield { start: m.index, end: m.index + m[0].length, name: t.name, closing: true };
      i = m.index + m[0].length;
    }
  }
}
export function attrsOf(openTag) {
  const out = {};
  const body = openTag.replace(/^<[^\s/>]+/, "").replace(/\/?>$/, "");
  for (const m of body.matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}
// Every element whose open tag has attribute `attr` (optionally equal to `value`), with the
// ranges of the element and of its content. Nested matches are included.
export function findMarked(src, attr, value) {
  const all = [...tags(src)];
  const out = [];
  all.forEach((t, idx) => {
    if (t.closing) return;
    const open = src.slice(t.start, t.end);
    if (!open.toLowerCase().includes(attr)) return;
    const a = attrsOf(open);
    if (!(attr in a) || (value !== undefined && a[attr] !== value)) return;
    if (VOID.has(t.name) || t.selfClosing) { out.push({ start: t.start, openEnd: t.end, innerEnd: t.end, end: t.end, name: t.name, attrs: a, open }); return; }
    let depth = 0;
    for (let j = idx + 1; j < all.length; j++) {
      const u = all[j];
      if (u.name !== t.name) continue;
      if (!u.closing && !u.selfClosing) depth++;
      else if (u.closing) {
        if (depth === 0) { out.push({ start: t.start, openEnd: t.end, innerEnd: u.start, end: u.end, name: t.name, attrs: a, open }); return; }
        depth--;
      }
    }
  });
  return out;
}
// Applies edits (non-overlapping or nested-outermost-first) from the end so indices stay valid.
function splice(src, edits) {
  edits.sort((a, b) => b.start - a.start);
  let out = src, floor = Infinity;
  for (const e of edits) {
    if (e.end > floor) continue; // inside an element already replaced
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    floor = e.start;
  }
  return out;
}
function removeMarked(src, attr) {
  return splice(src, findMarked(src, attr).map((m) => ({ start: m.start, end: m.end, text: " " })));
}
function setAttr(open, name, value) {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  if (re.test(open)) return open.replace(re, (m, p) => `${p}"${esc(value)}"`);
  return open.replace(/\s*(\/?)>$/, ` ${name}="${esc(value)}"$1>`);
}

/* ---- Bindings ---------------------------------------------------------------------- */
export function getBoundText(src, key) {
  const m = findMarked(src, "data-cms-bind", key)[0];
  if (!m) return null;
  const inner = src.slice(m.openEnd, m.innerEnd);
  return /class="tbc"/.test(inner) ? "" : textOf(inner);
}
// Sets the text of every element bound to `key` (an empty value shows its data-cms-empty text).
export function setBoundText(src, key, text) {
  return splice(src, findMarked(src, "data-cms-bind", key).filter((m) => !VOID.has(m.name)).map((m) => {
    const value = String(text ?? "").trim();
    const inner = value ? esc(value) : m.attrs["data-cms-empty"] ? `<span class="tbc">${esc(m.attrs["data-cms-empty"])}</span>` : "";
    return { start: m.openEnd, end: m.innerEnd, text: inner };
  }));
}
export function setBoundLink(src, key, url, { removeEmpty = false } = {}) {
  return splice(src, findMarked(src, "data-cms-href", key).map((m) => (url || !removeEmpty
    ? { start: m.start, end: m.openEnd, text: setAttr(m.open, "href", url || "#") }
    : { start: m.start, end: m.end, text: "" })));
}
// Replaces each component's content with render(name, attrs): a string is the new content,
// null removes the element (nothing to show).
export function fillComponents(src, render) {
  const marks = findMarked(src, "data-cms-component");
  const outer = marks.filter((m) => !marks.some((o) => o !== m && o.start < m.start && o.end >= m.end));
  return splice(src, outer.map((m) => {
    const html = render(m.attrs["data-cms-component"], m.attrs);
    return html === null || html === undefined ? { start: m.start, end: m.end, text: "" } : { start: m.openEnd, end: m.innerEnd, text: html };
  }));
}
export function extractList(src, key) {
  const m = findMarked(src, "data-cms-list", key)[0];
  if (!m) return null;
  const inner = src.slice(m.openEnd, m.innerEnd);
  return [...inner.matchAll(/<li\b[^>]*>([^]*?)<\/li\s*>/gi)].map((x) => textOf(x[1])).filter(Boolean);
}
export function extractText(src, key) {
  const m = findMarked(src, "data-cms-extract", key)[0];
  if (!m) return null;
  const inner = src.slice(m.openEnd, m.innerEnd);
  return /class="tbc"/.test(inner) ? "" : textOf(inner);
}
export const hasMarker = (src, attr, value) => findMarked(src, attr, value).length > 0;

/* ---- Values Details provides --------------------------------------------------------- */
// authorNames: email → display name (the dashboard passes the CMS user list; the build uses
// the stored byline, which the server computes on save).
export function bylineOf(rec, authorNames) {
  if (authorNames && Array.isArray(rec.authors) && rec.authors.length) {
    const names = rec.authors.map((e) => authorNames[e] || e.split("@")[0]).filter(Boolean);
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "";
  }
  return rec.byline || rec.author || "";
}
export function bindingValues(collection, rec, { authorNames } = {}) {
  const v = {
    title: rec.title || rec.display_name || "", summary: rec.summary || "", category: rec.category || "",
    byline: bylineOf(rec, authorNames), "publish-date": fmtDate(rec.publish_date),
  };
  if (collection === "programs") v.price = rec.price_text || "";
  if (collection === "events") Object.assign(v, {
    "event-type": rec.event_type || "", "event-date": eventDateText(rec), "event-time": eventTimeText(rec), duration: eventDuration(rec),
    timezone: TIME_ZONES.find(([k]) => k === (rec.time_zone || "Asia/Manila"))?.[1] || rec.time_zone || "", venue: rec.venue || "",
  });
  if (collection === "resources") v["read-time"] = rec.resource_type === "article" || !rec.resource_type ? readingTime(rec.body_html) || rec.read_time || "" : "";
  if (collection === "testimonials") Object.assign(v, { title: rec.display_name || "", quote: rec.quote || "", "display-name": rec.display_name || "", role: rec.role_org || "Workshop participant" });
  const links = {
    "registration-url": rec.registration_url || "", "resource-url": rec.file_url || "", "map-url": rec.map_url || "", "meeting-url": rec.meeting_url || "",
  };
  return { text: v, links };
}
// Writes every Details value into the document (dashboard: keeps the HTML readable and in
// sync; build: authoritative, so the page always matches Details).
export function applyBindings(src, values, { removeEmptyLinks = false } = {}) {
  let out = src;
  for (const [k, text] of Object.entries(values.text)) if (out.includes(`"${k}"`) || out.includes(`'${k}'`) || out.includes(`=${k}`)) out = setBoundText(out, k, text);
  for (const [k, url] of Object.entries(values.links)) if (out.includes("data-cms-href")) out = setBoundLink(out, k, url, { removeEmpty: removeEmptyLinks });
  return out;
}

/* ---- Components that depend only on the record ----------------------------------------- */
export const tbc = (v, fallback = "To be confirmed") => (v == null || v === "" ? `<span class="tbc">${fallback}</span>` : esc(v));
export const list = (items, cls = "", marker = "") => `<ul${cls ? ` class="${cls}"` : ""}${marker}>${(items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
export const extLink = (url, label, track) =>
  `<a class="text-link" href="${esc(url)}" target="_blank" rel="noopener"${track ? ` data-track="${track}"` : ""}>${esc(label)} <span class="link-arrow" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`;

export const STATUS = {
  open: ["Registration open", "open"], waitlist: ["Waitlist", "waitlist"], "sold-out": ["Sold out · waitlist open", "soldout"],
  tba: ["Dates to be announced", "tba"], past: ["Past event", "past"], inquiry: ["Ask about the next run", "waitlist"], planned: ["Planned · not yet open", "planned"],
};
export function badge(key, label) {
  const [text, tone] = STATUS[key] || [label || key, "tba"];
  return `<span class="badge badge--${tone}">${esc(label || text)}</span>`;
}

// Responsive picture for site images ({ base, widths, … } from the image pipeline) or a plain URL.
export function img(image, sizes, cls = "") {
  if (!image) return "";
  if (image.url) return `<picture${cls ? ` class="${cls}"` : ""}><img src="${esc(image.url)}"${image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ""} alt="${esc(image.alt)}" loading="lazy" decoding="async"></picture>`;
  const base = "/" + image.base.replace(/^\//, "");
  const ws = image.widths;
  const set = (ext) => ws.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  const mid = ws.find((w) => w >= 960) || ws[ws.length - 1];
  return `<picture${cls ? ` class="${cls}"` : ""}><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}"><img src="${base}-${mid}.jpg" srcset="${set("jpg")}" sizes="${sizes}" width="${image.width}" height="${image.height}" alt="${esc(image.alt)}" loading="lazy" decoding="async" style="object-position:${esc(image.position || "50% 50%")}"></picture>`;
}
export function featuredImage(collection, rec) {
  if (collection === "resources") {
    const url = rec.cover_image_url, meta = rec.cover_image_meta;
    if (!url) return null;
    return meta?.base && url.replace(/^\//, "").startsWith(meta.base + "-") ? { ...meta, alt: rec.cover_image_alt || "" } : { url, alt: rec.cover_image_alt || "" };
  }
  if (!rec.featured_image_url) return null;
  const legacySize = !isDoc(rec) && rec.image_width && rec.image_height ? { width: rec.image_width, height: rec.image_height } : {};
  return { url: rec.featured_image_url, alt: rec.featured_image_alt || "", ...legacySize };
}

export const FORMAT = { in_person: "In person", online: "Online", hybrid: "Hybrid (in person and online)", tbc: "To be confirmed" };
const eventFormat = (rec) => (!isDoc(rec) && rec.format_label) || FORMAT[rec.delivery_format] || null;

export function eventFacts(rec, today = new Date()) {
  const past = isPastEvent(rec, today);
  const tz = rec.time_zone || "Asia/Manila";
  const d = DATE_RE.test(rec.event_date || "");
  const t = timeRange(rec.start_time, rec.end_time);
  const dateHtml = d
    ? rec.end_date && rec.end_date !== rec.event_date && DATE_RE.test(rec.end_date)
      ? `<time datetime="${rec.event_date}">${fmtDate(rec.event_date, LONG)}</time> – <time datetime="${rec.end_date}">${fmtDate(rec.end_date, LONG)}</time>`
      : `<time datetime="${rec.event_date}">${fmtDate(rec.event_date, LONG)}</time>`
    : esc(rec.date_label || "Date to be announced");
  const facts = [
    ["Status", badge(past ? "past" : rec.event_status)],
    ["Date", dateHtml],
    [tz !== "Asia/Manila" ? `Time (${esc(tz)})` : "Time (Asia/Manila)", t ? esc(t) + (tz !== "Asia/Manila" ? "" : " PHT") : `<span class="tbc">${past ? "Not listed" : "To be confirmed"}</span>`],
  ];
  const dur = eventDuration(rec);
  if (dur) facts.push(["Duration", esc(dur)]);
  facts.push(
    ["Venue", tbc(rec.venue, past ? "Not listed" : "To be confirmed") + (rec.map_url ? ` · ${extLink(rec.map_url, "Map")}` : "")],
    ["Format", tbc(eventFormat(rec))],
    ["Capacity", tbc(rec.capacity, past ? "Not listed" : "To be confirmed")]);
  if (rec.meeting_url && !past) facts.push(["Online", extLink(rec.meeting_url, "Joining link")]);
  if (rec.registration_deadline && !past) facts.push(["Register by", `<time datetime="${rec.registration_deadline}">${fmtDate(rec.registration_deadline)}</time>`]);
  return facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}
export function eventCta(rec, past) {
  const type = rec.cta_type || "none", url = rec.registration_url, label = rec.cta_label;
  const id = rec.slug;
  if (!past && type === "notify") return `<a class="btn btn--light" href="/workshops/?event=${esc(id)}#notify">${esc(label || "Get notified")}<span class="sr-only"> about ${esc(rec.title)}</span></a>`;
  if (!past && type === "internal" && url) return `<a class="btn" href="${esc(url)}">${esc(label || "Register")}</a>`;
  if (!past && type === "external" && url) return `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener" data-track="registration_start">${esc(label || "Register")} <span class="btn__arrow" aria-hidden="true">↗</span><span class="sr-only"> (opens the event’s own page in a new tab)</span></a>`;
  if (past && type === "external" && url) return extLink(url, label || "Original event page");
  return "";
}
export function articleMeta(rec) {
  const date = DATE_RE.test(rec.publish_date || "") ? `<time datetime="${rec.publish_date}">${fmtDate(rec.publish_date)}</time>` : "Publish date to be set";
  const rt = bindingValues("resources", rec).text["read-time"];
  return [esc(bylineOf(rec)), date, rt ? esc(rt) : ""].filter(Boolean).join(" · ");
}
// Components the record alone can render (the website build adds forms and lists).
export function recordComponent(name, collection, rec, { today = new Date(), authorNames } = {}) {
  switch (name) {
    case "status-badge": return collection === "events" ? badge(isPastEvent(rec, today) ? "past" : rec.event_status) : badge(rec.enrollment_status, rec.enrollment_label || "");
    case "featured-image": {
      const im = featuredImage(collection, rec);
      if (!im) return null;
      const cap = !isDoc(rec) && rec.featured_image_caption ? `<figcaption class="small">${esc(rec.featured_image_caption)}</figcaption>` : "";
      return img(im, "(min-width: 1200px) 1200px, 100vw") + cap;
    }
    case "portrait": return rec.featured_image_url ? `<img src="${esc(rec.featured_image_url)}" alt="${esc(rec.featured_image_alt || "")}" loading="lazy" decoding="async">` : null;
    case "article-meta": return articleMeta({ ...rec, byline: bylineOf(rec, authorNames) });
    case "event-facts": return eventFacts(rec, today);
    case "online-info": return rec.online_info && !isPastEvent(rec, today) ? `<h2 id="join-title" class="h3">Joining online</h2><p>${esc(rec.online_info)}</p>` : null;
    default: return undefined; // not a record component
  }
}

/* ---- Program output illustrations (static interface fragments) ------------------------ */
export const PREVIEWS = {
  "readiness-map": () => `<figure class="preview" data-ui>
      <figcaption class="preview__cap">Example output · Workflow readiness map</figcaption>
      <table class="preview__table">
        <thead><tr><th scope="col">Recurring task</th><th scope="col">How often</th><th scope="col">Risk</th><th scope="col">Who reviews</th></tr></thead>
        <tbody>
          <tr class="is-picked"><td>Weekly team update</td><td>Weekly</td><td><span class="chip chip--low">Low</span></td><td>You</td></tr>
          <tr><td>Inquiry follow-up</td><td>Daily</td><td><span class="chip chip--low">Low</span></td><td>Owner</td></tr>
          <tr><td>Client proposal</td><td>Monthly</td><td><span class="chip chip--mid">Medium</span></td><td>Manager</td></tr>
        </tbody>
      </table>
      <p class="preview__foot"><span class="chip chip--pick">Start here</span> Weekly, low risk and easy to check.</p>
    </figure>`,
  "content-plan": () => `<figure class="preview" data-ui>
      <figcaption class="preview__cap">Example output · Four-week content plan</figcaption>
      <ol class="preview__plan">
        <li><b>Week 1</b><span>Answer a question clients often ask</span><span class="chip chip--done">Reviewed</span></li>
        <li><b>Week 2</b><span>Share a practical how-to from your work</span><span class="chip chip--done">Reviewed</span></li>
        <li><b>Week 3</b><span>A lesson from a recent project</span><span class="chip chip--draft">AI draft</span></li>
        <li><b>Week 4</b><span>Invite a conversation about one problem</span><span class="chip">Idea</span></li>
      </ol>
    </figure>`,
  prototype: () => `<figure class="preview preview--proto" data-ui>
      <figcaption class="preview__cap">Example output · A first landing page and lead tracker</figcaption>
      <div class="proto">
        <div class="proto__bar"><i></i><i></i><i></i><span>your-first-version</span></div>
        <div class="proto__body">
          <div class="proto__page"><span class="proto__nav"></span><span class="proto__h"></span><span class="proto__h proto__h--short"></span><span class="proto__btn"></span></div>
          <div class="proto__tracker">
            <p class="proto__title">Lead tracker</p>
            <p class="proto__row"><span>New inquiry</span><b class="is-new">New</b></p>
            <p class="proto__row"><span>Workshop question</span><b class="is-follow">Follow up</b></p>
            <p class="proto__row"><span>Team proposal</span><b class="is-done">Done</b></p>
          </div>
        </div>
      </div>
    </figure>`,
  assistant: () => `<figure class="preview" data-ui>
      <figcaption class="preview__cap">Example output · A business assistant with review points</figcaption>
      <div class="preview__chat">
        <p class="preview__msg preview__msg--in">Can I move my session to next week?</p>
        <p class="preview__msg preview__msg--out">Draft reply: “Yes, here are the available dates…”<span class="chip chip--draft">Needs your review</span></p>
        <p class="preview__msg preview__msg--flag">Refund request detected → handed to a person</p>
      </div>
    </figure>`,
};
export const preview = (kind) => (PREVIEWS[kind] || (() => ""))();

export function programCtaLabel(rec) {
  return rec.cta_label || { waitlist: "Join the waitlist", inquiry: "Ask about the next run", planned: "Register your interest", open: "Register" }[rec.enrollment_status] || "Ask about this program";
}

/* ---- Upgrading records saved before page documents ------------------------------------ */
// Builds the same page the old fixed template produced, as an editable document. Values
// Details still owns are bound; everything else becomes ordinary page content.
const arr = (v) => (Array.isArray(v) ? v : []);
function legacyProgram(r) {
  const cta = programCtaLabel(r);
  const external = r.cta_url && !r.cta_url.startsWith("#");
  const facts = [
    ["Status", `<dd data-cms-component="status-badge"></dd>`],
    ["Format", `<dd data-cms-extract="format">${tbc(r.format)}</dd>`],
    ["Time commitment", `<dd>${tbc(r.time_commitment)}</dd>`],
    ["Location", `<dd>${tbc(r.location)}</dd>`],
    ["Fee", `<dd data-cms-bind="price" data-cms-empty="Published when the next intake is confirmed">${tbc(r.price_text, "Published when the next intake is confirmed")}</dd>`],
    ["Next intake", `<dd>${tbc(r.next_intake, "To be announced")}</dd>`],
    ["Instructor", `<dd>${tbc(r.instructor)}</dd>`],
  ];
  const isExt = /^https?:/i.test(r.cta_url || "");
  const inclusions = arr(r.inclusions), exclusions = arr(r.exclusions), agenda = arr(r.agenda), faq = arr(r.faq);
  return `<section class="phero phero--${esc(r.tone || "stone")} phero--program" aria-labelledby="program-title">
  <div class="wrap phero__grid">
    <div class="phero__copy">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/learn/">Learn AI</a><span aria-hidden="true">/</span><span aria-current="page">${esc(r.short_title || r.title)}</span></nav>
      <h1 id="program-title" data-cms-bind="title">${esc(r.title)}</h1>
      <p class="phero__lead" data-cms-bind="summary">${esc(r.summary)}</p>
      <div class="actions">
        ${external
    ? `<a class="btn" href="${esc(r.cta_url)}"${isExt ? ' target="_blank" rel="noopener"' : ""} data-track="registration_start">${esc(cta)} <span class="btn__arrow" aria-hidden="true">↗</span>${isExt ? '<span class="sr-only"> (opens in a new tab)</span>' : ""}</a>`
    : `<a class="btn" href="#register" data-track="registration_start">${esc(cta)} <span class="btn__arrow btn__arrow--down" aria-hidden="true">↓</span></a>`}
        <a class="btn btn--light" href="/contact/?type=programs">Ask a question</a>
      </div>
    </div>
    <aside class="facts" aria-label="Program facts">
      <dl>${facts.map(([k, v]) => `<div><dt>${k}</dt>${v}</div>`).join("")}</dl>
    </aside>
  </div>
</section>

<div class="article__cover wrap" data-cms-component="featured-image"></div>

<section class="section wrap split" aria-labelledby="for-title">
  <div>
    <h2 id="for-title">Who it’s for</h2>
    <p class="split__lead">${esc(r.problem)}</p>
  </div>
  <div>${list(r.target_audience, "ticks", ' data-cms-list="audience"')}</div>
</section>

<section class="section band band--stone" aria-labelledby="outcomes-title">
  <div class="wrap outcomes">
    <div>
      <h2 id="outcomes-title">What you’ll learn</h2>
      <ol class="numbered" data-cms-list="outcomes">${arr(r.learning_outcomes).map((o) => `<li>${esc(o)}</li>`).join("")}</ol>
    </div>
    <div class="outcomes__leave">
      <h3>What you leave with</h3>
      ${list(r.outputs, "ticks", ' data-cms-list="outputs"')}
      ${preview(r.preview_kind)}
      <p class="small">Illustrative example. Your output depends on the task you bring.</p>
    </div>
  </div>
</section>
${r.body_html && r.body_html.trim() ? `
<section class="section wrap" aria-label="About this program"><div class="cms-body">${r.body_html}</div></section>
` : ""}${agenda.length ? `
<section class="section wrap" aria-labelledby="agenda-title">
  <div class="section-head"><h2 id="agenda-title">How it runs</h2><p>The outline below is the planned flow. Session dates and durations are confirmed with each intake.</p></div>
  <ol class="agenda">${agenda.map((a) => `<li><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></li>`).join("")}</ol>
</section>
` : ""}
<section class="section wrap needs" aria-labelledby="needs-title">
  <h2 id="needs-title" class="sr-only">Requirements and scope</h2>
  <div class="needs__col"><h3>What you need</h3>${list(r.requirements, "ticks", ' data-cms-list="requirements"')}</div>
  ${inclusions.length ? `<div class="needs__col"><h3>Included</h3>${list(inclusions, "ticks")}</div>` : ""}
  ${exclusions.length ? `<div class="needs__col needs__col--not"><h3>Not included</h3>${list(exclusions, "crosses")}</div>` : ""}
</section>
${faq.length ? `
<section class="section section--rule wrap" aria-labelledby="pfaq-title">
  <div class="faq"><div class="faq__head"><h2 id="pfaq-title">Questions about this program</h2></div>
  <div class="faq__items">${faq.map((x) => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join("")}</div></div>
</section>
` : ""}
<section class="section band band--pink" id="register" aria-labelledby="register-title">
  <div class="wrap formblock">
    <div class="formblock__intro">
      <h2 id="register-title">${esc(cta)}.</h2>
      <p>${r.enrollment_status === "open" ? "Reserve your place." : "There is no open intake yet. Leave your details and we will contact you when dates, fees and inclusions are confirmed. No payment is taken here."}</p>
      <span data-cms-component="status-badge"></span>
    </div>
    <div data-cms-component="program-form"></div>
  </div>
</section>

<section class="section wrap" aria-labelledby="more-title">
  <h2 id="more-title" class="h3">Other programs</h2>
  <ul class="more" data-cms-component="other-programs"></ul>
</section>
`;
}
function legacyEvent(r) {
  return `<section class="phero phero--stone phero--program" aria-labelledby="event-title">
  <div class="wrap phero__grid">
    <div class="phero__copy">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/workshops/">Workshops</a><span aria-hidden="true">/</span><span aria-current="page">${esc(r.event_type || "Event")}</span></nav>
      <h1 id="event-title" data-cms-bind="title">${esc(r.title)}</h1>
      <p class="phero__lead" data-cms-bind="summary">${esc(r.summary)}</p>
      <div class="actions" data-cms-component="event-actions"></div>
    </div>
    <aside class="facts" aria-label="Event facts">
      <dl data-cms-component="event-facts"></dl>
    </aside>
  </div>
</section>
<figure class="article__cover wrap" data-cms-component="featured-image"></figure>
<section class="section wrap" aria-label="About this event"><div class="cms-body">${r.body_html}</div></section>
<section class="section wrap" aria-labelledby="join-title" data-cms-component="online-info"></section>
`;
}
function legacyArticle(r) {
  return `<article class="article">
  <header class="article__head wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/resources/">Resources</a><span aria-hidden="true">/</span><span aria-current="page">Article</span></nav>
    <h1 data-cms-bind="title">${esc(r.title)}</h1>
    <p class="article__lead" data-cms-bind="summary">${esc(r.summary)}</p>
    <p class="article__meta" data-cms-component="article-meta"></p>
  </header>
  <div class="article__cover wrap" data-cms-component="featured-image"></div>
  <div class="article__body">
${r.body_html || ""}
  </div>
</article>
<section class="section wrap" aria-labelledby="related-title">
  <h2 id="related-title" class="h3">Keep reading</h2>
  <ul class="more" data-cms-component="related-articles"></ul>
</section>
`;
}
export const TESTIMONIAL_CARD = `<figure class="quote">
  <div class="quote__portrait" data-cms-component="portrait"></div>
  <blockquote><p data-cms-bind="quote"></p></blockquote>
  <figcaption><b data-cms-bind="display-name"></b><span data-cms-bind="role"></span></figcaption>
</figure>`;

export function upgradeRecord(collection, rec) {
  if (!rec || isDoc(rec) || !["programs", "events", "resources", "testimonials"].includes(collection)) return rec;
  const out = { ...rec, doc_version: DOC_VERSION, page_layout: rec.page_layout || "site", upgraded: true };
  const hasBody = !!String(rec.body_html || "").trim();
  if (collection === "programs") out.body_html = legacyProgram(rec);
  else if (collection === "events") out.body_html = hasBody ? legacyEvent(rec) : "";
  else if (collection === "resources") out.body_html = (rec.resource_type || "article") === "article" ? legacyArticle(rec) : rec.body_html || "";
  else if (collection === "testimonials") out.body_html = TESTIMONIAL_CARD;
  // Values the page shows from Details are written in, as the editor would.
  if (out.body_html) out.body_html = applyBindings(out.body_html, bindingValues(collection, out));
  if (collection === "events" && !hasBody) out.upgraded = false;
  return out;
}
