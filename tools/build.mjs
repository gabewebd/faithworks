// Faith Works static site generator. No dependencies: `node tools/build.mjs`.
// Reads page bodies from src/pages/*.html and content from assets/data/*.json,
// wraps them in the shared layout (tools/layout.mjs) and writes plain static HTML
// to clean routes at the repo root (/learn/index.html, /programs/{slug}/index.html…),
// plus 404.html, sitemap.xml and robots.txt. Generated files carry a banner; edit
// the sources, then rebuild.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { layout } from "./layout.mjs";
import * as R from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const json = (p) => JSON.parse(read(p));

const data = {
  site: json("assets/data/site.json"),
  programs: json("assets/data/programs.json").programs,
  events: json("assets/data/events.json").events,
  resources: json("assets/data/resources.json").resources,
  articles: json("assets/data/insights.json").insights,
  stories: json("assets/data/success-stories.json").stories.filter((s) => s.status === "published"),
};
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
function emit(path, html) {
  // path is the public route: "/" → index.html, "/learn/" → learn/index.html, "/404.html" → 404.html
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
  emit(`/programs/${p.slug}/`, layout({ ...page, site: data.site }));
}

// One shared template for every article (resources/{slug})
for (const a of data.articles) {
  const page = R.articlePage(a);
  emit(`/resources/${a.slug}/`, layout({ ...page, site: data.site }));
}

// Search files. Staging is excluded from indexing (brief §6); flip site.staging at launch.
const origin = data.site.origin.replace(/\/$/, "");
const indexable = written.filter((p) => p.endsWith("/") && !p.includes("thank-you"));
writeFileSync(join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  indexable.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join("\n") + `\n</urlset>\n`);
writeFileSync(join(ROOT, "robots.txt"), data.site.staging
  ? "# Staging build: keep out of search engines (brief §6). Replace at launch.\nUser-agent: *\nDisallow: /\n"
  : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);

console.log(`Built ${written.length} pages${data.site.staging ? " (staging: noindex)" : ""}, ${DEPLOY ? "deploy mode (root URLs)" : "portable mode (relative URLs)"}:\n  ` + written.join("\n  "));
