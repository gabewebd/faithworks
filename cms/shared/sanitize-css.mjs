// CSS safety and scoping for CMS page styles.
// sanitizeCss: neutralizes the few CSS features that can load or run code, and makes it
//   impossible for the stylesheet to close its <style> element (every "<" becomes the CSS
//   escape "\3c ", which is valid both inside strings and selectors).
// scopeCss: prefixes every selector so a page's styles apply only inside its content wrapper
//   and cannot restyle the site header, footer or other pages. html/body/:root map to the wrapper.

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|\.{0,2}\/|#|[a-z0-9_-]+\.(png|jpe?g|gif|webp|avif|svg|woff2?|ttf|otf)$)/i;
// SVG is allowed here only as a CSS image: browsers render CSS images in secure static mode (no script).
const SAFE_DATA = /^data:(image\/(png|jpe?g|gif|webp|avif|svg\+xml)|font\/(woff2?|ttf|otf)|application\/(font-woff2?|x-font-woff))[;,]/i;

function cleanUrl(raw) {
  const u = raw.trim().replace(/^['"]|['"]$/g, "").replace(/\\/g, "").replace(/[\s\u0000-\u001f]/g, "");
  if (SAFE_DATA.test(u)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return /^https?:/i.test(u);
  return SAFE_URL.test(u) || !/[:]/.test(u);
}

export function sanitizeCss(input) {
  const removed = [];
  let css = String(input || "");
  if (!css.trim()) return { css: "", removed };
  css = css.replace(/</g, "\\3c ");
  css = css.replace(/@import\s+(url\(\s*)?(['"]?)([^'")\s;]+)\2\s*\)?([^;]*);?/gi, (all, _u, _q, url) => {
    if (/^https:\/\//i.test(url)) return all;
    removed.push("@import of a non-https stylesheet");
    return "/* removed: @import */";
  });
  css = css.replace(/url\(\s*((['"])(?:\\.|(?!\2).)*\2|[^)]*)\s*\)/gi, (all, inner) => {
    if (cleanUrl(inner)) return all;
    removed.push("unsafe url() in styles");
    return 'url("about:invalid")';
  });
  css = css.replace(/(expression\s*\(|-moz-binding|(?<![-\w])behavior\s*:|javascript:|vbscript:)/gi, (m) => {
    removed.push(`unsafe CSS (${m.replace(/\s|\(|:/g, "")})`);
    return "/*removed*/";
  });
  return { css, removed };
}

/* ---- Scoping --------------------------------------------------------------- */
// Reads from i to the first top-level stop character, skipping strings, comments and brackets.
function readUntil(src, i, stops) {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'") { i++; while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1; i++; continue; }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0 && stops.includes(c)) return i;
    i++;
  }
  return i;
}
// i points just after "{". Returns the index of the matching "}".
function matchBrace(src, i) {
  let depth = 1;
  while (i < src.length) {
    const j = readUntil(src, i, "{}");
    if (j >= src.length) return src.length;
    depth += src[j] === "{" ? 1 : -1;
    if (depth === 0) return j;
    i = j + 1;
  }
  return src.length;
}
function splitSelectors(prelude) {
  const out = [];
  let i = 0, start = 0;
  while (i <= prelude.length) {
    const j = readUntil(prelude, i, ",");
    out.push(prelude.slice(start, j));
    i = start = j + 1;
    if (j >= prelude.length) break;
  }
  return out;
}
function scopeSelector(sel, scope) {
  const s = sel.trim();
  if (!s) return s;
  const m = s.match(/^(?:html|:root)(?:\s*>\s*|\s+)body\b|^(?:html|:root|body)\b/i);
  if (m) return scope + s.slice(m[0].length);
  return `${scope} ${s}`;
}
const NESTED_AT = /^@(media|supports|container|layer|document|-moz-document)\b/i;

function scopeRules(src, scope) {
  let out = "", i = 0;
  while (i < src.length) {
    const j = readUntil(src, i, "{};");
    const prelude = src.slice(i, j);
    if (j >= src.length) { out += prelude; break; }
    if (src[j] === ";" || src[j] === "}") { out += prelude + src[j]; i = j + 1; continue; }
    const end = matchBrace(src, j + 1);
    const body = src.slice(j + 1, end);
    const lead = prelude.match(/^\s*/)[0];
    const p = prelude.replace(/\/\*[^]*?\*\//g, "").trim(); // comments before a rule are not part of its selector
    if (p.startsWith("@")) out += lead + p + "{" + (NESTED_AT.test(p) ? scopeRules(body, scope) : body) + "}";
    else out += lead + splitSelectors(p).map((x) => scopeSelector(x, scope)).join(", ") + "{" + body + "}";
    i = end + 1;
  }
  return out;
}

export function scopeCss(css, scope) {
  return css ? scopeRules(String(css), scope) : "";
}
