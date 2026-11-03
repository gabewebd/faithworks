// ESBUILD_FROM=<path inside a project that has esbuild installed> node poc/ghl-resources-cms/build.mjs
// TEST ONLY: two GHL versions of the Resources page, side by side, for comparison.
//   dist/fw-resources-snapshot-embed.html  CMS content as of this build, fixed in the file (re-run and
//                                          re-paste to update). Needs nothing at runtime but images.
//   dist/fw-resources-live-embed.html      fetches the CMS public API (and the site's style.css) on
//                                          every page load; CMS changes show without re-pasting.
//   dist/*-test.html                       each embed inside a page, to preview locally.
// Both read only the published content (GET /api/public/content); nothing here writes to the CMS
// or touches the production build. Environment: CMS_CONTENT_URL (as tools/content.mjs; falls back
// to the CMS's own setting in cms/.env), CDN_URL (same default as tools/layout.mjs), ESBUILD_FROM
// (for the live embed's bundle, as the earlier poc/ghl-resources/build.mjs).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepare, checkSnapshot, tokenizeCalls } from "./prepare.mjs";
import { readUntil, matchBrace, splitSelectors, mapSelector, HOST_CSS, EXTRA_CSS } from "./shadow-css.mjs";

const here = dirname(fileURLToPath(import.meta.url)), ROOT = join(here, "../..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const envFile = (key) => (existsSync(join(ROOT, "cms/.env")) ? (read("cms/.env").match(new RegExp(`^${key}=(.*)$`, "m")) || [])[1]?.trim() : undefined);
const CMS = (process.env.CMS_CONTENT_URL || envFile("CMS_CONTENT_URL") || "").replace(/\/$/, "");
if (!CMS) throw new Error("CMS_CONTENT_URL is not set (the CMS address, e.g. https://cms.example.com).");
const CDN = (process.env.CDN_URL || "https://faithworks.vercel.app").replace(/\/$/, "");
const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap";
// GHL rewrites anything shaped like its merge fields ({{name}} → {{ name }}) in pasted code, so
// the page source's renderer calls travel as %%FW:name%% (prepare.mjs reads both forms).
const template = tokenizeCalls(read("templates/resources.html"));

/* ---- Content: the CMS's published snapshot, as the public build reads it ---- */
const res = await fetch(`${CMS}/api/public/content`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
if (!res.ok) throw new Error(`${CMS}/api/public/content answered HTTP ${res.status}`);
if (res.headers.get("x-content-stale")) console.warn("WARNING: the CMS database was unreachable; the CMS served its last good snapshot.");
const snap = await res.json();
const problems = checkSnapshot(snap);
if (problems.length) throw new Error(problems.join(" "));
const content = prepare(snap, { template, cdn: CDN });

// The share image's size, so LinkedIn and Facebook can lay out the preview card before fetching it.
const imageSize = (b) => {
  if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)]; // PNG IHDR
  for (let i = 2; b[0] === 0xff && b[1] === 0xd8 && i + 9 < b.length; i += 2 + b.readUInt16BE(i + 2)) { // JPEG: the frame header
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
  }
  return null;
};
const shareImage = (content.headHtml.match(/property="og:image" content="([^"]+)"/) || [])[1];
if (shareImage) {
  const img = await fetch(shareImage, { signal: AbortSignal.timeout(20000) });
  if (!img.ok) throw new Error(`The share image ${shareImage} answered HTTP ${img.status}`);
  const size = imageSize(Buffer.from(await img.arrayBuffer()));
  if (size) content.headHtml = content.headHtml.replace(/(<meta data-fw-head property="og:image"[^>]*>)/,
    `$1\n<meta data-fw-head property="og:image:width" content="${size[0]}">\n<meta data-fw-head property="og:image:height" content="${size[1]}">`);
}

/* ---- CSS: the rules of css/style.css these pages can match ---- */
// The snapshot embed carries only these; the live embed keeps them as its fallback.
// Every tag, class, id and attribute the pages contain: the rendered pages, the cards as the
// site renders them (runtime.js builds the same markup) and the states runtime.js sets.
const corpus = [content.listingHtml, content.siteCards, content.headerHtml, content.footerHtml, `<main class="fw-main" id="main-content">`, ...Object.values(content.articles), ...content.resources.map((r) => r.imageHtml || "")].join("\n");
const used = { tag: new Set(), cls: new Set(["fw-root", "fw-main", "is-active", "is-open", "is-scrolled", "empty", "rcard--lead", "rcard__img--blank", "rcards__filters", "rcards__chip"]), id: new Set(), attr: new Set(["hidden", "aria-current", "aria-pressed"]) };
for (const m of corpus.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)) {
  used.tag.add(m[1].toLowerCase());
  for (const a of m[2].matchAll(/\s([a-zA-Z_:][-\w:.]*)(?=\s*=|\s|\/?$)/g)) used.attr.add(a[1].toLowerCase());
}
for (const m of corpus.matchAll(/\sclass="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach((c) => used.cls.add(c));
for (const m of corpus.matchAll(/\sid="([^"]*)"/g)) used.id.add(m[1]);

function canMatch(sel) {
  let s = sel.replace(/^(:host|\.fw-root)/, "");
  // :not(), :is(), :has()… are dropped whole: keeping a rule we might not need is the safe side
  for (let k; (k = s.search(/::?[a-z-]+\(/i)) >= 0;) { const open = s.indexOf("(", k); let d = 0, j = open; for (; j < s.length; j++) { if (s[j] === "(") d++; else if (s[j] === ")" && --d === 0) break; } s = s.slice(0, k) + s.slice(j + 1); }
  s = s.replace(/::?[a-z-]+/gi, "");
  const attrs = [...s.matchAll(/\[\s*([^\]=~|^$*\s]+)/g)].map((m) => m[1].toLowerCase());
  s = s.replace(/\[[^\]]*\]/g, "");
  const classes = [...s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  const ids = [...s.matchAll(/#(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  const tags = s.replace(/[.#][\w-]+/g, "").split(/[\s>+~]+/).map((t) => (t.match(/^[a-zA-Z][\w-]*/) || [])[0]).filter(Boolean).map((t) => t.toLowerCase());
  return classes.every((c) => used.cls.has(c)) && ids.every((i) => used.id.has(i)) && attrs.every((a) => used.attr.has(a)) && tags.every((t) => used.tag.has(t));
}
const GROUP = /^@(media|supports|container|layer)\b/i;
function prune(src, keyframes) {
  let out = "";
  for (let i = 0; i < src.length;) {
    const j = readUntil(src, i, "{};");
    if (j >= src.length) break;
    if (src[j] !== "{") { i = j + 1; continue; } // @charset, stray ";"
    const end = matchBrace(src, j + 1), body = src.slice(j + 1, end);
    const p = src.slice(i, j).replace(/\/\*[^]*?\*\//g, "").trim();
    i = end + 1;
    if (/^@(-webkit-)?keyframes\b/i.test(p)) { keyframes.push({ name: p.split(/\s+/)[1], css: `${p}{${body}}` }); continue; }
    if (GROUP.test(p)) { const inner = prune(body, keyframes); if (inner) out += `${p}{${inner}}\n`; continue; }
    if (p.startsWith("@")) { out += `${p}{${body}}\n`; continue; } // @property, @font-feature-values…
    const sels = splitSelectors(p).map(mapSelector).filter((s) => s && canMatch(s));
    if (sels.length) out += `${sels.join(",")}{${body.trim()}}\n`;
  }
  return out;
}
const keyframes = [];
let css = prune(read("css/style.css"), keyframes);
css += keyframes.filter((k) => new RegExp(`[\\s,:]${k.name.replace(/[^\w-]/g, "")}[\\s,;}]`).test(css)).map((k) => k.css).join("\n");

/* ---- The live embed's renderer: prepare.mjs as one browser file ---- */
// The site renderers read a few registry files at import time; they are inlined here and the
// Node built-ins they use become tiny shims. Nothing else of Node reaches the browser.
if (!process.env.ESBUILD_FROM) throw new Error("ESBUILD_FROM is not set: a path inside any project with esbuild installed (needed for the live embed).");
const esbuild = createRequire(process.env.ESBUILD_FROM)("esbuild");
const files = Object.fromEntries(["gallery.json", "gallery.lock.json", "events.json", "trusted-by.json"].filter((n) => existsSync(join(ROOT, "data", n))).map((n) => [`data/${n}`, read(`data/${n}`)]));
for (const n of readdirSync(join(ROOT, "assets/icons/tools"))) files[`assets/icons/tools/${n}`] = read(`assets/icons/tools/${n}`);
const SHIMS = {
  "node:fs": `const F=${JSON.stringify(files)};
const k=(p)=>Object.keys(F).find((x)=>String(p).split("\\\\").join("/").endsWith(x));
export const readFileSync=(p)=>{const x=k(p);if(x===undefined)throw new Error("not available in the browser: "+p);return F[x]};
export const existsSync=(p)=>k(p)!==undefined;
export const writeFileSync=()=>{throw new Error("no fs in the browser")};export const mkdirSync=writeFileSync;`,
  "node:path": `export const join=(...p)=>p.join("/");export const dirname=(p)=>p.split("/").slice(0,-1).join("/")||"/";`,
  "node:url": `export const fileURLToPath=(u)=>String(u).replace("file://","");`,
};
const bundle = await esbuild.build({
  entryPoints: [join(here, "prepare.mjs")], bundle: true, minify: true, write: false, format: "iife", globalName: "FWRender", platform: "browser", target: ["es2019"],
  define: { "process.env": "{}", "import.meta.url": '"file:///x/tools/render.mjs"' }, logLevel: "warning",
  plugins: [{ name: "node-shims", setup(b) {
    b.onResolve({ filter: /^node:(fs|path|url)$/ }, (a) => ({ path: a.path, namespace: "shim" }));
    b.onLoad({ filter: /.*/, namespace: "shim" }, (a) => ({ contents: SHIMS[a.path], loader: "js", resolveDir: ROOT }));
  } }],
});
// Placeholder-shaped text inside the bundle's strings ({{gallery:page.slot}} in a registry note)
// gets an escaped brace, which reads the same to JavaScript and is invisible to GHL.
const renderJs = bundle.outputFiles[0].text.replace(/\{\{(?=[\w\s.:-]*\}\})/g, "{\\u007b");

/* ---- Output ---- */
// Inline <script> safety: no "</script" or "<!--" in the code, no "<" in the data. Link-preview
// scrapers (LinkedIn) read <meta>/<title>/<link> tags even inside scripts, and the bundled layout
// template has some (og:image content="${…}"), so those get an escaped "<" that reads the same to
// JavaScript in strings, templates and regular expressions.
const inline = (js) => js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--").replace(/<(?=(?:meta|title|link)\b)/gi, "\\x3c");
{ // ...and the escaped bundle must still render exactly what prepare() rendered here.
  const FW = new Function(`${inline(renderJs)}\nreturn FWRender;`)();
  const again = FW.prepare(snap, { template, cdn: CDN });
  for (const k of ["listingHtml", "articles", "resources", "headerHtml", "footerHtml"]) {
    if (JSON.stringify(again[k]) !== JSON.stringify(content[k])) throw new Error(`The escaped renderer bundle renders ${k} differently.`);
  }
}
const asJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const runtime = read("poc/ghl-resources-cms/runtime.js");
if (!runtime.includes("/*DATA*/") || !runtime.includes("/*RENDER*/")) throw new Error("runtime.js has lost its /*DATA*/ or /*RENDER*/ placeholder.");
const base = { fontsUrl: FONTS, css, hostCss: HOST_CSS, extraCss: EXTRA_CSS };
const { siteCards, generatedAt, headHtml, ...shown } = content;
const { origin } = content;
const variants = {
  snapshot: {
    id: "fw-resources-snapshot", attrs: "",
    note: `CMS content as of ${generatedAt}, fixed in this file. Re-run build.mjs and re-paste to update.`,
    script: inline(runtime).replace("/*DATA*/", () => asJson({ ...base, hostId: "fw-resources-snapshot", ...shown })).replace("/*RENDER*/", "null"),
  },
  live: {
    id: "fw-resources-live", attrs: ` data-cms-url="${CMS}" data-asset-url="${CDN}"`,
    note: `Fetches ${CMS}/api/public/content and ${CDN}/css/style.css on every page load.`,
    script: `(function () {\n${inline(renderJs)}\n${inline(runtime).replace("/*DATA*/", () => asJson({ ...base, hostId: "fw-resources-live", template, live: { cmsUrl: CMS, cdn: CDN },
      // The frame shown at once while the CMS answers (replaced by the live one when it arrives)
      headerHtml: content.headerHtml, footerHtml: content.footerHtml, listingHtml: content.listingHtml, origin })).replace("/*RENDER*/", "FWRender")}\n})();`,
  },
};
mkdirSync(join(here, "dist"), { recursive: true });
for (const [name, v] of Object.entries(variants)) {
  const embed = `<!-- Faith Works Resources, GHL test (${name}; not the live page). ${v.note} Generated by poc/ghl-resources-cms/build.mjs; do not edit by hand. -->
<!-- Link previews and search: the Resources page's title, description and share image (the embed moves these into <head>) -->
${headHtml}
<div id="${v.id}"${v.attrs}><noscript>Resources need JavaScript to show.</noscript></div>
<script>
${v.script}
</script>
`;
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Resources · GHL test (${name})</title>
<style>body{margin:0}.fw-test-bar{margin:0;padding:8px 16px;font:13px/1.5 system-ui,sans-serif;background:#1A1A1A;color:#FAF8F4}</style>
</head>
<body>
<p class="fw-test-bar"><strong>${name === "live" ? "Live" : "Snapshot"}</strong> · ${v.note} (This bar is not part of the embed.)</p>
<!-- ===== COPY FROM HERE into the GHL Custom HTML element (or paste fw-resources-${name}-embed.html, which is exactly this) ===== -->
${embed}<!-- ===== COPY TO HERE ===== -->
</body>
</html>
`;
  if (embed.includes("{{")) throw new Error(`The ${name} embed still contains "{{", which GHL would rewrite as a merge field.`);
  const tags = embed.match(/<(?:meta|title|link)\b[^>]*>/gi) || [];
  if (tags.some((t) => !t.includes("data-fw-head"))) throw new Error(`The ${name} embed has a <meta>/<title>/<link> that a link-preview scraper would read: ${tags.find((t) => !t.includes("data-fw-head"))}`);
  writeFileSync(join(here, `dist/fw-resources-${name}-embed.html`), embed);
  writeFileSync(join(here, `dist/fw-resources-${name}-test.html`), page);
  console.log(`${name}: ${(Buffer.byteLength(embed) / 1024).toFixed(0)} KB`);
}
// The same tags on their own, for the GHL page's head code box (Settings → Tracking code → Header)
// should a crawler ever ignore them in the body.
writeFileSync(join(here, "dist/fw-resources-head-tags.html"), `<!-- Faith Works Resources: title, description and share image for the GHL page's Header tracking code. Generated by poc/ghl-resources-cms/build.mjs. -->\n${headHtml}\n`);
console.log(`CMS ${CMS}: ${content.resources.length} published resources (generated ${generatedAt}); links → ${origin}, assets → ${CDN}; fallback/snapshot css ${(css.length / 1024).toFixed(0)} KB, renderer bundle ${(renderJs.length / 1024).toFixed(0)} KB`);
