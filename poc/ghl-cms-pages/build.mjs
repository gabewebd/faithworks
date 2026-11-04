// ESBUILD_FROM=<path inside a project that has esbuild installed> node poc/ghl-cms-pages/build.mjs
// GHL versions of the pages whose events, testimonials, event announcement bar and latest resources
// come from the CMS at runtime:
//   dist/home.html, dist/learn.html, dist/professionals.html, dist/workshops.html, and (for the
//   announcement bar) dist/about.html, dist/build.html, dist/business.html, dist/community.html,
//   dist/speaking.html
//       the whole page, to paste into that page's GHL custom-code element in place of the root
//       page pasted there today (index.html, learn.html, professionals.html, workshops.html). The
//       same page, with every CMS-driven section marked (events, calendar, events gallery,
//       testimonials) and js/fw-live.js refreshing those sections from the CMS on each visit.
//   js/fw-live.js     that script: live.mjs and the site renderers as one browser file, served
//                     from the asset host with css/style.css and js/main.js.
//   dist/test/*.html  the same pages with root-relative assets, to preview from a local server at
//                     the repository root (they load this repository's js/main.js and js/fw-live.js).
// Reads only the published content (GET /api/public/content); writes nothing to the CMS, the root
// pages or GHL. Environment: CMS_CONTENT_URL (falls back to cms/.env), CDN_URL (same default as
// tools/layout.mjs), ESBUILD_FROM (as poc/ghl-resources-cms/build.mjs).
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { layout } from "../../tools/layout.mjs";
import { toRenderData } from "../../tools/content.mjs";
import * as R from "../../tools/render.mjs";
import { checkSnapshot } from "../../cms/shared/public.mjs";
import { LIVE, START, END, startMark, finish, hash } from "./finish.mjs";

const here = dirname(fileURLToPath(import.meta.url)), ROOT = join(here, "../..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const envFile = (key) => (existsSync(join(ROOT, "cms/.env")) ? (read("cms/.env").match(new RegExp(`^${key}=(.*)$`, "m")) || [])[1]?.trim() : undefined);
const CMS = (process.env.CMS_CONTENT_URL || envFile("CMS_CONTENT_URL") || "").replace(/\/$/, "");
if (!CMS) throw new Error("CMS_CONTENT_URL is not set (the CMS address, e.g. https://cms.example.com).");
const CDN = (process.env.CDN_URL || "https://faithworks.vercel.app").replace(/\/$/, "");
// GHL page → [root page pasted there today, its template]. About, Build, Business, Community and
// Speaking are here for the event announcement bar only (their other sections stay as built).
const PAGES = {
  home: ["index.html", "home.html"], learn: ["learn.html", "learn.html"], professionals: ["professionals.html", "professionals.html"], workshops: ["workshops.html", "workshops.html"],
  about: ["about.html", "about.html"], build: ["build.html", "build.html"], business: ["business.html", "business.html"], community: ["community.html", "community.html"], speaking: ["speaking.html", "speaking.html"],
};

/* ---- Content: the published snapshot, as the website build reads it ---- */
const res = await fetch(`${CMS}/api/public/content`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
if (!res.ok) throw new Error(`${CMS}/api/public/content answered HTTP ${res.status}`);
if (res.headers.get("x-content-stale")) console.warn("WARNING: the CMS database was unreachable; the CMS served its last good snapshot.");
const snap = await res.json();
const problems = checkSnapshot(snap);
if (snap.view !== "published") problems.push(`The CMS served the "${snap.view}" view, not the published one.`);
if (problems.length) throw new Error(problems.join(" "));
const data = toRenderData(snap);
R.init(data);
// The asset version tools/layout.mjs puts on css/style.css and js/main.js (FW_SITE needs the current main.js)
const VERSION = layout({ title: "", description: "", path: "/", nav: "", body: "", site: data.site }).match(/\/js\/main\.js\?v=(\w+)/)[1];

/* ---- Pages ---- */
// Each page starts from its committed root page: exactly what is pasted on GHL today (programs,
// heroes and every other section stay as they are). Only the output of the LIVE template calls is
// marked, with the hash of what is there now, so js/fw-live.js brings it up to date on each visit.
// A section the root page lacks (the new testimonial sections on Learn and Workshops) is rendered
// from its template and put after the section before it; one with nothing to show yet is put in
// hidden, so live content can show it later.
const CALL = /\{\{(\w+)(?::([\w.-]+))?\}\}/g;
// What each LIVE renderer's output starts with (tools/render.mjs, tools/event-gallery.mjs)
const SIGNS = {
  events: /<div class="(?:events|empty)">/, eventCalendar: /<div class="cal" data-fw-calendar>/,
  eventGallery: /<(?:div class="srows"|ul class="mgrid"|div class="hr-photos")[ >]/, voices: /<div class="voices[ "]/,
  eventBanner: /<div class="announce"[ >]/, latestResources: /<div class="latest"[ >]/,
};
const keyOf = (open) => (open.match(/\saria-labelledby="([^"]+)"/) || open.match(/\sid="([^"]+)"/) || [])[1];
// [start, end] of the <section> with this aria-labelledby (or id) in html
function sectionAt(html, key) {
  const re = /<section\b[^>]*>/g;
  for (let m; (m = re.exec(html));) if (keyOf(m[0]) === key) return [m.index, html.indexOf("</section>", m.index) + "</section>".length];
  return null;
}
// [start, end] of the first element matching sign in html[from, to), its closing tag included
function elementAt(html, from, to, sign) {
  const m = sign.exec(html.slice(from, to));
  if (!m) return null;
  const start = from + m.index, tag = m[0].match(/^<(\w+)/)[1], re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = start;
  for (let depth = 0, t; (t = re.exec(html));) if ((depth += t[1] ? -1 : 1) === 0) return [start, re.lastIndex];
  return null;
}
// The calendar and event cards arrive as shimmer placeholders (as the Resources page's cards), so a
// visitor never sees events as they were at build time before the CMS's current ones. The built
// markup travels in a <template> (inert: no images load, main.js does not set it up) that
// js/fw-live.js puts back only if the CMS cannot be reached. The marker hashes the placeholder, so
// the live content always replaces it (also with an older fw-live.js still on the asset host).
const bar = (cls = "") => `<span class="fw-skel__bar${cls && ` ${cls}`}"></span>`;
const SKELETONS = {
  eventCalendar: () => `<div class="cal fw-skel" role="status"><span class="sr-only">Loading the event calendar…</span>
        <div class="cal__main" aria-hidden="true">
          <div class="cal__head">${bar("fw-skel__month")}<div class="cal__controls">${bar("fw-skel__pill")}${bar("fw-skel__dot")}${bar("fw-skel__dot")}</div></div>
          <div class="cal__grid">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<span class="cal__dow">${d}</span>`).join("")}${'<span class="cal__day fw-skel__img"></span>'.repeat(35)}</div>
        </div>
        <div class="cal__panel" aria-hidden="true">${bar("fw-skel__w30")}${bar("fw-skel__h fw-skel__w90")}${bar("fw-skel__h fw-skel__w60")}${bar("fw-skel__w90")}${bar("fw-skel__w70")}</div>
      </div>`,
  events: () => `<div class="events fw-skel" role="status"><span class="sr-only">Loading events…</span>${`<article class="event" aria-hidden="true"><div class="event__date fw-skel__img"><b>&nbsp;</b></div><div class="event__body">${bar("fw-skel__chip")}${bar("fw-skel__h fw-skel__w90")}${bar("fw-skel__h fw-skel__w60")}${bar("fw-skel__w90")}${bar("fw-skel__w70")}${bar("fw-skel__btn")}</div></article>`.repeat(2)}</div>`,
};
// Their styles, once per page (palette: Faith Pink tints on white, as the Resources page)
const SKELETON_CSS = `<style data-fw-live-skel>
.fw-skel{pointer-events:none}
.fw-skel .fw-skel__bar,.fw-skel .fw-skel__img{background:linear-gradient(100deg,rgb(239 172 186/.14) 30%,rgb(239 172 186/.42) 50%,rgb(239 172 186/.14) 70%) #fff!important;background-size:300% 100%!important;animation:fw-skel 1.5s ease-in-out infinite}
.fw-skel .fw-skel__bar{display:block;height:12px;margin:0 0 12px;border-radius:6px}
.fw-skel .fw-skel__h{height:22px;margin-bottom:10px}
.fw-skel .fw-skel__chip{width:120px;height:22px;margin-bottom:16px;border-radius:999px}
.fw-skel .fw-skel__btn{width:160px;height:48px;margin:18px 0 0;border-radius:999px}
.fw-skel .fw-skel__month{width:min(180px,45%);height:30px;margin:0;border-radius:8px}
.fw-skel .fw-skel__pill{width:80px;height:44px;margin:0;border-radius:999px}
.fw-skel .fw-skel__dot{width:44px;height:44px;margin:0;border-radius:50%}
.fw-skel .cal__panel{min-height:220px}
.fw-skel__w30{width:30%}.fw-skel__w60{width:60%}.fw-skel__w70{width:70%}.fw-skel__w90{width:90%}
.fw-skel .event+.event .fw-skel__bar,.fw-skel .event+.event .fw-skel__img{animation-delay:.12s}
@keyframes fw-skel{0%{background-position:100% 0}100%{background-position:0 0}}
@media (prefers-reduced-motion:reduce){.fw-skel .fw-skel__bar,.fw-skel .fw-skel__img{animation:none}}
</style>`;
const marked = (name, arg, html) => {
  if (SKELETONS[name] && html) html = `${SKELETONS[name]()}<template data-fw-live-fallback>${html}</template>`;
  return `<!--${startMark(name, arg, hash(html))}-->${html}<!--${END}-->`;
};
// A template section rendered for the page: static markup finished as the build does, each call's output marked
function renderSection(src, cdn) {
  const parts = [];
  let empty = false;
  const text = finish(src.replace(CALL, (all, name, arg) => { parts.push([name, arg]); return `%%FW_CALL_${parts.length - 1}%%`; }), cdn);
  const html = text.replace(/%%FW_CALL_(\d+)%%/g, (all, i) => {
    const [name, arg] = parts[i], out = R[name](arg);
    if (!LIVE.includes(name)) return finish(out, cdn);
    if (out.includes(R.EMPTY_SECTION)) { empty = true; return marked(name, arg, ""); }
    return marked(name, arg, finish(out, cdn));
  });
  return empty ? html.replace(/^<section/, "<section hidden data-fw-live-hidden") : html;
}
function page(rootFile, template, cdn) {
  let html = read(rootFile).split(CDN).join(cdn);
  const src = read(join("templates", template)).replace(/<!--[\s\S]*?-->/g, (c) => (c.startsWith("<!--meta") ? c : ""));
  const sections = [...src.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)];
  sections.forEach((s, i) => {
    const calls = [...s[0].matchAll(CALL)].filter((c) => LIVE.includes(c[1]));
    if (!calls.length) return;
    const key = keyOf(s[0].match(/^<section\b[^>]*>/)[0]);
    const at = sectionAt(html, key);
    if (!at) { // not on the root page: render it, and put it after the section before it (the first one: at the top of <main>)
      const prev = sections.slice(0, i).reverse().map((p) => sectionAt(html, keyOf(p[0].match(/^<section\b[^>]*>/)[0]))).find(Boolean);
      const main = !prev && i === 0 && /<main\b[^>]*>\n?/.exec(html);
      if (!prev && !main) throw new Error(`${rootFile}: no place for the section "${key}"`);
      if (prev) html = `${html.slice(0, prev[1])}\n\n    ${renderSection(s[0], cdn)}${html.slice(prev[1])}`;
      else html = `${html.slice(0, main.index + main[0].length)}    ${renderSection(s[0], cdn)}\n\n${html.slice(main.index + main[0].length)}`;
      return;
    }
    let from = at[0];
    for (const [, name, arg] of calls) {
      const end = sectionAt(html, key)[1];
      const el = elementAt(html, from, end, SIGNS[name]);
      if (!el) throw new Error(`${rootFile}: the ${name}${arg ? `:${arg}` : ""} output was not found in the section "${key}"`);
      const mark = marked(name, arg, html.slice(el[0], el[1]));
      html = html.slice(0, el[0]) + mark + html.slice(el[1]);
      from = el[0] + mark.length;
    }
  });
  if (html.includes('class="cal fw-skel"') || html.includes('class="events fw-skel"')) {
    if (!html.includes("</head>")) throw new Error(`${rootFile}: no </head> for the placeholder styles`);
    html = html.replace("</head>", `${SKELETON_CSS}\n</head>`);
  }
  // style.css and fw-live.js are versioned by their content, so a re-pasted page never gets a cached older copy
  html = html.replace(/(\/js\/main\.js\?v=)\w+/, `$1${VERSION}`).replace(/(\/css\/style\.css\?v=)\w+/, `$1${CSS_V}`);
  // The live script runs after js/main.js (both deferred, in order), so FW_SITE is there for it
  const main = html.match(/<script src="[^"]*\/js\/main\.js\?v=(\w+)" defer><\/script>/);
  if (!main) throw new Error(`${rootFile}: the page no longer loads js/main.js as expected`);
  html = html.replace(main[0], `${main[0]}\n  <script src="${cdn}/js/fw-live.js?v=${LIVE_V}" data-cms-url="${CMS}" data-asset-url="${cdn}" defer></script>`);
  // Checks: every marked section still hashes to its marker; nothing GHL would take for a merge field
  const marks = [...html.matchAll(/<!--(fw-live:[^>]*?)-->([\s\S]*?)<!--\/fw-live-->/g)];
  for (const [, mark, inner] of marks) {
    const mm = START.exec(mark);
    if (!mm || hash(inner) !== mm[3]) throw new Error(`${rootFile}: the section ${mark} changed after it was hashed`);
  }
  if (html.includes("{{")) throw new Error(`${rootFile}: the page contains "{{", which GHL would rewrite as a merge field`);
  return { html, marks: marks.map((x) => START.exec(x[1]).slice(1, 3).filter(Boolean).join(":")) };
}

/* ---- js/fw-live.js: live.mjs and the site renderers as one browser file ---- */
// The renderers read a few registry files at import time; they are inlined and the Node built-ins
// they use become tiny shims (as poc/ghl-resources-cms/build.mjs). Nothing else of Node ships.
if (!process.env.ESBUILD_FROM) throw new Error("ESBUILD_FROM is not set: a path inside any project with esbuild installed (needed for js/fw-live.js).");
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
  entryPoints: [join(here, "live.mjs")], bundle: true, minify: true, write: false, format: "iife", platform: "browser", target: ["es2019"],
  define: { "process.env": "{}", "import.meta.url": '"file:///x/tools/render.mjs"' }, logLevel: "warning",
  plugins: [{ name: "node-shims", setup(b) {
    b.onResolve({ filter: /^node:(fs|path|url)$/ }, (a) => ({ path: a.path, namespace: "shim" }));
    b.onLoad({ filter: /.*/, namespace: "shim" }, (a) => ({ contents: SHIMS[a.path], loader: "js", resolveDir: ROOT }));
  } }],
});
const liveJs = `/* js/fw-live.js: generated by poc/ghl-cms-pages/build.mjs from poc/ghl-cms-pages/live.mjs and the site renderers (tools/). Do not edit by hand. */\n${bundle.outputFiles[0].text}`;

const short = (s) => createHash("sha1").update(s).digest("hex").slice(0, 10);
const LIVE_V = short(liveJs), CSS_V = short(read("css/style.css"));

/* ---- Output ---- */
mkdirSync(join(here, "dist/test"), { recursive: true });
writeFileSync(join(ROOT, "js/fw-live.js"), liveJs);
for (const [name, [rootFile, template]] of Object.entries(PAGES)) {
  const live = page(rootFile, template, CDN), test = page(rootFile, template, "");
  writeFileSync(join(here, `dist/${name}.html`), live.html);
  writeFileSync(join(here, `dist/test/${name}.html`), test.html);
  console.log(`${name}: ${(Buffer.byteLength(live.html) / 1024).toFixed(0)} KB, live sections: ${live.marks.join(", ") || "none"}`);
}
console.log(`CMS ${CMS}: ${data.events.length} published events, ${data.stories.filter((s) => s.quote && s.name).length} testimonials shown (generated ${snap.generated_at}); assets → ${CDN}; js/fw-live.js ${(Buffer.byteLength(liveJs) / 1024).toFixed(0)} KB`);
