// Builds the GHL RSS-loop newsletter and a preview of it.
//   12-newsletter-rss-ghl.html          paste into GHL; the loop repeats {{{rss_item.content}}} for each feed item
//   12-newsletter-rss-ghl-preview.html  the loop filled with live CMS content, run through the feed code
// The card design lives in the feed (fw-nextjs: cms/server/services/feed-card.mjs), because GHL only passes each
// item's content. Shell (header, intro, closing, footer) comes from 12-newsletter-rss-template.html.
// Usage: node email-templates/12-newsletter-rss-ghl-gen.mjs   (FEED_CODE=<path to services/feed.mjs> to override)
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FEED_CODE = process.env.FEED_CODE || path.resolve(DIR, "../../fw-nextjs/cms/server/services/feed.mjs");
const CMS = "https://faithworks-cms.vercel.app";

const shell = fs.readFileSync(path.join(DIR, "12-newsletter-rss-template.html"), "utf8");
const a = shell.indexOf("  <!-- 3. FEATURED RESOURCES");
const b = shell.indexOf("  <!-- 5. CLOSING");

const loop = `  <!-- 3–4. RESOURCES + EVENTS: one block per RSS item. The feed sends each card ready-made, with the section
       heading on the first event and the first resource (events first, soonest; then resources, newest). -->
  <tr><td bgcolor="#FFFFFF" class="fw-pad" style="background-color:#FFFFFF;padding:32px 40px 8px 40px;">
    <div style="font-size:0;line-height:0;">{{#rss_items rss_items}}</div>
    <div style="padding:0 0 12px 0;">{{{rss_item.content}}}</div>
    <div style="font-size:0;line-height:0;">{{/rss_items}}</div>
  </td></tr>

`;
let ghl = shell.slice(0, a) + loop + shell.slice(b);
// Desktop: a 760px column (white body) with rounded header and footer; phones: full width.
// Nothing behind the email: the page around the column has no background colour.
ghl = ghl
  .replace('<body style="margin:0;padding:0;background-color:#FAF8F4;">', '<body style="margin:0;padding:0;">')
  .replace(' bgcolor="#FAF8F4" style="background-color:#FAF8F4;"', '')
  // Header and footer are rounded on all four corners.
  .replace("border-radius:16px 16px 0 0;", "border-radius:16px;")
  .replace("border-radius:0 0 16px 16px;", "border-radius:16px;")
  .replace('<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">', '<table role="presentation" width="760" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:760px;">')
  .replace('<tr><td align="center" style="padding:28px 12px 40px 12px;">', '<tr><td align="center" class="fw-outer" style="padding:24px 12px 40px 12px;">')
  .replace("</style>", "  @media only screen and (max-width:620px) { .fw-outer { padding:0 !important; } }\n</style>");
ghl = ghl
  .replace(/(<div style="display:none[^>]*>)[^&]*/, "$1New guides to read and live sessions to join this week.")
  .replace("Think better with AI, then put it to work.", "This week at Faith Works")
  .replace(/<p[^>]*>This week is about using AI[^<]*<\/p>\s*<p([^>]*)>Then come learn[^<]*<\/p>/,
    "<p$1>Here’s what’s new at Faith Works: fresh guides to help you use AI with confidence at work, and upcoming sessions you can join live.</p>");
fs.writeFileSync(path.join(DIR, "12-newsletter-rss-ghl.html"), ghl);

// Preview: live published content -> local feed code -> loop filled the way GHL fills it.
const { feedConfig, feedItems, buildFeed } = await import(pathToFileURL(FEED_CODE).href);
const content = await (await fetch(`${CMS}/api/public/content`, { headers: { accept: "application/json" } })).json();
const snap = content.snapshot || content;
// Preview only: the HR event uses the original poster. Live emails match once its featured image is changed in the CMS.
for (const e of snap.events || []) if (e.featured_image_url === "/assets/images/events/recruitment-reimagined-2026.jpg") e.featured_image_url = "/assets/images/events/recruitment-reimagined-poster.png";
const fc = feedConfig({
  NEWSLETTER_RESOURCE_URL: "https://faithph.ai/resources?{slug}",
  NEWSLETTER_EVENTS_URL: "https://faithph.ai/workshops",
  NEWSLETTER_EVENT_PAGE_URL: "https://faithph.ai/events/{slug}/",
  NEWSLETTER_ASSET_ORIGIN: "https://faithworks.vercel.app",
}, { publicSiteUrl: "https://faithph.ai", baseUrl: CMS });
const xml = buildFeed(feedItems(snap, fc), fc);
const items = [...xml.matchAll(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/g)].map((m) => m[1]);
const body = ghl.match(/\{\{#rss_items rss_items\}\}([\s\S]*?)\{\{\/rss_items\}\}/)[1];
let preview = ghl.replace(/\{\{#rss_items rss_items\}\}[\s\S]*?\{\{\/rss_items\}\}/, items.map((c) => body.replace("{{{rss_item.content}}}", c)).join(""))
  .replace("{{email.unsubscribe_link}}", "#");
fs.writeFileSync(path.join(DIR, "12-newsletter-rss-ghl-preview.html"), preview);
console.log(`ghl template + preview: ${items.length} items`);
