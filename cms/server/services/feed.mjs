// Newsletter RSS feed for GoHighLevel (cms/NEWSLETTER-GHL.md). Built on request from the public
// snapshot (pub.published(): live content only, no drafts, hidden events or private fields), so
// there is no table, no cron and no AI. GHL writes the copy, reviews, approves and sends.
//
// Items: every published resource (newest first) and every published, visible event that has not
// ended yet (soonest first). GUIDs are stable (resource:<id>, event:<id>) so an item is never "new"
// twice. <category> tells them apart (Resource + its category / Event).
import { eventHasPage } from "../../shared/schema.mjs";
import { emailCard } from "./feed-card.mjs";

const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const cdata = (s) => `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
const clean = (s, max) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const rfc822 = (v) => { const d = new Date(v || 0); return (isNaN(d) ? new Date(0) : d).toUTCString(); };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Feed settings from the environment. Domains are never hardcoded.
export function feedConfig(env = process.env, cfg = {}) {
  const site = (cfg.publicSiteUrl || "").replace(/\/$/, "");
  const num = (v, d) => Math.max(1, Math.min(50, Number(v) || d));
  return {
    resourceUrl: env.NEWSLETTER_RESOURCE_URL || (site ? `${site}/resources?{slug}` : ""),
    eventPageUrl: env.NEWSLETTER_EVENT_PAGE_URL || (site ? `${site}/events/{slug}/` : ""),
    eventsUrl: env.NEWSLETTER_EVENTS_URL || (site ? `${site}/workshops` : ""),
    assetOrigin: (env.NEWSLETTER_ASSET_ORIGIN || "").replace(/\/$/, ""),
    feedLink: env.NEWSLETTER_FEED_LINK || (site ? `${site}/resources` : ""),
    feedSelf: (cfg.baseUrl || "").replace(/\/$/, "") + "/rss.xml",
    title: env.NEWSLETTER_FEED_TITLE || "Faith Works: latest resources and upcoming events",
    maxResources: num(env.NEWSLETTER_MAX_RESOURCES, 10),
    maxEvents: num(env.NEWSLETTER_MAX_EVENTS, 10),
  };
}

// Today's date (YYYY-MM-DD) in a time zone; falls back to UTC for an unknown zone.
function todayIn(tz, now) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
  catch { return now.toISOString().slice(0, 10); }
}

const time12 = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); if (!m) return ""; const h = +m[1]; return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`; };
const dayLabel = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

export function eventWhen(e) {
  let s = dayLabel(e.event_date);
  if (e.start_time) s += `, ${time12(e.start_time)}${e.end_time ? ` – ${time12(e.end_time)}` : ""}`;
  if (DATE.test(e.end_date || "") && e.end_date !== e.event_date) s += ` to ${dayLabel(e.end_date)}`;
  return s + (e.time_zone ? ` (${e.time_zone})` : "");
}

// Date label (FRI · NOV 6) and time line (7:00 – 10:00 PM (Manila), or a date range for multi-day events).
const shortTz = (tz) => (tz ? (tz.split("/").pop() || tz).replace(/_/g, " ") : "");
export function eventChip(e) {
  return new Date(`${e.event_date}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).replace(",", " ·").toUpperCase();
}
export function eventTime(e) {
  const md = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  let s = "";
  if (DATE.test(e.end_date || "") && e.end_date !== e.event_date) s = `${md(e.event_date)} – ${md(e.end_date)}`;
  else if (e.start_time) s = `${time12(e.start_time)}${e.end_time ? ` – ${time12(e.end_time)}` : ""}`;
  return s && e.time_zone ? `${s} (${shortTz(e.time_zone)})` : s;
}

export function feedItems(snap, fc, now = new Date()) {
  const abs = (u) => (!u ? "" : /^https?:\/\//i.test(u) ? u : fc.assetOrigin && u.startsWith("/") ? fc.assetOrigin + u : "");
  const slugUrl = (tpl, slug) => (tpl && slug ? tpl.replace("{slug}", encodeURIComponent(slug)) : "");

  const resources = (snap.resources || [])
    .filter((r) => r.id && r.title && r.slug)
    .map((r) => {
      const url = slugUrl(fc.resourceUrl, r.slug);
      return {
        kind: "resource", guid: `resource:${r.id}`, title: r.title, url,
        summary: clean(r.summary || r.meta_description, 500),
        image: abs(r.social_image_url || r.cover_image_url), image_alt: r.cover_image_alt || r.title,
        date: r.published_at || r.publish_date || r.updated_at || "",
        categories: ["Resource", r.resource_type, r.category].filter(Boolean), cta: "Read more",
      };
    })
    .filter((r) => r.url)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, fc.maxResources);

  const events = (snap.events || [])
    .filter((e) => e.id && e.title && DATE.test(e.event_date || "") && e.visible !== false)
    .filter((e) => (DATE.test(e.end_date || "") ? e.end_date : e.event_date) >= todayIn(e.time_zone, now))
    .map((e) => {
      const page = eventHasPage(e) ? slugUrl(fc.eventPageUrl, e.slug) : "";
      const reg = e.registration_type === "external" && /^https?:\/\//i.test(e.registration_url || "") ? e.registration_url : "";
      const when = eventWhen(e);
      return {
        kind: "event", guid: `event:${e.id}`, title: e.title, url: reg || page || fc.eventsUrl,
        when, chip: eventChip(e), time: eventTime(e), location: clean(e.venue, 200), summary: clean(e.summary, 500),
        image: abs(e.featured_image_url), image_alt: e.featured_image_alt || e.title,
        date: e.published_at || e.created_at || "", start: `${e.event_date}T${e.start_time || "00:00"}`,
        end: DATE.test(e.end_date || "") ? `${e.end_date}T${e.end_time || "23:59"}` : e.end_time ? `${e.event_date}T${e.end_time}` : "",
        categories: ["Event"], cta: reg || e.registration_type === "page" ? (e.cta_label || "Register") : "Event details",
      };
    })
    .filter((e) => e.url)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, fc.maxEvents);

  return [...events, ...resources];
}

export function buildFeed(items, fc, now = new Date()) {
  const out = items.map((it, i) => {
    const text = it.kind === "event"
      ? `Event · ${it.when}${it.location ? ` · ${it.location}` : ""}${it.summary ? ` — ${it.summary}` : ""}`
      : `Resource${it.categories[1] ? ` · ${it.categories[1]}` : ""}${it.summary ? ` — ${it.summary}` : ""}`;
    const html = emailCard(it, { icons: fc.assetOrigin, first: !items.slice(0, i).some((o) => o.kind === it.kind) });
    const type = /\.png(\?|$)/i.test(it.image) ? "image/png" : /\.webp(\?|$)/i.test(it.image) ? "image/webp" : /\.gif(\?|$)/i.test(it.image) ? "image/gif" : "image/jpeg";
    return `    <item>
      <title>${xml(it.title)}</title>
      <link>${xml(it.url)}</link>
      <guid isPermaLink="false">${xml(it.guid)}</guid>
      <pubDate>${rfc822(it.date)}</pubDate>
${it.categories.map((c) => `      <category>${xml(c)}</category>`).join("\n")}
      <description>${xml(text)}</description>
      <content:encoded>${cdata(html)}</content:encoded>${it.kind === "event" ? `
      <ev:type>Event</ev:type>
      <ev:startdate>${xml(it.start)}</ev:startdate>${it.end ? `
      <ev:enddate>${xml(it.end)}</ev:enddate>` : ""}${it.location ? `
      <ev:location>${xml(it.location)}</ev:location>` : ""}` : ""}${it.image ? `
      <enclosure url="${xml(it.image)}" length="0" type="${type}"/>
      <media:content url="${xml(it.image)}" medium="image"/>
      <media:thumbnail url="${xml(it.image)}"/>` : ""}
    </item>`;
  });
  const counts = { e: items.filter((i) => i.kind === "event").length, r: items.filter((i) => i.kind === "resource").length };
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:ev="http://purl.org/rss/1.0/modules/event/">
  <channel>
    <title>${xml(fc.title)}</title>
    <link>${xml(fc.feedLink || fc.feedSelf)}</link>
    <description>${xml(`${counts.e} upcoming event${counts.e === 1 ? "" : "s"} and ${counts.r} resource${counts.r === 1 ? "" : "s"}.`)}</description>
    <language>en</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <ttl>15</ttl>
    <atom:link href="${xml(fc.feedSelf)}" rel="self" type="application/rss+xml"/>
${out.join("\n")}
  </channel>
</rss>
`;
}

export function createFeed({ pub, fc }) {
  return { rss: async (now = new Date()) => { const { snap } = await pub.published(); return buildFeed(feedItems(snap, fc, now), fc, now); } };
}
