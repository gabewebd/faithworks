// Faith Works static site generator. No dependencies: `node tools/build.mjs`.
// Reads page bodies from src/pages/*.html and content through tools/content.mjs (CMS fixtures
// by default, or the CMS itself with --content=cms),
// wraps them in the shared layout (tools/layout.mjs) and writes plain static HTML
// to clean routes at the repo root (/learn/index.html, /programs/{slug}/index.html…),
// plus 404.html, sitemap.xml and robots.txt. Generated files carry a banner; edit
// the sources, then rebuild.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, cpSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { layout } from "./layout.mjs";
import * as R from "./render.mjs";
import { loadSnapshot, toRenderData } from "./content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const json = (p) => JSON.parse(read(p));

// Content (tools/content.mjs). Options, as flags or environment variables:
//   --content=fixtures|local|cms   CONTENT_SOURCE   (default fixtures: cms/fixtures/seed.json)
//   --view=auto|published|preview  CONTENT_VIEW     (auto: drafts only when site settings say staging)
//   --allow-stale                  CONTENT_ALLOW_STALE=1 (use the last fetched CMS snapshot if the CMS is down)
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const opts = {
  root: ROOT,
  source: arg("content") || process.env.CONTENT_SOURCE || "fixtures",
  view: arg("view") || process.env.CONTENT_VIEW || "auto",
  allowStale: process.argv.includes("--allow-stale") || process.env.CONTENT_ALLOW_STALE === "1",
};
// A Vercel build is a real deployment: it must never fall back to the fixtures (drafts).
if (process.env.VERCEL && opts.source !== "cms") {
  console.error(`Build stopped: Vercel builds must use CMS content (--content=cms or CONTENT_SOURCE=cms), not "${opts.source}". The live site is unchanged.`);
  process.exit(1);
}
// --out=<dir> writes the site to its own folder (the Vercel build, see vercel.json) holding only
// what visitors need: the generated pages plus css/, js/ and assets/ (without assets/data, the
// migration source, and with only the images the pages use: see "Images" below, so the full-size
// originals in assets/images/ never ship). Without it the pages are written into the repository
// root, as before.
const outArg = arg("out");
const OUT = outArg ? resolve(ROOT, outArg) : ROOT;
if (outArg && (relative(ROOT, OUT) === "" || relative(ROOT, OUT).startsWith("..") || isAbsolute(relative(ROOT, OUT)))) {
  console.error(`Build stopped: --out must be a folder inside the repository (got "${outArg}").`);
  process.exit(1);
}
let snapshot;
try {
  snapshot = await loadSnapshot(opts);
} catch (e) {
  console.error(`Build stopped: ${e.message}`);
  process.exit(1);
}
const data = toRenderData(snapshot);
R.init(data);

// Content loaded: only now is a separate output folder replaced (a failed fetch leaves it alone).
if (OUT !== ROOT) {
  rmSync(OUT, { recursive: true, force: true });
  const skip = [join(ROOT, "assets", "data"), join(ROOT, "assets", "images")];
  for (const dir of ["css", "js", "assets"]) cpSync(join(ROOT, dir), join(OUT, dir), { recursive: true, filter: (src) => !skip.includes(src) });
}

// Default build is portable: every local URL is rewritten relative to the page, and page links
// point at index.html, so the site works opened from disk (file://), under Live Server, or from
// any sub-folder. `node tools/build.mjs --deploy` keeps root-relative clean URLs (/learn/) for a
// real host serving this folder at the domain root.
const DEPLOY = process.argv.includes("--deploy");

function relativize(html, route) {
  const depth = route.endsWith("/") ? route.split("/").filter(Boolean).length : 0;
  const prefix = "../".repeat(depth);
  const fix = (url) => {
    if (!url.startsWith("/") || url.startsWith("//")) return url;
    const m = url.slice(1).match(/^([^?#]*)(.*)$/);
    let path = m[1];
    if (path === "" || path.endsWith("/")) path += "index.html"; // a page, not a file
    return prefix + path + m[2];
  };
  return html
    .replace(/(\s(?:href|src|data-src|data-redirect))="([^"]*)"/g, (all, attr, url) => `${attr}="${fix(url)}"`)
    .replace(/(\s(?:srcset|data-srcset))="([^"]*)"/g, (all, attr, set) => `${attr}="${set.split(",").map((s) => { const [u, ...rest] = s.trim().split(/\s+/); return [fix(u), ...rest].join(" "); }).join(", ")}"`);
}

const written = [];
const imagesUsed = new Set(); // every /assets/images/… file a page points at (see "Images" below)

function emit(path, html) {
  // path is the public route: "/" → index.html, "/learn/" → learn/index.html, "/404.html" → 404.html
  // A renderer with nothing to show leaves R.EMPTY_SECTION; the <section> around it is removed.
  html = R.dropEmptySections(html);
  for (const m of html.matchAll(/\/assets\/images\/[^"'\s),?#]+/g)) imagesUsed.add(decodeURI(m[0].slice(1)));
  const file = path.endsWith("/") ? join(OUT, path, "index.html") : join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, DEPLOY ? html : relativize(html, path));
  written.push(path);
}

// Page sources: <!--meta {json}--> then the <main> body. {{name}} or {{name:arg}} calls a renderer.
function renderPage(file) {
  const src = read(join("src/pages", file));
  const m = src.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${file}: missing <!--meta {...}--> header`);
  const meta = JSON.parse(m[1]);
  const body = src.slice(m[0].length).replace(/\{\{(\w+)(?::([\w.-]+))?\}\}/g, (all, name, arg) => {
    if (typeof R[name] !== "function") throw new Error(`${file}: unknown renderer {{${name}}}`);
    return R[name](arg);
  });
  return { meta, body };
}

for (const file of readdirSync(join(ROOT, "src/pages")).filter((f) => f.endsWith(".html"))) {
  const { meta, body } = renderPage(file);
  emit(meta.path, layout({ ...meta, body, site: data.site }));
}

// One shared template for every program (brief §2: reuse templates)
for (const p of data.programs) {
  const page = R.programPage(p);
  if (!page) continue; // no page content yet
  emit(`/programs/${p.slug}/`, layout({ ...page, site: data.site }));
}

// One shared template for every article (resources/{slug})
for (const a of data.articles) {
  const page = R.articlePage(a);
  if (page) emit(`/resources/${a.slug}/`, layout({ ...page, site: data.site }));
}
// Guides, downloads and other resources get a page only when their page editor has content.
for (const r of data.resources.filter((x) => x.hasPage)) {
  emit(`/resources/${r.slug}/`, layout({ ...R.resourcePage(r), site: data.site }));
}

// One shared template for events that have their own page (a CMS event page, or "its own page"
// turned on) with content (events/{slug}). Other events link straight to their registration
// destination (e.g. an existing GHL funnel), as agreed in docs/04 §7.
for (const e of data.events.filter((x) => x.hasPage)) {
  const page = R.eventPage(e);
  emit(`/events/${e.slug}/`, layout({ ...page, site: data.site }));
}

// The events calendar feed: published, visible events with a date (the Workshops calendar
// embeds the same data, so it also works when the site is opened from disk).
mkdirSync(join(OUT, "events"), { recursive: true });
writeFileSync(join(OUT, "events", "calendar.json"), JSON.stringify({ generated_at: snapshot.generated_at, events: R.calendarData() }, null, 2) + "\n");

// Old URLs of renamed pages keep working: a small redirect page at each old route, plus a
// _redirects file (Netlify; other hosts ignore it) for real 301s in deploy mode.
// Site renames live here (the CMS adds its own): For Individuals became For Professionals.
const SITE_REDIRECTS = [{ from: "/individuals/", to: "/professionals/" }];
const redirects = [...SITE_REDIRECTS, ...data.redirects].filter((r) => r.from && r.to && r.from !== r.to && !written.includes(r.from));
for (const r of redirects) {
  // The refresh URL is not an href, so relativize() leaves it alone: point it at the page here.
  const target = DEPLOY ? r.to : relativize(`<a href="${r.to}">`, r.from).slice(9, -2);
  emit(r.from, `<!doctype html>
<!-- Generated by tools/build.mjs: ${r.from} moved to ${r.to} -->
<html lang="en"><head><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex">
<link rel="canonical" href="${data.site.origin.replace(/\/$/, "")}${r.to}"><meta http-equiv="refresh" content="0; url=${target}"></head>
<body><p>This page has moved to <a href="${r.to}">${r.to}</a>.</p></body></html>
`);
}
if (DEPLOY && redirects.length) writeFileSync(join(OUT, "_redirects"), redirects.map((r) => `${r.from} ${r.to} 301`).join("\n") + "\n");

// Remove generated pages this build did not produce (an unpublished program, a renamed event…),
// so content taken off the CMS never lingers in the output. Only files carrying the generator
// banner inside the content routes are touched.
for (const dir of ["programs", "resources", "events"]) {
  if (!existsSync(join(OUT, dir))) continue;
  for (const slug of readdirSync(join(OUT, dir), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const route = `/${dir}/${slug}/`, file = join(OUT, dir, slug, "index.html");
    if (written.includes(route) || !existsSync(file) || !readFileSync(file, "utf8").includes("Generated by tools/build.mjs")) continue;
    rmSync(file);
    if (!readdirSync(join(OUT, dir, slug)).length) rmSync(join(OUT, dir, slug), { recursive: true });
    console.log(`Removed ${route} (no longer in the content)`);
  }
}

// Images. Every image a page points at must exist (a CMS record with a mistyped path is reported,
// not shipped silently). A separate output folder gets those files only, plus the web versions
// of the photo registry (src/data/gallery.json, made by tools/images.py).
const imagesMissing = [...imagesUsed].filter((p) => !existsSync(join(ROOT, p)));
for (const p of imagesMissing) console.warn(`Warning: missing image /${p}`);
if (OUT !== ROOT) {
  for (const p of imagesUsed) if (existsSync(join(ROOT, p))) cpSync(join(ROOT, p), join(OUT, p));
  cpSync(join(ROOT, "assets/images/web"), join(OUT, "assets/images/web"), { recursive: true });
}

// Search files. Staging is excluded from indexing (brief §6); flip site.staging at launch.
const origin = data.site.origin.replace(/\/$/, "");
const redirected = new Set(redirects.map((r) => r.from));
const indexable = written.filter((p) => p.endsWith("/") && !p.includes("thank-you") && !redirected.has(p));
writeFileSync(join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  indexable.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join("\n") + `\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), data.site.staging
  ? "# Staging build: keep out of search engines (brief §6). Replace at launch.\nUser-agent: *\nDisallow: /\n"
  : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);

console.log(`Content: ${opts.source}, ${snapshot.view} view (snapshot ${snapshot.generated_at}).`);
console.log(`Images: ${imagesUsed.size} referenced, ${imagesMissing.length} missing.`);
console.log(`Built ${written.length} pages${data.site.staging ? " (staging: noindex)" : ""}, ${DEPLOY ? "deploy mode (root URLs)" : "portable mode (relative URLs)"}${OUT !== ROOT ? ` into ${relative(ROOT, OUT)}/` : ""}:\n  ` + written.join("\n  "));
