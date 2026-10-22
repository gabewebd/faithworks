// Photos and galleries from src/data/gallery.json (the registry) and src/data/gallery.lock.json
// (sizes written by tools/images.py). A page source calls {{gallery:page.slot}}; the layout of
// that slot decides the markup: single (one <img>), figures (captioned figures), stack (a main
// photo with floating cards), showcase (a large photo over thumbnails) or mosaic (an asymmetric grid). The Events gallery (masonry) is
// tools/event-gallery.mjs. Every photo is served as WebP in two widths with its size reserved.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./layout.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = "assets/images/web";
const WIDTHS = [640, 1280];
const registry = JSON.parse(readFileSync(join(ROOT, "src/data/gallery.json"), "utf8"));
const lockFile = join(ROOT, "src/data/gallery.lock.json");
const lock = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};

// A registered photo, with its web files checked: a missing one stops the build rather than
// shipping a broken image.
export function photo(id) {
  const spec = registry.images[id], size = lock[id];
  if (!spec) throw new Error(`gallery.json: unknown image "${id}"`);
  if (!size) throw new Error(`gallery.json: "${id}" has no web versions yet. Run: python tools/images.py`);
  const files = WIDTHS.map((w, i) => ({ url: `/${WEB}/${id}-${w}.webp`, w: size.widths[i] }));
  for (const f of files) if (!existsSync(join(ROOT, f.url))) throw new Error(`gallery.json: missing ${f.url}. Run: python tools/images.py`);
  return { id, ...spec, width: size.width, height: size.height, files, social: spec.social ? `/${WEB}/${id}-1200.jpg` : null };
}

// One <img>: both widths in srcset (the browser picks by slot size), the size reserved,
// lazy unless it is the page's first view.
export function imgTag(id, { sizes = "100vw", alt, cls = "", eager = false, priority = false, position } = {}) {
  const p = photo(id);
  const focus = position || p.position;
  const srcset = [...new Map(p.files.map((f) => [f.w, f])).values()].map((f) => `${f.url} ${f.w}w`).join(", ");
  return `<img${cls ? ` class="${cls}"` : ""} src="${p.files[1].url}" srcset="${srcset}" sizes="${esc(sizes)}" width="${p.width}" height="${p.height}" alt="${esc(alt ?? p.alt)}"${priority ? ` fetchpriority="high"` : eager ? "" : ` loading="lazy"`} decoding="async"${focus ? ` style="object-position:${esc(focus)}"` : ""}>`;
}

const slot = (name) => {
  const [page, key] = String(name).split(".");
  const g = registry.pages[page]?.[key];
  if (!g) throw new Error(`gallery.json: no gallery "${name}" (pages.${page}.${key})`);
  return g;
};
const opts = (g, item, i = 0) => ({ sizes: item.sizes || g.sizes, alt: item.alt, position: item.position, priority: !!g.priority && i === 0, eager: !!g.priority });

const LAYOUTS = {
  single: (g) => imgTag(g.items[0].image, opts(g, g.items[0])),

  figures: (g) => g.items.map((it) => `<figure>${imgTag(it.image, opts(g, it))}${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ""}</figure>`).join("\n        "),

  // Main photo plus up to two floating cards. The cards repeat what the main photo already says
  // (more of the same sessions), so screen readers hear the first and skip the decoration.
  stack: (g) => {
    const [main, ...cards] = g.items;
    const card = (it, i) => `<figure class="hstack__card hstack__card--${i + 1}" data-depth style="--depth: ${i ? -26 : 34}">${imgTag(it.image, { sizes: "(min-width: 900px) 220px, 40vw", alt: "", position: it.position })}${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ""}</figure>`;
    return `<div class="hstack${g.variant ? ` hstack--${g.variant}` : ""}">
          <figure class="phero__photo hstack__main">${imgTag(main.image, opts(g, main))}</figure>
          ${cards.slice(0, 2).map(card).join("\n          ")}
        </div>`;
  },

  // One large photo above a row of thumbnails (the first is the photo shown). Pressing a
  // thumbnail shows that photo large (js/main.js §5); without script the row is still the set.
  showcase: (g) => {
    const items = g.items.slice(0, 5);
    const thumb = (it, i) => {
      const alt = it.alt ?? photo(it.image).alt;
      return `<li><button type="button" class="pgallery__thumb" aria-pressed="${i ? "false" : "true"}" data-alt="${esc(alt)}">${imgTag(it.image, { sizes: "(min-width: 900px) 9vw, 20vw", alt: "", position: it.position })}<span class="sr-only">Show photo ${i + 1}: ${esc(alt)}</span></button></li>`;
    };
    return `<div class="pgallery" data-pgallery>
          <figure class="pgallery__stage">${imgTag(items[0].image, opts(g, items[0]))}</figure>
          <ul class="pgallery__thumbs" aria-label="Workshop photos">
            ${items.map(thumb).join("\n            ")}
          </ul>
        </div>`;
  },

  // Three photos: one large, two stacked beside it, offset so the grid never reads as a table.
  mosaic: (g) => `<div class="pmosaic">
          ${g.items.slice(0, 3).map((it, i) => `<figure class="pmosaic__cell pmosaic__cell--${i + 1}"${i ? ` data-depth` : ""} style="--c: ${i}${i ? `; --depth: ${i === 1 ? 18 : -18}` : ""}">${imgTag(it.image, { ...opts(g, it, i), sizes: i ? "(min-width: 900px) 18vw, 40vw" : g.sizes, alt: i ? "" : it.alt })}</figure>`).join("\n          ")}
        </div>`,
};

// {{gallery:page.slot}}
export function gallery(name) {
  const g = slot(name);
  const render = LAYOUTS[g.layout];
  if (!render) throw new Error(`gallery.json: "${name}" has unknown layout "${g.layout}"`);
  return render(g);
}

// CMS records that still point at a retired image (a path listed under a photo's "replaces"),
// or at a registered photo's web files, get that photo in the shape page-doc img() renders.
const retired = new Map();
for (const [id, spec] of Object.entries(registry.images)) for (const old of spec.replaces || []) retired.set(old.replace(/^\//, ""), id);
const idOf = (path) => {
  const p = String(path || "").replace(/^\//, "").replace(/-(\d+)\.(webp|jpe?g|png)$/i, "");
  if (retired.has(p)) return { id: retired.get(p), legacy: true };
  const m = p.match(new RegExp(`^${WEB}/(.+)$`));
  return m && registry.images[m[1]] ? { id: m[1], legacy: false } : null;
};
export function resolveImage(image) {
  if (!image) return image;
  const hit = idOf(image.base || image.url);
  if (!hit) return image;
  const p = photo(hit.id);
  return {
    base: `${WEB}/${p.id}`, widths: WIDTHS, sizesOf: p.files.map((f) => f.w), formats: ["webp"],
    width: p.width, height: p.height, position: p.position,
    // A retired picture's alt text described that picture, so the new photo brings its own
    alt: hit.legacy || !image.alt ? p.alt : image.alt,
    social: p.social,
  };
}

// The site-wide link-preview image
export const defaultSocialImage = () => photo(registry.socialDefault).social;

export const imageIds = () => Object.keys(registry.images);
