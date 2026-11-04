// What a CMS-driven section looks like on a GHL page, shared by build.mjs (Node, when the page is
// built) and live.mjs (the browser, on every visit): the same renderer output, finished the same
// way, gives the same HTML and so the same hash, and a section is only replaced when it differs.
import { cleanPath } from "../../tools/layout.mjs";
import { currentUrl } from "../../tools/content.mjs";

// The template calls whose output comes from the CMS: event cards, the Workshops calendar, the
// events photo gallery, the testimonial stack, the event announcement bar and the latest
// resources. Everything else on the page stays as built.
export const LIVE = ["events", "eventCalendar", "eventGallery", "voices", "eventBanner", "latestResources"];

// <!--fw-live:name:arg:hash--> … <!--/fw-live--> around each one
export const START = /^fw-live:(\w+):([\w.-]*):([0-9a-z]+)$/;
export const END = "/fw-live";
export const startMark = (name, arg, h) => `fw-live:${name}:${arg || ""}:${h}`;

// As tools/build.mjs emit() in deploy mode, then the CDN rewrite of the pasted pages
// (/assets, /css, /js served from the asset host; page links stay on the GHL domain).
export function finish(html, cdn) {
  return html
    .replace(/<!--[\s\S]*?-->\n?/g, "")
    .replace(/\sdata-cms-[\w-]+(?:="[^"]*")?/g, "")
    .replace(/(\shref)="(\/[^"]*)"/g, (all, attr, url) => `${attr}="${currentUrl(url)}"`)
    .replace(/(\s(?:href|data-redirect))="(\/[^"?#]*)([^"]*)"/g, (all, attr, path, rest) => `${attr}="${cleanPath(path)}${rest}"`)
    .replace(/([" ,(])\/(assets|css|js)\//g, `$1${cdn}/$2/`);
}

// FNV-1a, 32 bits: a fingerprint of a section's HTML, not a security measure
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
