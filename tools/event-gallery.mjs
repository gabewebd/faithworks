// The Events gallery: photos from Faith Works sessions, laid out as an editorial masonry grid.
// Two sources, one list:
//   1. CMS events (authoritative for event images): the published, visible events in the build's
//      content view, newest first, each with the images its editor marked "Show in the events
//      gallery" (cover first, then in the event's own order);
//   2. src/data/events.json: the archive of earlier sessions that have no CMS event record.
// The same photo never appears twice (a CMS image that points at a registered photo, or at one
// of its retired paths, counts as that photo). Drafts and hidden events never reach this list:
// the content view already leaves them out (cms/shared/public.mjs).
//
// {{eventGallery:home}}  the first 10 featured photos (homepage)
// {{eventGallery:all}}   every photo (Workshops page)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./layout.mjs";
import { imgTag, resolveImage, imageIds } from "./gallery.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const archive = JSON.parse(readFileSync(join(ROOT, "src/data/events.json"), "utf8"));

// Checked once at load: a typo in events.json stops the build instead of shipping a hole.
{
  const known = new Set(imageIds()), seen = new Set();
  for (const e of archive.gallery || []) {
    if (!e.id || seen.has(e.id)) throw new Error(`src/data/events.json: missing or duplicate id "${e.id}"`);
    seen.add(e.id);
    if (!known.has(e.image)) throw new Error(`src/data/events.json: "${e.id}" names unknown image "${e.image}" (register it in src/data/gallery.json)`);
  }
}

const HOME_COUNT = 10;
const byStartDesc = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));

// Every gallery photo, in display order. `events` is the render data from tools/content.mjs.
export function galleryItems(events = []) {
  const items = [], seen = new Set();
  const add = (it) => {
    if (seen.has(it.key)) return;
    seen.add(it.key);
    items.push(it);
  };
  for (const e of [...events].sort(byStartDesc)) {
    for (const g of e.gallery || []) {
      if (!g.featured) continue;
      const photo = g.photo;
      add({
        key: photo ? `photo:${photo}` : `url:${g.url}`, photo, url: g.url, alt: g.alt,
        caption: e.title, featured: true, source: e.rid,
      });
    }
  }
  const sorted = [...(archive.gallery || [])].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
  for (const a of sorted) {
    add({ key: `photo:${a.image}`, photo: a.image, alt: a.alt, position: a.position, caption: a.caption || "", featured: !!a.featured, source: a.id });
  }
  return items;
}

/* ---- Masonry layout ------------------------------------------------------------------------
   A 12-column grid (6 on tablets, 2 on phones) with deliberate spans, filled in reading order.
   Tiles come in bands of five: large, tall, small, tall, small, then mirrored (small, tall,
   large, tall, small). Each band fills its rectangle exactly at every breakpoint, so the grid
   has no holes; leftovers (fewer than five) close the gallery as one even row.
   Spans are [columns, rows] for desktop, tablet and phone. */
const F = { d: [6, 8], t: [6, 5], m: [2, 4], kind: "large" };
const T = { d: [3, 5], t: [3, 5], m: [1, 5], kind: "tall" };
const S = { d: [3, 3], t: [3, 3], m: [1, 3], kind: "small" };
// The mirrored band: same desktop shapes; on tablets and phones its four smaller tiles pair up
// evenly, because a staggered pair above a full-width tile would leave a gap.
const pair = (x) => ({ ...x, t: [3, 4], m: [1, 4] });
const BAND = [F, T, S, T, S, pair(S), pair(T), F, pair(T), pair(S)];

function tailSpans(r) {
  // r = 1..4 leftover tiles: one row, equal widths
  return Array.from({ length: r }, (_, i) => ({
    d: [12 / r, 4],
    t: [r === 3 ? 2 : r === 1 ? 6 : 3, 4],
    m: [r === 1 || (r === 3 && i === 2) ? 2 : 1, 4],
    kind: "row",
  }));
}

export function spansFor(n) {
  const out = [];
  const full = n - (n % 5);
  for (let i = 0; i < full; i++) out.push(BAND[i % 10]);
  return [...out, ...tailSpans(n % 5)];
}

const SIZES = {
  large: "(min-width: 1000px) 50vw, 100vw",
  tall: "(min-width: 1000px) 25vw, 50vw",
  small: "(min-width: 1000px) 25vw, 50vw",
  row: "(min-width: 1000px) 33vw, 50vw",
};

function tileImg(it, kind) {
  if (it.photo) return imgTag(it.photo, { sizes: SIZES[kind], alt: it.alt, position: it.position });
  return `<img src="${esc(it.url)}" alt="${esc(it.alt || "")}" loading="lazy" decoding="async">`;
}

export function masonry(items, { label } = {}) {
  const spans = spansFor(items.length);
  const tiles = items.map((it, i) => {
    const s = spans[i];
    const style = `--c:${s.d[0]};--r:${s.d[1]};--ct:${s.t[0]};--rt:${s.t[1]};--cm:${s.m[0]};--rm:${s.m[1]}`;
    return `<li class="mgrid__tile mgrid__tile--${s.kind}" style="${style}"><figure>${tileImg(it, s.kind)}${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ""}</figure></li>`;
  });
  return `<ul class="mgrid" role="list"${label ? ` aria-label="${esc(label)}"` : ""}>
          ${tiles.join("\n          ")}
        </ul>`;
}

// Event render data → the gallery entries content.mjs attaches to each event (resolved photos).
export function eventGalleryEntries(gallery = []) {
  const list = gallery.filter((g) => g && g.url);
  return [...list.filter((g) => g.primary), ...list.filter((g) => !g.primary)].map((g) => {
    // A registered photo whose web files are not on this machine (the CMS preview function) is
    // shown from its address as given, rather than failing the whole page
    let photo;
    try { photo = resolveImage({ url: g.url, alt: g.alt }); } catch { photo = { url: g.url, alt: g.alt }; }
    const id = photo?.base?.startsWith("assets/images/web/") ? photo.base.slice("assets/images/web/".length) : null;
    // resolveImage keeps the editor's alt text, unless the URL is a retired picture's
    return { url: g.url, alt: photo.alt || "", photo: id, primary: !!g.primary, featured: !!g.featured };
  });
}

export function eventGallery(scope, events) {
  const all = galleryItems(events);
  const items = scope === "home" ? all.filter((x) => x.featured).slice(0, HOME_COUNT) : all;
  if (!items.length) return "";
  return masonry(items, { label: scope === "home" ? "Photos from Faith Works events" : "All photos from Faith Works events" });
}
