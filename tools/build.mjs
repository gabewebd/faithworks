// Faith Works static site generator. No dependencies: `node tools/build.mjs`.
// Reads page bodies from src/pages/*.html and content through tools/content.mjs (CMS fixtures
// by default, or the CMS itself with --content=cms),
// wraps them in the shared layout (tools/layout.mjs) and writes plain static HTML
// to clean routes at the repo root (/learn/index.html, /programs/{slug}/index.html…),
// plus 404.html, sitemap.xml and robots.txt. Generated files carry a banner; edit
// the sources, then rebuild.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
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
let snapshot;
try {
  snapshot = await loadSnapshot(opts);
} catch (e) {
  console.error(`Build stopped: ${e.message}`);
  process.exit(1);
}
const data = toRenderData(snapshot);
R.init(data);

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
    .replace(/(\s(?:href|src|data-redirect))="([^"]*)"/g, (all, attr, url) => `${attr}="${fix(url)}"`)
    .replace(/(\ssrcset)="([^"]*)"/g, (all, attr, set) => `${attr}="${set.split(",").map((s) => { const [u, ...rest] = s.trim().split(/\s+/); return [fix(u), ...rest].join(" "); }).join(", ")}"`);
}

const written = [];
// A renderer with nothing to show leaves R.EMPTY_SECTION; remove the <section> around it.
function dropEmptySections(html) {
  let at;
  while ((at = html.indexOf(R.EMPTY_SECTION)) >= 0) {
    let start = html.lastIndexOf("<section", at);
    const end = html.indexOf("</section>", at);
    if (start < 0 || end < 0) return html.replace(R.EMPTY_SECTION, "");
    const note = html.slice(0, start).match(/<!--(?:(?!-->)[^])*-->\s*$/); // the comment that labels the section
    if (note) start -= note[0].length;
    html = html.slice(0, start) + html.slice(end + "</section>".length);
  }
  return html;
}

function emit(path, html) {
  // path is the public route: "/" → index.html, "/learn/" → learn/index.html, "/404.html" → 404.html
  html = dropEmptySections(html);
  const file = path.endsWith("/") ? join(ROOT, path, "index.html") : join(ROOT, path);
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
  const body = src.slice(m[0].length).replace(/\{\{(\w+)(?::([\w-]+))?\}\}/g, (all, name, arg) => {
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
mkdirSync(join(ROOT, "events"), { recursive: true });
writeFileSync(join(ROOT, "events", "calendar.json"), JSON.stringify({ generated_at: snapshot.generated_at, events: R.calendarData() }, null, 2) + "\n");

// Old URLs of renamed pages keep working: a small redirect page at each old route, plus a
// _redirects file (Netlify; other hosts ignore it) for real 301s in deploy mode.
const redirects = data.redirects.filter((r) => r.from && r.to && r.from !== r.to && !written.includes(r.from));
for (const r of redirects) {
  emit(r.from, `<!doctype html>
<!-- Generated by tools/build.mjs: ${r.from} moved to ${r.to} -->
<html lang="en"><head><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex">
<link rel="canonical" href="${data.site.origin.replace(/\/$/, "")}${r.to}"><meta http-equiv="refresh" content="0; url=${r.to}"></head>
<body><p>This page has moved to <a href="${r.to}">${r.to}</a>.</p></body></html>
`);
}
if (DEPLOY && redirects.length) writeFileSync(join(ROOT, "_redirects"), redirects.map((r) => `${r.from} ${r.to} 301`).join("\n") + "\n");

// Remove generated pages this build did not produce (an unpublished program, a renamed event…),
// so content taken off the CMS never lingers in the output. Only files carrying the generator
// banner inside the content routes are touched.
for (const dir of ["programs", "resources", "events"]) {
  if (!existsSync(join(ROOT, dir))) continue;
  for (const slug of readdirSync(join(ROOT, dir), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const route = `/${dir}/${slug}/`, file = join(ROOT, dir, slug, "index.html");
    if (written.includes(route) || !existsSync(file) || !read(join(dir, slug, "index.html")).includes("Generated by tools/build.mjs")) continue;
    rmSync(file);
    if (!readdirSync(join(ROOT, dir, slug)).length) rmSync(join(ROOT, dir, slug), { recursive: true });
    console.log(`Removed ${route} (no longer in the content)`);
  }
}

// Search files. Staging is excluded from indexing (brief §6); flip site.staging at launch.
const origin = data.site.origin.replace(/\/$/, "");
const redirected = new Set(redirects.map((r) => r.from));
const indexable = written.filter((p) => p.endsWith("/") && !p.includes("thank-you") && !redirected.has(p));
writeFileSync(join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  indexable.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join("\n") + `\n</urlset>\n`);
writeFileSync(join(ROOT, "robots.txt"), data.site.staging
  ? "# Staging build: keep out of search engines (brief §6). Replace at launch.\nUser-agent: *\nDisallow: /\n"
  : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);

console.log(`Content: ${opts.source}, ${snapshot.view} view (snapshot ${snapshot.generated_at}).`);
console.log(`Built ${written.length} pages${data.site.staging ? " (staging: noindex)" : ""}, ${DEPLOY ? "deploy mode (root URLs)" : "portable mode (relative URLs)"}:\n  ` + written.join("\n  "));
