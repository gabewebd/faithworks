// Allowlist HTML sanitizer for CMS page content (HTML Mode / Visual Editor output).
//
// How it stays safe: the input is tokenized (following the HTML5 rules that matter for
// security: comments, raw-text elements, quoted attributes) and the OUTPUT is rebuilt only
// from allowed tokens. Nothing is "removed by regex" from the original string, so markup the
// sanitizer does not understand can never survive. Every <style> body has "<" escaped, so it
// cannot break out of its element in HTML or SVG context.
//
// How it stays faithful: allowed tags and attributes are re-emitted exactly as written
// (same order, same double-quoted values, same text), so clean markup round-trips unchanged
// and the site's classes, layout and responsive rules are preserved.
//
// The original source is never modified in storage: drafts keep what the editor pasted and
// the report lists what was disabled, so nothing is discarded silently.
import { sanitizeCss } from "./sanitize-css.mjs";

const HTML_TAGS = new Set(("a abbr address article aside audio b bdi bdo blockquote br button caption cite code col colgroup data dd del " +
  "details dfn div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hgroup hr i img ins kbd li main mark nav ol p picture pre q " +
  "rp rt ruby s samp section small source span strong sub summary sup table tbody td tfoot th thead time tr track u ul var video wbr").split(" "));
const SVG_TAGS = new Set(("svg g path circle ellipse line polyline polygon rect defs lineargradient radialgradient stop clippath mask symbol use " +
  "text tspan pattern marker desc").split(" "));
const VOID = new Set("area base br col embed hr img input link meta source track wbr".split(" "));
// Content is dropped together with the element (raw text: the browser never parses it as tags).
const RAW_DROP = new Set("script xmp noembed noframes noscript textarea title plaintext".split(" "));
// Element and everything inside it is dropped.
const DROP_TREE = new Set("template object applet frameset frame select datalist math".split(" "));
// Element is dropped, its content kept.
const UNWRAP_QUIET = new Set(["html", "head", "body"]);

const GLOBAL_ATTRS = new Set("class id title lang dir role tabindex hidden style translate".split(" "));
const ATTRS = {
  a: "href target rel download hreflang type",
  img: "src srcset sizes alt width height loading decoding fetchpriority",
  source: "src srcset sizes media type width height",
  video: "src poster controls muted loop playsinline preload autoplay width height",
  audio: "src controls muted loop preload",
  track: "src kind srclang label default",
  iframe: "src width height title allow allowfullscreen loading referrerpolicy frameborder",
  td: "colspan rowspan headers", th: "colspan rowspan headers scope abbr",
  col: "span", colgroup: "span", ol: "start reversed type", li: "value",
  time: "datetime", del: "datetime cite", ins: "datetime cite", q: "cite", blockquote: "cite",
  details: "open", button: "type", data: "value",
};
const SVG_ATTRS = new Set(("viewbox xmlns xmlns:xlink fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset " +
  "stroke-miterlimit stroke-opacity fill-opacity fill-rule clip-rule clip-path mask d cx cy r rx ry x y x1 y1 x2 y2 dx dy width height points " +
  "transform opacity offset stop-color stop-opacity gradientunits gradienttransform spreadmethod fx fy preserveaspectratio font-size " +
  "font-family font-weight text-anchor dominant-baseline letter-spacing focusable visibility display patternunits patterncontentunits " +
  "markerwidth markerheight refx refy orient markerunits pathlength vector-effect shape-rendering href xlink:href").split(" "));
const URL_ATTRS = new Set(["href", "src", "poster", "cite", "xlink:href"]);
// ids that would shadow globals the site scripts rely on (DOM clobbering)
const RESERVED_IDS = new Set(["datalayer", "fw_config", "fwtrack", "__fwready", "gtag", "google_tag_manager"]);

export const DEFAULT_IFRAME_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.google.com", "api.leadconnectorhq.com", "link.msgsndr.com"];

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", colon: ":", tab: "\t", newline: "\n", nbsp: " ", sol: "/", lpar: "(", rpar: ")", period: "." };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

// URL check on the DECODED attribute value, the way the browser will see it.
export function safeUrl(raw, { kind = "link" } = {}) {
  const v = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
  if (v === "") return kind === "link";
  const scheme = v.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!scheme) {
    if (/&[a-z]+;?/i.test(v.split(/[/?#]/)[0])) return false; // unknown entity before the path: refuse
    return !v.startsWith("//") || kind === "link";
  }
  const s = scheme[1].toLowerCase();
  if (s === "http" || s === "https") return true;
  if (kind === "link") return s === "mailto" || s === "tel";
  if (kind === "image") return /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(v);
  return false;
}

function safeStyleAttr(value) {
  const decoded = decodeEntities(value);
  if (/expression\s*\(|javascript:|vbscript:|-moz-binding|(?<![-\w])behavior\s*:|@import|<\//i.test(decoded)) return false;
  const urls = [...decoded.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)].map((m) => m[2]);
  return urls.every((u) => safeUrl(u, { kind: "image" }) || /^data:font\//i.test(u));
}

/* ---- Tokenizer ---------------------------------------------------------------- */
const WS = /[\t\n\f\r ]/;
function parseTag(src, i) {
  // src[i] === "<"; returns { end, name, rawName, attrs, selfClosing, closing } or null at EOF
  let j = i + 1;
  const closing = src[j] === "/";
  if (closing) j++;
  let k = j;
  while (k < src.length && !WS.test(src[k]) && src[k] !== "/" && src[k] !== ">") k++;
  const rawName = src.slice(j, k);
  const attrs = [];
  let selfClosing = false;
  while (k < src.length) {
    while (k < src.length && (WS.test(src[k]) || (src[k] === "/" && src[k + 1] !== ">"))) k++;
    if (src[k] === "/" && src[k + 1] === ">") { selfClosing = true; k += 2; return { end: k, rawName, name: rawName.toLowerCase(), attrs, selfClosing, closing }; }
    if (src[k] === ">") { k++; return { end: k, rawName, name: rawName.toLowerCase(), attrs, selfClosing, closing }; }
    if (k >= src.length) break;
    let n = k + 1; // first char may be anything, including "="
    while (n < src.length && !WS.test(src[n]) && src[n] !== "/" && src[n] !== ">" && src[n] !== "=") n++;
    const name = src.slice(k, n);
    k = n;
    while (k < src.length && WS.test(src[k])) k++;
    if (src[k] !== "=") { attrs.push({ name, value: null, quote: "" }); continue; }
    k++;
    while (k < src.length && WS.test(src[k])) k++;
    const q = src[k];
    if (q === '"' || q === "'") {
      const e = src.indexOf(q, k + 1);
      if (e < 0) { k = src.length; break; }
      attrs.push({ name, value: src.slice(k + 1, e), quote: q });
      k = e + 1;
    } else {
      let e = k;
      while (e < src.length && !WS.test(src[e]) && src[e] !== ">") e++;
      attrs.push({ name, value: src.slice(k, e), quote: "" });
      k = e;
    }
  }
  return null; // EOF inside a tag: the browser drops the tag, so do we
}

function commentEnd(src, i) {
  // i at "<!--". HTML5: "<!-->" and "<!--->" close immediately; otherwise "-->" or "--!>".
  if (src.startsWith("<!-->", i)) return i + 5;
  if (src.startsWith("<!--->", i)) return i + 6;
  const a = src.indexOf("-->", i + 4), b = src.indexOf("--!>", i + 4);
  const ends = [a < 0 ? Infinity : a + 3, b < 0 ? Infinity : b + 4];
  const e = Math.min(...ends);
  return e === Infinity ? src.length : e;
}

function rawTextEnd(src, from, name) {
  const re = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, "ig");
  re.lastIndex = from;
  const m = re.exec(src);
  if (!m) return { contentEnd: src.length, end: src.length };
  const close = src.indexOf(">", m.index);
  return { contentEnd: m.index, end: close < 0 ? src.length : close + 1 };
}

/* ---- Sanitizer ---------------------------------------------------------------- */
export function sanitizeHtml(input, { iframeHosts = DEFAULT_IFRAME_HOSTS, extractStyles = false } = {}) {
  const src = String(input || "");
  const report = new Map();
  const note = (msg) => report.set(msg, (report.get(msg) || 0) + 1);
  let out = "";
  const styles = [];
  let svgDepth = 0;
  let dropDepth = 0, dropName = "";
  let i = 0;

  const emitText = (t) => { if (!dropDepth) out += t.replace(/</g, "&lt;"); };

  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { emitText(src.slice(i)); break; }
    if (lt > i) emitText(src.slice(i, lt));
    i = lt;
    const next = src[i + 1] || "";

    if (src.startsWith("<!--", i)) { i = commentEnd(src, i); continue; } // comments are dropped from published output
    if (next === "!" || next === "?") { const e = src.indexOf(">", i); i = e < 0 ? src.length : e + 1; continue; }
    const isEnd = next === "/";
    const first = isEnd ? src[i + 2] || "" : next;
    if (!/[a-z]/i.test(first)) {
      if (isEnd) { const e = src.indexOf(">", i); i = e < 0 ? src.length : e + 1; continue; } // "</>" and bogus end tags
      emitText("<"); i++; continue;
    }
    const tag = parseTag(src, i);
    if (!tag) break;
    i = tag.end;
    const { name } = tag;

    if (tag.closing) {
      if (dropDepth) { if (name === dropName && --dropDepth === 0) dropName = ""; continue; }
      if (name === "svg" && svgDepth) { svgDepth--; out += `</${tag.rawName}>`; continue; }
      const allowed = svgDepth ? SVG_TAGS.has(name) : HTML_TAGS.has(name);
      if (allowed && !VOID.has(name)) out += `</${tag.rawName}>`;
      continue;
    }

    if (RAW_DROP.has(name) || name === "style" || name === "iframe") {
      const { contentEnd, end } = rawTextEnd(src, i, name);
      const content = src.slice(i, contentEnd);
      i = end;
      if (dropDepth) continue;
      if (name === "style") {
        const { css, removed } = sanitizeCss(content);
        removed.forEach(note);
        if (extractStyles) styles.push(css);
        else out += `<style>${css}</style>`;
      } else if (name === "iframe") {
        const srcAttr = tag.attrs.find((a) => a.name.toLowerCase() === "src");
        let host = "";
        try { host = new URL(decodeEntities(srcAttr?.value || "")).hostname; } catch { /* invalid */ }
        const ok = srcAttr && /^https:/i.test(decodeEntities(srcAttr.value).trim()) && iframeHosts.includes(host);
        if (ok) out += buildTag(tag, "iframe", false, note) + "</iframe>";
        else note(`Removed an embedded frame from a site that is not on the allowed list${host ? ` (${host})` : ""}`);
      } else if (name === "script") note("Removed <script> (scripts never run in CMS content)");
      else if (name !== "title") note(`Removed <${name}>`);
      continue;
    }
    if (dropDepth) { if (name === dropName && !tag.selfClosing) dropDepth++; continue; }
    if (DROP_TREE.has(name)) {
      note(`Removed <${name}> and its content`);
      if (!tag.selfClosing) { dropDepth = 1; dropName = name; }
      continue;
    }
    if (name === "svg") {
      out += buildTag(tag, "svg", true, note);
      if (!tag.selfClosing) svgDepth++;
      continue;
    }
    const allowed = svgDepth ? SVG_TAGS.has(name) : HTML_TAGS.has(name);
    if (!allowed) {
      if (["meta", "link", "base"].includes(name)) note(`Removed <${name}> (page settings belong in the SEO fields)`);
      else if (["form", "input", "label", "option", "optgroup", "fieldset", "legend", "output", "embed", "area", "map", "canvas", "dialog"].includes(name)) note(`Removed <${name}> (forms and embeds must use the approved GHL form embed)`);
      else if (!UNWRAP_QUIET.has(name)) note(`Removed unsupported element <${name}> (its text was kept)`);
      continue;
    }
    out += buildTag(tag, name, !!svgDepth, note);
  }
  return { html: out, css: styles.join("\n"), report: [...report].map(([message, count]) => ({ message, count })) };
}

function buildTag(tag, name, svg, note) {
  let s = `<${tag.rawName}`;
  let hasBlank = false, rel = null;
  const seen = new Set();
  for (const a of tag.attrs) {
    const an = a.name.toLowerCase();
    if (seen.has(an)) continue;
    seen.add(an);
    if (!/^[a-z_:][-a-z0-9_:.]*$/.test(an)) { note("Removed a malformed attribute"); continue; }
    if (an.startsWith("on")) { note("Removed event handler attributes (onclick, onload…)"); continue; }
    const ok = GLOBAL_ATTRS.has(an) || an.startsWith("aria-") || (an.startsWith("data-") && !an.startsWith("data-fw-") && an !== "data-redirect")
      || (svg ? SVG_ATTRS.has(an) : (ATTRS[name] || "").split(" ").includes(an));
    if (!ok) { note(`Removed attribute “${an}”`); continue; }
    const value = a.value;
    if (value !== null) {
      if (URL_ATTRS.has(an)) {
        if (svg && (an === "href" || an === "xlink:href") && !decodeEntities(value).trim().startsWith("#")) { note("Removed an external SVG reference"); continue; }
        const kind = an === "href" ? "link" : an === "cite" ? "link" : "image";
        if (!safeUrl(value, { kind: name === "iframe" ? "frame" : kind }) && name !== "iframe") { note("Removed an unsafe link or source (e.g. javascript:)"); continue; }
      }
      if (an === "srcset" && !decodeEntities(value).split(",").every((c) => safeUrl(c.trim().split(/\s+/)[0] || "", { kind: "image" }))) { note("Removed an unsafe image source set"); continue; }
      if (an === "style" && !safeStyleAttr(value)) { note("Removed an unsafe inline style"); continue; }
      if (an === "id" && RESERVED_IDS.has(decodeEntities(value).toLowerCase())) { note(`Removed reserved id “${value}”`); continue; }
      if (an === "type" && name === "button" && decodeEntities(value).toLowerCase() !== "button") { s += ' type="button"'; continue; }
      if (an === "target" && decodeEntities(value).toLowerCase() === "_blank") hasBlank = true;
      if (an === "rel") { rel = decodeEntities(value); }
    }
    // Values are re-emitted as written, double-quoted; "<" and ">" are escaped so attribute
    // text can never look like markup to any later parser.
    const v = value === null ? null : value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (v === null) s += ` ${a.name}`;
    else if (a.quote === '"') s += ` ${a.name}="${v}"`;
    else s += ` ${a.name}="${v.replace(/"/g, "&quot;")}"`;
  }
  if (hasBlank && !/\bnoopener\b|\bnoreferrer\b/i.test(rel || "")) {
    if (rel === null) s += ' rel="noopener"';
    else s = s.replace(/ rel="([^"]*)"/i, (m, v) => ` rel="${v} noopener"`);
  }
  if (name === "iframe" && !seen.has("loading")) s += ' loading="lazy"';
  return s + (tag.selfClosing ? "/>" : ">");
}

// One-line summary of a report, for the dashboard.
export function describeReport(report) {
  return report.map((r) => (r.count > 1 ? `${r.message} ×${r.count}` : r.message));
}
