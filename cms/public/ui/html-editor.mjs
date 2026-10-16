// Page editor: HTML mode and Visual editor, two views of the same page document.
//
// The document: body HTML (body_html) + page CSS (body_css) + layout (global navbar and footer,
// or a custom layout). HTML mode shows the page as one complete HTML document (its <head> is
// generated from Details; only the <body> is saved) with the page CSS in its own box below. Values Details controls are marked in the page
// (data-cms-bind, data-cms-href, data-cms-component; see shared/page-doc.mjs) and kept in
// sync both ways for the title and summary: editing the marked heading changes Details, and
// editing Details changes the heading. Nothing is matched by text.
//
// Safety: the page is rendered in an <iframe sandbox="allow-same-origin"> WITHOUT allow-scripts,
// with its own Content-Security-Policy (no script source at all). Pasted scripts, inline
// handlers and javascript: links never run, forms cannot submit and links cannot navigate.
// Elements that could act on the page (script, meta, base, link, object, embed, frames, iframes
// from hosts not on the allowed list) are swapped for inert "kept" placeholders while editing
// and put back exactly as written when the HTML is saved, so nothing is silently discarded.
// Publishing applies the server-side sanitizer; the safety report lists what it would remove.
//
// Fidelity: the source is kept untouched until a visual edit happens. Visual edits change only
// the selected element, so classes, ids, attributes, inline styles and page CSS are preserved.
import { h, clear, icon, toast, dialog } from "./dom.mjs";
import { selectBox, toggle } from "./controls.mjs";
import { sanitizeHtml, describeReport } from "/shared/sanitize-html.mjs";
import { sanitizeCss } from "/shared/sanitize-css.mjs";
import { checkUrl } from "/shared/validate.mjs";
import { BINDINGS, LINKS, COMPONENTS, applyBindings, getBoundText, recordComponent, eventCta, esc } from "/shared/page-doc.mjs";
import { SNIPPETS } from "/shared/starters.mjs";

const KEEP_SELECTOR = "script, meta, base, link, object, embed, applet, frame, frameset, template, plaintext, xmp, iframe";
const TEXT_TAGS = { p: "Paragraph", li: "List item", blockquote: "Quote", figcaption: "Caption", td: "Table cell", th: "Table heading", dt: "Term", dd: "Description", span: "Text", strong: "Bold text", em: "Emphasis", small: "Small text", b: "Bold text", i: "Italic text", label: "Label", cite: "Citation", q: "Quote", summary: "Question (FAQ)", caption: "Table caption", time: "Date/time", mark: "Highlight", code: "Code", pre: "Preformatted text", sup: "Superscript", sub: "Subscript", u: "Underline", s: "Strikethrough", abbr: "Abbreviation", del: "Deleted text", ins: "Inserted text" };
const SECTION_TAGS = { section: "Section", header: "Header", footer: "Footer", main: "Main area", article: "Article", aside: "Side note", nav: "Navigation", figure: "Figure", picture: "Picture", details: "FAQ item (expandable)", form: "Form (not published)", hgroup: "Heading group" };
const EDITOR_CSS = `
[data-cms-hover]{outline:2px dashed #d0587a!important;outline-offset:2px;cursor:pointer}
[data-cms-sel]{outline:3px solid #d0587a!important;outline-offset:2px}
[data-cms-editing]{outline:3px solid #ffcb2a!important;outline-offset:2px;cursor:text;background-color:rgba(255,203,42,.08)}
#cms-root [data-cms-bind]:not([data-cms-sel]):not([data-cms-editing]):not([data-cms-hover]),#cms-root [data-cms-href]:not([data-cms-sel]):not([data-cms-hover]),#cms-root [data-cms-c]:not([data-cms-sel]):not([data-cms-hover]){outline:2px dotted rgba(36,71,127,.55);outline-offset:3px}
cms-keep{display:inline-flex!important;align-items:center;gap:6px;font:500 12px/1.4 system-ui,sans-serif!important;background:#f1ede8!important;border:1px dashed #9a8f84!important;color:#4a4038!important;padding:3px 10px!important;border-radius:6px!important;margin:3px!important;vertical-align:middle}
.cms-ph{display:grid;place-items:center;min-height:56px;padding:14px 16px;border:2px dashed #9aa8c5;border-radius:12px;background:#eef2fa;color:#24477f;font:600 13px/1.45 system-ui,sans-serif;text-align:center;list-style:none}
.cms-ph--media{min-height:180px}
.cms-chrome{display:flex;align-items:center;gap:18px;padding:14px 24px;background:#1a1e24;color:#c3c5c7;font:500 13px/1.4 system-ui,sans-serif}
.cms-chrome b{color:#efacba;font-weight:600}.cms-chrome span:last-child{margin-left:auto;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#ffcb2a}
.cms-chrome--foot{min-height:80px}
#cms-root:empty::before{content:"This page has no content yet. Use “Start from the template” in the panel, or paste HTML in HTML mode.";display:block;padding:64px 16px;text-align:center;color:#666;font:15px system-ui,sans-serif}
body.cms-canvas{min-height:100vh}`;

const isLocal = () => ["localhost", "127.0.0.1"].includes(location.hostname);
const trimDoc = (s) => String(s || "").replace(/^\s*\n/, "").replace(/\s+$/, "");

/* ---- Syntax highlighting (HTML with embedded CSS) ---------------------------------- */
const e = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function hlTag(tag) {
  const m = tag.match(/^(<\/?!?)([^\s/>]*)([^]*?)(\/?>)?$/);
  if (!m) return e(tag);
  const attrs = m[3].replace(/([^\s="'<>/]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s>]+)?|[^]/g, (all, name, eq, val) => {
    if (!name) return e(all);
    const cms = /^data-cms-/i.test(name);
    return `<span class="${cms ? "t-cms" : "t-attr"}">${e(name)}</span>${eq ? e(eq) : ""}${val ? `<span class="${cms ? "t-cms" : "t-val"}">${e(val)}</span>` : ""}`;
  });
  return `<span class="t-tag">${e(m[1])}${e(m[2])}</span>${attrs}<span class="t-tag">${e(m[4] || "")}</span>`;
}
function hlCss(src) {
  let out = "", depth = 0, i = 0;
  while (i < src.length) {
    if (src.startsWith("/*", i)) { const end = src.indexOf("*/", i + 2); const j = end < 0 ? src.length : end + 2; out += `<span class="t-com">${e(src.slice(i, j))}</span>`; i = j; continue; }
    const c = src[i];
    if (c === "{") { depth++; out += c; i++; continue; }
    if (c === "}") { depth = Math.max(0, depth - 1); out += c; i++; continue; }
    let j = i;
    while (j < src.length && !"{}".includes(src[j]) && !src.startsWith("/*", j)) j++;
    const chunk = src.slice(i, j);
    out += depth ? e(chunk).replace(/(^|;|\n)(\s*)([-a-zA-Z]+)(\s*:)/g, '$1$2<span class="t-attr">$3</span>$4') : `<span class="t-tag">${e(chunk)}</span>`;
    i = j;
  }
  return out;
}
export function highlight(src) {
  let out = "", i = 0;
  while (i < src.length) {
    if (src.startsWith("<!--", i)) { const end = src.indexOf("-->", i + 4); const j = end < 0 ? src.length : end + 3; out += `<span class="t-com">${e(src.slice(i, j))}</span>`; i = j; continue; }
    if (src[i] === "<" && /[a-zA-Z/!]/.test(src[i + 1] || "")) {
      let j = i + 1, q = "";
      while (j < src.length) { const c = src[j]; if (q) { if (c === q) q = ""; } else if (c === '"' || c === "'") q = c; else if (c === ">") { j++; break; } else if (c === "<") break; j++; }
      const tag = src.slice(i, j);
      out += hlTag(tag);
      const name = (tag.match(/^<([a-zA-Z][\w-]*)/) || [])[1]?.toLowerCase();
      if (name === "style" || name === "script") {
        const close = src.toLowerCase().indexOf(`</${name}`, j);
        const k = close < 0 ? src.length : close;
        out += name === "style" ? hlCss(src.slice(j, k)) : `<span class="t-com">${e(src.slice(j, k))}</span>`;
        i = k; continue;
      }
      i = j; continue;
    }
    if (src[i] === "&") { const m = /^&[#\w]+;/.exec(src.slice(i, i + 12)); if (m) { out += `<span class="t-ent">${e(m[0])}</span>`; i += m[0].length; continue; } }
    let j = i + 1;
    while (j < src.length && src[j] !== "<" && src[j] !== "&") j++;
    out += e(src.slice(i, j));
    i = j;
  }
  return out + "\n";
}

// YouTube and Vimeo page addresses → their privacy-friendly embed address.
export function toEmbed(v) {
  let u; try { u = new URL(String(v || "").trim()); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (/^(m\.)?youtube(-nocookie)?\.com$/.test(host)) id = u.searchParams.get("v") || (u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/) || [])[2];
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === "vimeo.com" || host === "player.vimeo.com") { const m = u.pathname.match(/(\d{6,})/); if (m) return `https://player.vimeo.com/video/${m[1]}`; }
  return null;
}

export function createHtmlEditor({
  html = "", css = "", layout = "site", collection, config, readOnly = false, onChange = () => {},
  values = () => ({ text: {}, links: {} }), record = () => ({}), headInfo = () => ({ title: "", description: "" }),
  onBoundEdit = () => {}, onHeadEdit = () => {}, onGoToField = () => {}, onSetDetail = () => {}, starter = null, onImportMeta = () => {},
}) {
  const card = collection === "testimonials"; // a reusable card, not a full page
  const state = { mode: "visual", device: "desktop", siteStyles: true, html: trimDoc(html), css: trimDoc(css), layout: layout === "custom" ? "custom" : "site", dirtyVisual: false, kept: new Map(), comps: new Map(), undo: [], redo: [], sel: null, editing: null, editStart: "", editBefore: "", headNote: "" };
  const siteBase = isLocal() ? "" : config.publicSiteUrl;

  /* ---- Toolbar ---- */
  const modeBtns = {
    visual: h("button", { type: "button", "aria-pressed": "true", onclick: () => setMode("visual") }, icon("pointer"), "Visual editor"),
    html: h("button", { type: "button", "aria-pressed": "false", onclick: () => setMode("html") }, icon("code"), "HTML"),
  };
  const devBtns = {
    desktop: h("button", { type: "button", "aria-pressed": "true", title: "Desktop width", onclick: () => setDevice("desktop") }, icon("desktop"), h("span", { class: "sr-only" }, "Desktop")),
    mobile: h("button", { type: "button", "aria-pressed": "false", title: "Mobile width (390px)", onclick: () => setDevice("mobile") }, icon("mobile"), h("span", { class: "sr-only" }, "Mobile")),
  };
  const undoBtn = h("button", { type: "button", class: "btn btn--light btn--sm", title: "Undo (Ctrl+Z)", onclick: () => undo(), disabled: true }, icon("undo"), "Undo");
  const redoBtn = h("button", { type: "button", class: "btn btn--light btn--sm", title: "Redo (Ctrl+Y)", onclick: () => redo(), disabled: true }, icon("redo"), "Redo");
  const insertPop = h("div", { class: "menu-pop menu-pop--left", role: "menu", hidden: true },
    Object.entries(SNIPPETS).filter(([k]) => !card || ["paragraph", "heading"].includes(k)).map(([k, s]) => h("button", { type: "button", role: "menuitem", onclick: () => { insertPop.hidden = true; insertSnippet(k); } }, s.label)));
  const insertBtn = h("button", { type: "button", class: "btn btn--light btn--sm", "aria-haspopup": "menu", onclick: () => { if (state.mode !== "visual") setMode("visual"); insertPop.hidden = !insertPop.hidden; } }, icon("plus"), "Insert");
  document.addEventListener("click", (ev) => { if (!insertBtn.contains(ev.target) && !insertPop.contains(ev.target)) insertPop.hidden = true; });
  const morePop = h("div", { class: "menu-pop", role: "menu", hidden: true },
    starter ? h("button", { type: "button", role: "menuitem", class: "danger", onclick: () => { morePop.hidden = true; resetToStarter(); } }, card ? "Reset to the standard card…" : "Start over from the template…") : null,
    card ? null : h("button", { type: "button", role: "menuitem", onclick: () => { morePop.hidden = true; importPage(); } }, "Import a complete page…"));
  const moreBtn = h("button", { type: "button", class: "btn btn--ghost btn--sm", "aria-haspopup": "menu", onclick: () => { morePop.hidden = !morePop.hidden; } }, "More…");
  document.addEventListener("click", (ev) => { if (!moreBtn.contains(ev.target) && !morePop.contains(ev.target)) morePop.hidden = true; });

  const layoutToggle = card ? null : toggle({ checked: state.layout === "site", disabled: readOnly, label: "Use global navbar and footer", onChange: (on) => setLayout(on ? "site" : "custom") });
  const layoutBar = card ? null : h("div", { class: "he-layout" }, layoutToggle.el,
    h("p", { class: "he-layout__warn", role: "note" }, icon("shield"), "Keep the global navbar and footer enabled unless this page has its own custom navbar and footer."));

  const bar = h("div", { class: "he-bar" },
    h("div", { class: "seg", role: "group", "aria-label": "Editing mode" }, modeBtns.visual, modeBtns.html),
    h("div", { class: "seg", role: "group", "aria-label": "Preview width" }, devBtns.desktop, devBtns.mobile),
    readOnly ? null : undoBtn, readOnly ? null : redoBtn,
    readOnly ? null : h("div", { class: "menu-wrap" }, insertBtn, insertPop),
    h("span", { class: "spacer" }),
    h("label", { class: "check small", title: "Show the page with the Faith Works website styles (css/style.css), as on the site" },
      h("input", { type: "checkbox", checked: true, onchange: (e) => { state.siteStyles = e.target.checked; flush(); renderFrame(); } }), "Website styles"),
    readOnly ? null : h("div", { class: "menu-wrap" }, moreBtn, morePop));

  /* ---- Visual mode ---- */
  const frame = h("iframe", { title: card ? "Card template (visual editor)" : "Page (visual editor)", sandbox: "allow-same-origin", referrerpolicy: "no-referrer" });
  const canvas = h("div", { class: "he-canvas" }, frame);
  const panel = h("div", { class: "he-panel", "aria-live": "polite" });
  const visual = h("div", { class: "he-body" }, canvas, panel);

  /* ---- HTML mode: one complete document, highlighted ---- */
  const hl = h("pre", { class: "code__hl", "aria-hidden": "true" }, h("code"));
  const area = h("textarea", { class: "code__ta", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": card ? "Card HTML" : "Page HTML document", readonly: readOnly || null, wrap: "off" });
  const headNote = h("p", { class: "he-note", hidden: true });
  // Page CSS has its own editor below the HTML (applies only to this page)
  const cssHl = h("pre", { class: "code__hl", "aria-hidden": "true" }, h("code"));
  const cssArea = h("textarea", { class: "code__ta", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": card ? "Card CSS" : "Page CSS", readonly: readOnly || null, wrap: "off" });
  const code = h("div", { class: "he-code", hidden: true },
    h("div", { class: "label" }, h("span", {}, card ? "Card HTML" : "HTML document"),
      h("span", { class: "muted" }, card ? "Quote and name come from Details" : "Head comes from Details")),
    h("div", { class: "code" }, hl, area), headNote,
    h("div", { class: "label" }, h("span", {}, card ? "Card CSS" : "Page CSS"), h("span", { class: "muted" }, `This ${card ? "card" : "page"} only`)),
    h("div", { class: "code code--css" }, cssHl, cssArea),
    h("p", { class: "he-note" }, h("code", { class: "t-cms" }, "data-cms-…"), " = linked to Details. Esc then Tab leaves the editor."));
  const paintCss = () => { cssHl.firstChild.innerHTML = hlCss(cssArea.value) + "\n"; cssHl.scrollTop = cssArea.scrollTop; cssHl.scrollLeft = cssArea.scrollLeft; };
  const paint = () => { hl.firstChild.innerHTML = highlight(area.value); hl.scrollTop = area.scrollTop; hl.scrollLeft = area.scrollLeft; paintCss(); };
  // Fills both code editors from the current state
  const fillCode = () => { area.value = composeDoc(); cssArea.value = state.css; paint(); };
  let escPressed = false, typingTimer;
  for (const [ta, pre] of [[area, hl], [cssArea, cssHl]]) {
    ta.addEventListener("scroll", () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { escPressed = true; return; }
      if (ev.key === "Tab" && !escPressed && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !readOnly) {
        ev.preventDefault();
        const { selectionStart: s, selectionEnd: t, value } = ta;
        if (ev.shiftKey) { const ls = value.lastIndexOf("\n", s - 1) + 1; if (value.startsWith("  ", ls)) { ta.setRangeText("", ls, ls + 2, "preserve"); } }
        else ta.setRangeText("  ", s, t, "end");
        ta.dispatchEvent(new Event("input"));
      }
      escPressed = false;
    });
  }
  area.addEventListener("input", () => { requestAnimationFrame(paint); clearTimeout(typingTimer); typingTimer = setTimeout(readArea, 250); onChange(); });
  cssArea.addEventListener("input", () => { state.css = cssArea.value; requestAnimationFrame(paintCss); onChange(); scheduleReport(); });

  const report = h("div", { class: "he-report" });
  // The starter template note (an HTML comment at the top of the page) shown above the canvas
  const NOTE_RE = /<!--\s*(THIS IS JUST A TEMPLATE[^]*?)-->\s*/;
  const noteBox = h("div", { class: "alert alert--info he-tnote", hidden: true });
  function renderNote() {
    const m = NOTE_RE.exec(state.html);
    noteBox.hidden = !m || state.mode !== "visual";
    if (!m) return;
    const text = m[1].replace(/\s*This note is not published\.\s*$/i, "").replace(/\s+/g, " ").trim();
    clear(noteBox, h("div", {}, h("p", {}, h("strong", {}, "This is just a template. "), text.replace(/^THIS IS JUST A TEMPLATE\.\s*/i, "")),
      readOnly ? null : h("button", { type: "button", class: "btn btn--light btn--sm", onclick: () => { flush(); state.html = state.html.replace(NOTE_RE, ""); state.undo = []; state.redo = []; syncUndo(); renderFrame(); onChange(); } }, "Got it, remove this note")));
  }
  const el = h("div", { class: "he" }, layoutBar, bar, noteBox, visual, code, report);

  /* ---- The document as text ---- */
  function composeDoc() {
    if (card) return state.html + "\n";
    const { title, description } = headInfo();
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <!-- From Details. Only the body is saved; styles are in Page CSS. -->
</head>
<body>
${state.html}
</body>
</html>
`;
  }
  const decodeText = (s) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };
  function parseDoc(text) {
    const lower = text.toLowerCase();
    const styleRe = /<style\b[^>]*>([^]*?)<\/style\s*>/gi;
    if (card) {
      const styles = [...text.matchAll(styleRe)].map((m) => trimDoc(m[1]));
      return { html: trimDoc(text.replace(styleRe, "")), css: styles.join("\n\n"), title: null, description: null, ignored: 0 };
    }
    // Find <body> outside comments (blank them out, keeping positions)
    const bare = lower.replace(/<!--[^]*?-->/g, (m) => " ".repeat(m.length));
    const bodyOpen = bare.search(/<body[\s>]/);
    if (bodyOpen < 0) {
      if (/^\s*(<!doctype|<html|<head)/i.test(text)) { const p = splitPage(text); return { html: p.html, css: p.css, title: p.title || null, description: p.description || null, ignored: 0 }; }
      return { html: trimDoc(text), css: state.css, title: null, description: null, ignored: 0 };
    }
    const bodyStart = text.indexOf(">", bodyOpen) + 1;
    const close = bare.lastIndexOf("</body>");
    const head = text.slice(0, bodyOpen);
    const styles = [...head.matchAll(styleRe)].map((m) => trimDoc(m[1]));
    const title = head.match(/<title[^>]*>([^]*?)<\/title>/i);
    const desc = head.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    const ignored = [...head.replace(styleRe, "").matchAll(/<(link|script|meta|base)\b([^>]*)>/gi)]
      .filter((m) => !/charset|name=["']description/i.test(m[2]) && !/\/css\/(style|pages)\.css/.test(m[2])).length;
    const body = text.slice(bodyStart, close < bodyStart ? text.length : close);
    styles.push(...[...body.matchAll(styleRe)].map((m) => trimDoc(m[1])));
    return { html: trimDoc(body.replace(styleRe, "")), css: styles.filter(Boolean).join("\n\n"), title: title ? decodeText(title[1]).trim() : null, description: desc ? decodeText(desc[1]).trim() : null, ignored };
  }
  function readArea() {
    const p = parseDoc(area.value);
    state.html = p.html;
    // Styles written into the HTML (e.g. a pasted page) move to the CSS box
    if (p.css.trim()) {
      state.css = [cssArea.value.trim(), p.css].filter(Boolean).join("\n\n");
      const pos = area.selectionStart;
      fillCode();
      area.selectionStart = area.selectionEnd = Math.min(pos, area.value.length);
      toast(`Styles from the HTML were moved to the ${card ? "Card" : "Page"} CSS box below.`, "info", 4000);
      onChange();
    }
    headNote.hidden = !p.ignored;
    headNote.textContent = p.ignored ? `${p.ignored} element(s) in <head> (scripts, links or meta tags) are not saved. Only the title and description are kept; the website adds its own stylesheets.` : "";
    syncBoundFromSource();
    if (p.title !== null || p.description !== null) onHeadEdit({ title: p.title, description: p.description });
    scheduleReport();
  }
  // Title/summary changed in HTML mode → Details (only when the user changed them there)
  let boundSeen = {};
  const rememberBound = () => { boundSeen = Object.fromEntries(Object.entries(BINDINGS).filter(([, b]) => b.twoWay).map(([k]) => [k, getBoundText(state.html, k)])); };
  function syncBoundFromSource() {
    for (const [key, b] of Object.entries(BINDINGS)) {
      if (!b.twoWay) continue;
      const t = getBoundText(state.html, key);
      if (t !== null && t !== boundSeen[key]) { boundSeen[key] = t; onBoundEdit(key, t); }
    }
  }

  /* ---- Rendering the frame ---- */
  function renderComponent(name) {
    const rec = record();
    const out = recordComponent(name, collection, rec);
    if (out === null) {
      if (name === "featured-image") return `<div class="cms-ph cms-ph--media">Featured image · set one in Details → Featured image</div>`;
      if (name === "portrait") return `<div class="cms-ph">Photo (optional) · set in Details → Photo</div>`;
      return `<div class="cms-ph">${esc(COMPONENTS[name]?.label || name)} · nothing to show yet</div>`;
    }
    if (out !== undefined) return out;
    if (name === "program-form") return `<div class="cms-ph cms-ph--media">Interest form · added by the website (sends the program name with each sign-up)</div>`;
    if (name === "other-programs") return `<li class="cms-ph">Other programs · listed automatically</li>`;
    if (name === "related-articles") return `<li class="cms-ph">Other articles · listed automatically</li>`;
    if (name === "event-actions") return eventCta(rec, false) || `<span class="cms-ph">Registration button · choose a registration destination in Details</span>`;
    return `<div class="cms-ph">Generated by the website (${esc(name)})</div>`;
  }
  // Swap active elements for inert placeholders and render generated parts. Returns body HTML.
  function protect(source) {
    const d = new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${source}</body></html>`, "text/html");
    state.kept = new Map(); state.comps = new Map();
    let n = 0;
    const allowed = new Set(config.iframeHosts || []);
    for (const node of [...d.body.querySelectorAll(KEEP_SELECTOR)]) {
      if (node.tagName === "IFRAME") { try { const u = new URL(node.getAttribute("src") || ""); if (u.protocol === "https:" && allowed.has(u.hostname)) continue; } catch { /* keep */ } }
      if (!node.isConnected) continue;
      const k = String(++n);
      state.kept.set(k, node.outerHTML);
      const ph = d.createElement("cms-keep");
      ph.setAttribute("data-k", k);
      ph.setAttribute("contenteditable", "false");
      ph.textContent = `⟨${node.tagName.toLowerCase()}⟩ kept as written · ${node.tagName === "SCRIPT" ? "never runs" : "not shown here"}`;
      node.replaceWith(ph);
    }
    let c = 0;
    for (const node of d.body.querySelectorAll("[data-cms-component]")) {
      if (node.parentElement?.closest("[data-cms-c]")) continue;
      const k = String(++c);
      state.comps.set(k, node.innerHTML);
      node.setAttribute("data-cms-c", k);
      node.innerHTML = renderComponent(node.getAttribute("data-cms-component"));
    }
    return d.body.innerHTML;
  }
  const chrome = (where) => state.layout !== "site" || card ? "" : where === "top"
    ? `<div class="cms-chrome" contenteditable="false"><b>Faith Works</b><span>Learn AI · Build with AI · For Business · Resources · About</span><span>Global navbar · from the website</span></div>`
    : `<div class="cms-chrome cms-chrome--foot" contenteditable="false"><b>Faith Works</b><span>Footer links, social links, Privacy Notice and Terms</span><span>Global footer · from the website</span></div>`;
  function frameDoc() {
    const self = siteBase || "'self'";
    const policy = ["default-src 'none'", `style-src 'unsafe-inline' https: ${self}`, `img-src https: data: ${self}`, `font-src https: data: ${self}`, "media-src https:", "frame-src https:", "form-action 'none'", `base-uri ${siteBase || "'none'"}`].join("; ");
    const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">';
    const body = card
      ? `<main class="section wrap"><div class="quotes fw-quotes"><div id="cms-root" class="cms-card">${protect(state.html)}</div></div></main>`
      : `${chrome("top")}<main id="cms-root" class="cms-page">${protect(state.html)}</main>${chrome("foot")}`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width, initial-scale=1">${siteBase ? `<base href="${siteBase}/">` : ""}${fonts}${state.siteStyles ? `<link rel="stylesheet" href="${siteBase}/css/style.css">` : ""}<style id="cms-page-css">${sanitizeCss(state.css).css}</style><style id="cms-editor-css">${EDITOR_CSS}</style></head><body class="cms-canvas${state.layout === "custom" ? " page--custom" : ""}">${body}</body></html>`;
  }
  function renderFrame() {
    renderNote();
    state.sel = null; state.editing = null;
    frame.onload = () => { if (!readOnly) wire(); renderPanel(); };
    frame.srcdoc = frameDoc();
  }
  const doc = () => frame.contentDocument;
  const root = () => doc()?.getElementById("cms-root");

  /* ---- Serialization ---- */
  const EDITOR_ATTRS = ["data-cms-hover", "data-cms-sel", "data-cms-editing"];
  function cleanClone(r) {
    const clone = r.cloneNode(true);
    for (const n of clone.querySelectorAll(EDITOR_ATTRS.map((a) => `[${a}]`).join(","))) EDITOR_ATTRS.forEach((a) => n.removeAttribute(a));
    return clone;
  }
  function serialize() {
    if (state.editing) stopEdit(true);
    const r = root();
    if (!r) return state.html;
    const clone = cleanClone(r);
    for (const n of clone.querySelectorAll("[data-cms-c]")) { n.innerHTML = state.comps.get(n.getAttribute("data-cms-c")) ?? ""; n.removeAttribute("data-cms-c"); }
    return clone.innerHTML.replace(/<cms-keep data-k="(\d+)"[^>]*>[^]*?<\/cms-keep>/g, (m, k) => state.kept.get(k) ?? "");
  }
  function flush() { if (state.mode === "visual" && state.dirtyVisual) { state.html = trimDoc(serialize()); state.dirtyVisual = false; } }

  /* ---- Undo / redo (snapshots of the frame content, placeholders included) ---- */
  const snapshot = () => cleanClone(root()).innerHTML;
  function pushUndo(before) {
    state.undo.push(before ?? snapshot());
    if (state.undo.length > 100) state.undo.shift();
    state.redo = [];
    syncUndo();
  }
  function restore(snap) { root().innerHTML = snap; select(null); state.dirtyVisual = true; afterContentChange(); }
  function undo() { if (state.editing) stopEdit(true); if (!state.undo.length) return; state.redo.push(snapshot()); restore(state.undo.pop()); syncUndo(); }
  function redo() { if (!state.redo.length) return; state.undo.push(snapshot()); restore(state.redo.pop()); syncUndo(); }
  function syncUndo() { undoBtn.disabled = !state.undo.length || state.mode !== "visual"; redoBtn.disabled = !state.redo.length || state.mode !== "visual"; }
  function mutate(fn) { if (state.editing) stopEdit(true); pushUndo(); fn(); state.dirtyVisual = true; afterContentChange(); renderPanel(); }
  function afterContentChange() { onChange(); scheduleReport(); }

  /* ---- Details values in the page ---- */
  function applyToDom(v) {
    const r = root();
    if (!r) return;
    for (const n of r.querySelectorAll("[data-cms-bind]")) {
      const key = n.getAttribute("data-cms-bind");
      if (!(key in v.text) || n === state.editing || n.contains(state.editing)) continue;
      const text = String(v.text[key] ?? "").trim(), empty = n.getAttribute("data-cms-empty");
      if (text) { if (n.textContent !== text || n.children.length) n.textContent = text; }
      else if (empty) { const want = `<span class="tbc">${esc(empty)}</span>`; if (n.innerHTML !== want) n.innerHTML = want; }
      else if (n.textContent) n.textContent = "";
    }
    for (const n of r.querySelectorAll("[data-cms-href]")) {
      const key = n.getAttribute("data-cms-href");
      if (key in v.links && n.getAttribute("href") !== (v.links[key] || "#")) n.setAttribute("href", v.links[key] || "#");
    }
    for (const n of r.querySelectorAll("[data-cms-c]")) n.innerHTML = renderComponent(n.getAttribute("data-cms-component"));
  }
  // Called when Details change: writes the values into the source and the visual frame.
  function refreshBindings() {
    const v = values();
    state.html = applyBindings(state.html, v);
    if (state.mode === "visual") { applyToDom(v); if (!state.sel?.isConnected) select(null); else renderPanel(); }
    else if (document.activeElement !== area && document.activeElement !== cssArea) { const top = area.scrollTop; fillCode(); area.scrollTop = top; rememberBound(); }
  }

  /* ---- Selecting ---- */
  function pick(node) {
    let n = node?.nodeType === 1 ? node : node?.parentElement;
    const r = root();
    if (!n || !r || n === r || !r.contains(n)) return null;
    const keep = n.closest("cms-keep");
    if (keep) return keep;
    const comp = n.closest("[data-cms-c]");
    if (comp && r.contains(comp)) return comp;
    const svg = n.closest("svg");
    if (svg && r.contains(svg)) n = svg;
    return n;
  }
  function select(n) {
    const d = doc();
    d?.querySelectorAll("[data-cms-sel]").forEach((x) => x.removeAttribute("data-cms-sel"));
    state.sel = n;
    if (n) n.setAttribute("data-cms-sel", "");
    renderPanel();
  }
  function kindOf(n) {
    const t = n.tagName.toLowerCase();
    const bind = n.getAttribute("data-cms-bind");
    if (bind) {
      const b = BINDINGS[bind] || { label: bind };
      return b.twoWay ? { kind: "bound2", label: `${/^h[1-6]$/.test(t) ? "Heading" : "Text"} · ${b.label} from Details`, text: true, bind, b } : { kind: "bound", label: `${b.label} · from Details`, bind, b };
    }
    if (n.hasAttribute("data-cms-c")) { const name = n.getAttribute("data-cms-component"); return { kind: "component", label: COMPONENTS[name]?.label || "Generated content", name }; }
    if (/^h[1-6]$/.test(t)) return { kind: "heading", label: `Heading (level ${t[1]})`, text: true };
    if (t === "a") return { kind: "link", label: /\b(btn|button|cta)\b/i.test(n.className) || n.getAttribute("role") === "button" ? "Button" : "Link", text: true, link: true, hrefBind: n.getAttribute("data-cms-href") };
    if (t === "button") return { kind: "button", label: "Button (no link)", text: true };
    if (t === "img") return { kind: "image", label: "Image" };
    if (t === "svg") return { kind: "icon", label: "Icon (SVG)" };
    if (t === "iframe") return { kind: "embed", label: "Embedded video or form" };
    if (t === "video") return { kind: "video", label: "Video" };
    if (t === "cms-keep") return { kind: "kept", label: "Kept code" };
    if (TEXT_TAGS[t]) return { kind: "text", label: TEXT_TAGS[t], text: true };
    if (t === "ul" || t === "ol" || t === "dl") return { kind: "list", label: t === "ol" ? "Numbered list" : "List" };
    if (["table", "thead", "tbody", "tfoot", "tr"].includes(t)) return { kind: "table", label: t === "tr" ? "Table row" : "Table" };
    if (n.classList.contains("fw-card")) return { kind: "section", label: "Card" };
    if (n.classList.contains("fw-grid")) return { kind: "section", label: "Card grid" };
    if (n.classList.contains("fw-video")) return { kind: "section", label: "Video block" };
    if (SECTION_TAGS[t]) return { kind: "section", label: SECTION_TAGS[t] };
    const onlyText = [...n.childNodes].every((x) => x.nodeType === 3 || (x.nodeType === 1 && ["B", "STRONG", "EM", "I", "A", "SPAN", "BR", "SMALL"].includes(x.tagName)));
    return { kind: "container", label: "Container", text: onlyText && n.textContent.trim().length > 0 && !n.querySelector("[data-cms-bind]") };
  }
  const describe = (n) => n.tagName.toLowerCase() + (n.id ? `#${n.id}` : "") + (n.classList.length ? "." + [...n.classList].slice(0, 2).join(".") : "");

  /* ---- Inline text editing ---- */
  function startEdit(n) {
    if (state.editing === n) return;
    if (state.editing) stopEdit(true);
    state.editBefore = snapshot();
    state.editStart = n.innerHTML;
    state.editing = n;
    n.setAttribute("contenteditable", "true");
    n.setAttribute("data-cms-editing", "");
    n.focus();
    const range = doc().createRange();
    range.selectNodeContents(n);
    range.collapse(false);
    const s = doc().getSelection(); s.removeAllRanges(); s.addRange(range);
    renderPanel();
  }
  function stopEdit(commit) {
    const n = state.editing;
    if (!n) return;
    state.editing = null;
    if (!commit) n.innerHTML = state.editStart;
    n.removeAttribute("contenteditable");
    n.removeAttribute("data-cms-editing");
    if (commit && n.innerHTML !== state.editStart) {
      pushUndo(state.editBefore); state.dirtyVisual = true;
      // The page's title or summary changed: Details follow.
      const bound = [n.closest("[data-cms-bind]"), ...n.querySelectorAll("[data-cms-bind]")].filter(Boolean);
      for (const b of bound) { const key = b.getAttribute("data-cms-bind"); if (BINDINGS[key]?.twoWay) onBoundEdit(key, b.textContent.replace(/\s+/g, " ").trim()); }
      applyToDom(values()); // other copies of the same value, and read-only values typed over
      afterContentChange();
    }
    renderPanel();
  }
  function insertText(text) {
    const s = doc().getSelection();
    if (!s.rangeCount) return;
    const r = s.getRangeAt(0);
    r.deleteContents();
    const node = doc().createTextNode(text);
    r.insertNode(node);
    r.setStartAfter(node); r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
  }

  /* ---- Frame events ---- */
  function wire() {
    const d = doc();
    if (!d) return;
    d.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (state.editing && state.editing.contains(ev.target)) return;
      if (state.editing) stopEdit(true);
      select(pick(ev.target));
    }, true);
    d.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      const n = pick(ev.target);
      if (n && kindOf(n).text) { select(n); startEdit(n); }
    }, true);
    d.addEventListener("submit", (ev) => ev.preventDefault(), true);
    d.addEventListener("mouseover", (ev) => { const n = pick(ev.target); d.querySelectorAll("[data-cms-hover]").forEach((x) => x !== n && x.removeAttribute("data-cms-hover")); if (n && !state.editing) n.setAttribute("data-cms-hover", ""); });
    d.addEventListener("mouseleave", () => d.querySelectorAll("[data-cms-hover]").forEach((x) => x.removeAttribute("data-cms-hover")));
    d.addEventListener("paste", (ev) => { if (!state.editing) return; ev.preventDefault(); insertText(ev.clipboardData.getData("text/plain")); });
    d.addEventListener("drop", (ev) => ev.preventDefault());
    d.addEventListener("keydown", (ev) => {
      if (state.editing) {
        if (ev.key === "Escape") { ev.preventDefault(); stopEdit(false); }
        else if (ev.key === "Enter" && ev.shiftKey) { ev.preventDefault(); const br = d.createElement("br"); const s = d.getSelection(); const r = s.getRangeAt(0); r.deleteContents(); r.insertNode(br); r.setStartAfter(br); r.collapse(true); s.removeAllRanges(); s.addRange(r); }
        else if (ev.key === "Enter") { ev.preventDefault(); stopEdit(true); }
        return;
      }
      keys(ev);
    });
  }
  function keys(ev) {
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && ev.key.toLowerCase() === "z" && !ev.shiftKey) { ev.preventDefault(); undo(); }
    else if (mod && (ev.key.toLowerCase() === "y" || (ev.key.toLowerCase() === "z" && ev.shiftKey))) { ev.preventDefault(); redo(); }
    else if ((ev.key === "Delete" || ev.key === "Backspace") && state.sel) { ev.preventDefault(); removeSelected(); }
    else if (ev.key === "Enter" && state.sel && kindOf(state.sel).text) { ev.preventDefault(); startEdit(state.sel); }
    else if (ev.key === "Escape" && state.sel) select(null);
  }

  /* ---- Element operations ---- */
  function removeSelected() {
    const n = state.sel;
    if (!n) return;
    const next = n.nextElementSibling || n.previousElementSibling || n.parentElement;
    mutate(() => { n.remove(); });
    select(next && root().contains(next) && next !== root() ? next : null);
  }
  function duplicate() {
    const n = state.sel;
    mutate(() => {
      const copy = n.cloneNode(true);
      EDITOR_ATTRS.forEach((a) => copy.removeAttribute(a));
      copy.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id")); copy.removeAttribute("id");
      const rekey = (x) => { const k = `${x.getAttribute("data-cms-c")}-${Math.random().toString(36).slice(2, 7)}`; state.comps.set(k, state.comps.get(x.getAttribute("data-cms-c")) ?? ""); x.setAttribute("data-cms-c", k); };
      if (copy.hasAttribute("data-cms-c")) rekey(copy);
      copy.querySelectorAll("[data-cms-c]").forEach(rekey);
      for (const x of [copy, ...copy.querySelectorAll("cms-keep")].filter((y) => y.tagName === "CMS-KEEP")) { const k = `${x.dataset.k}-${Math.random().toString(36).slice(2, 7)}`; state.kept.set(k, state.kept.get(x.dataset.k)); x.setAttribute("data-k", k); }
      n.after(copy);
    });
  }
  function move(dir) {
    const n = state.sel;
    const sib = dir < 0 ? n.previousElementSibling : n.nextElementSibling;
    if (!sib) return;
    mutate(() => (dir < 0 ? sib.before(n) : sib.after(n)));
  }
  const INLINE_OR_ITEM = /^(LI|DT|DD|TD|TH|TR|THEAD|TBODY|SPAN|A|STRONG|EM|B|I|SMALL|SUMMARY|IMG|FIGCAPTION|CITE|TIME|LABEL|BR|SVG|CMS-KEEP)$/i;
  function insertionPoint(key) {
    const s = state.sel && root()?.contains(state.sel) ? state.sel : null;
    if (!s) return null;
    if (key === "faq") return s.closest("details") || climb(s);
    if (key === "card") return s.closest(".fw-card, .callout") || climb(s);
    if (key === "section" || key === "navbar" || key === "footer" || key === "cta") { let x = s; while (x.parentElement && x.parentElement !== root()) x = x.parentElement; return x; }
    return climb(s);
  }
  function climb(n) {
    while (n.parentElement && n.parentElement !== root() && (INLINE_OR_ITEM.test(n.tagName) || /^(UL|OL|DL|TABLE|P|H[1-6])$/.test(n.parentElement.tagName))) n = n.parentElement;
    return n;
  }
  function insertSnippet(key) {
    if (!root()) return;
    const tpl = doc().createElement("template");
    tpl.innerHTML = SNIPPETS[key].html.trim();
    const node = doc().importNode(tpl.content.firstElementChild, true);
    const at = insertionPoint(key);
    mutate(() => {
      if (key === "navbar" && !at) root().prepend(node);
      else if (at) at.after(node);
      else (root().querySelector(".article__body") || root()).append(node);
    });
    select(node);
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    toast(`${SNIPPETS[key].label} added${at ? " after the selected element" : ""}. Double-click its text to edit it.`, "ok", 3500);
  }
  // The visible label of a link/button: its first non-hidden text, keeping icons and spans.
  function labelNode(n) {
    const walker = doc().createTreeWalker(n, NodeFilter.SHOW_TEXT, { acceptNode: (x) => (x.nodeValue.trim() && !x.parentElement.closest("[aria-hidden='true'], .sr-only") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    return walker.nextNode();
  }
  function setLabel(n, text) {
    const x = labelNode(n);
    if (x) { const lead = x.nodeValue.match(/^\s*/)[0], trail = x.nodeValue.match(/\s*$/)[0]; x.nodeValue = lead + text + trail; }
    else n.prepend(doc().createTextNode(text));
  }
  function setClassChoice(n, choices, chosen) { choices.forEach((c) => c && c.split(" ").forEach((x) => n.classList.remove(x))); if (chosen) chosen.split(" ").forEach((x) => n.classList.add(x)); }

  /* ---- Properties panel ---- */
  function field(label, input, help) {
    const id = `he-${Math.random().toString(36).slice(2, 8)}`;
    (input.matches?.("input, textarea") ? input : input.querySelector?.("button, input"))?.setAttribute("id", id);
    const err = h("p", { class: "error", hidden: true });
    return { wrap: h("div", { class: "field" }, h("label", { for: id }, label), input, help ? h("p", { class: "help" }, help) : null, err), err };
  }
  function textField(label, value, apply, { help, validate } = {}) {
    const input = h("input", { class: "input", type: "text", value: value || "", spellcheck: "false" });
    const f = field(label, input, help);
    input.addEventListener("change", () => {
      const v = input.value.trim();
      const problem = v && validate ? validate(v) : null;
      f.err.hidden = !problem; f.err.textContent = problem || "";
      input.setAttribute("aria-invalid", problem ? "true" : "false");
      if (!problem) apply(v);
    });
    return f.wrap;
  }
  const urlField = (label, value, apply, opts = {}) => textField(label, value, (v) => mutate(() => apply(v)), { validate: checkUrl, ...opts });
  function choice(label, options, value, apply) {
    const s = selectBox({ options, value, onChange: (v) => mutate(() => apply(v)) });
    return field(label, s.el).wrap;
  }
  function detailsField(label, key, help, { image = false } = {}) {
    const r = record();
    return textField(label, r[key], (v) => { onSetDetail(key, v); refreshBindings(); }, { help, validate: image ? (v) => checkUrl(v) || (/^(https?:|\/)/i.test(v) ? null : "Use an image address.") : null });
  }

  function renderPanel() {
    const n = state.sel;
    if (readOnly) { clear(panel, h("p", { class: "hint" }, "Read-only. You can view this content but not change it.")); return; }
    if (!n || !n.isConnected) {
      clear(panel,
        h("p", { class: "kind" }, card ? "Card template" : "Visual editor"),
        h("h3", {}, "Select something to edit"),
        !state.html.trim() && starter ? h("div", { class: "alert alert--info", style: "margin:10px 0" }, h("div", {}, h("p", {}, "This page is empty."), h("button", { type: "button", class: "btn btn--pink btn--sm", onclick: () => useStarter() }, "Start from the template"))) : null,
        h("ul", { class: "hint" },
          h("li", {}, "Click to select, double-click to type."),
          h("li", {}, h("span", { class: "legend-dot" }), "Dotted blue = from Details."),
          h("li", {}, "Ctrl+Z undoes.")),
        state.dirtyVisual ? h("p", { class: "small" }, "You have unsaved changes in the page.") : null);
      return;
    }
    const k = kindOf(n);
    const crumbs = [];
    for (let x = n; x && x !== root(); x = x.parentElement) crumbs.unshift(x);
    const parts = [
      h("p", { class: `kind${k.kind.startsWith("bound") || k.kind === "component" ? " kind--details" : ""}` }, k.label),
      h("div", { class: "crumbs", "aria-label": "Position in the page" }, crumbs.map((x) => h("button", { type: "button", title: "Select this element", onclick: () => select(x) }, describe(x)))),
    ];
    if (state.editing === n) parts.push(h("div", { class: "alert alert--warn" }, h("div", {}, h("p", {}, h("strong", {}, "Typing in the page. "), "Enter to finish, Esc to cancel."))));
    else if (k.text) parts.push(h("button", { type: "button", class: "btn btn--pink btn--sm", onclick: () => startEdit(n) }, "Edit text in place"));

    if (k.kind === "bound2" || k.kind === "bound") parts.push(goTo(k.b.field));
    if (k.kind === "component") {
      if (k.name === "featured-image") {
        const urlKey = collection === "resources" ? "cover_image_url" : "featured_image_url", altKey = collection === "resources" ? "cover_image_alt" : "featured_image_alt";
        parts.push(detailsField("Featured image URL (Details)", urlKey, "Changes Details → Featured image.", { image: true }), detailsField("Description (alt text)", altKey, "What the image shows, for screen readers."));
      } else if (k.name === "portrait") parts.push(detailsField("Photo URL (Details)", "featured_image_url", "Only with the person’s permission.", { image: true }), detailsField("Description (alt text)", "featured_image_alt"));
      else if (k.name === "status-badge") parts.push(goTo(collection === "events" ? "event_status" : "enrollment_status"));
      else if (k.name === "event-facts" || k.name === "event-actions") parts.push(goTo(k.name === "event-facts" ? "event_date" : "cta_type"));
      else if (k.name === "article-meta") parts.push(goTo("authors"));
    }
    if (k.kind === "link" || k.kind === "button") {
      const label = h("input", { class: "input", type: "text", value: labelNode(n)?.nodeValue.trim() || "" });
      const f = field("Label", label);
      label.addEventListener("change", () => { const v = label.value.trim(); if (v) mutate(() => setLabel(n, v)); });
      parts.push(h("div", { style: "margin-top:14px" }, f.wrap));
    }
    if (k.kind === "link") {
      if (k.hrefBind) parts.push(goTo(LINKS[k.hrefBind]?.field));
      else parts.push(urlField("Destination (URL)", n.getAttribute("href"), (v) => n.setAttribute("href", v), { help: "https://…, a site path like /learn/, or #section." }));
      const blank = h("input", { type: "checkbox", checked: n.getAttribute("target") === "_blank" });
      blank.addEventListener("change", () => mutate(() => {
        if (blank.checked) { n.setAttribute("target", "_blank"); const rel = new Set((n.getAttribute("rel") || "").split(/\s+/).filter(Boolean)); rel.add("noopener"); n.setAttribute("rel", [...rel].join(" ")); }
        else n.removeAttribute("target");
      }));
      parts.push(h("label", { class: "check small" }, blank, "Open in a new tab"));
      if (n.classList.contains("btn")) parts.push(choice("Button style", [{ value: "", label: "Charcoal" }, { value: "btn--light", label: "Outline" }, { value: "btn--yellow", label: "AI Yellow" }],
        n.classList.contains("btn--light") ? "btn--light" : n.classList.contains("btn--yellow") ? "btn--yellow" : "", (v) => setClassChoice(n, ["btn--light", "btn--yellow"], v)));
    }
    if (k.kind === "image") {
      parts.push(urlField("Image URL", n.getAttribute("src"), (v) => {
        n.setAttribute("src", v);
        n.removeAttribute("srcset"); n.removeAttribute("sizes"); n.removeAttribute("width"); n.removeAttribute("height");
        if (n.parentElement?.tagName === "PICTURE") n.parentElement.querySelectorAll("source").forEach((s) => s.remove());
        n.addEventListener("load", () => { if (n.naturalWidth) { n.setAttribute("width", n.naturalWidth); n.setAttribute("height", n.naturalHeight); } }, { once: true });
      }, { help: "Changing it replaces the responsive versions of the old image.", validate: (v) => checkUrl(v) || (/^(https?:|\/|[a-z0-9])/i.test(v) ? null : "Use an image address.") }));
      const alt = h("input", { class: "input", type: "text", value: n.getAttribute("alt") || "" });
      const f = field("Description (alt text)", alt, "What the image shows, for people using screen readers. Leave empty only for decorative images.");
      alt.addEventListener("change", () => mutate(() => n.setAttribute("alt", alt.value.trim())));
      parts.push(f.wrap);
    }
    const video = n.closest(".fw-video");
    if (video) {
      const current = video.querySelector("iframe")?.getAttribute("src") || "";
      parts.push(textField("Video address (YouTube or Vimeo)", current, (v) => {
        const embed = toEmbed(v);
        mutate(() => {
          if (!embed) { video.querySelector("iframe")?.remove(); if (!video.querySelector(".fw-video__empty")) { const ph = doc().createElement("div"); ph.className = "fw-video__empty"; ph.textContent = "Video placeholder · add a YouTube or Vimeo address in the editor"; video.prepend(ph); } return; }
          video.querySelector(".fw-video__empty")?.remove();
          let f = video.querySelector("iframe");
          if (!f) { f = doc().createElement("iframe"); video.prepend(f); }
          f.setAttribute("src", embed); f.setAttribute("title", f.getAttribute("title") || "Video"); f.setAttribute("loading", "lazy");
          f.setAttribute("allow", "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"); f.setAttribute("allowfullscreen", ""); f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        });
      }, {
        help: "Paste the video’s page address, e.g. https://www.youtube.com/watch?v=… Leave empty to show the placeholder. Videos do not play inside the editor; use Preview.",
        validate: (v) => { const em = toEmbed(v); if (!em) return "Use a YouTube or Vimeo video address."; return (config.iframeHosts || []).includes(new URL(em).hostname) ? null : "This video site is not on the allowed list for embeds."; },
      }));
    }
    if (k.kind === "embed") {
      parts.push(urlField("Embed address", n.getAttribute("src"), (v) => n.setAttribute("src", v), {
        help: `Allowed sites: ${(config.iframeHosts || []).join(", ")}`,
        validate: (v) => { try { const u = new URL(v); return u.protocol === "https:" && (config.iframeHosts || []).includes(u.hostname) ? null : "This site is not on the allowed list for embeds."; } catch { return "Enter a full https:// address."; } },
      }));
    }
    if (n.tagName === "SECTION") parts.push(choice("Background", [{ value: "", label: "None (white)" }, { value: "band band--stone", label: "Stone band" }, { value: "band band--pink", label: "Light pink band" }],
      n.classList.contains("band--pink") ? "band band--pink" : n.classList.contains("band--stone") ? "band band--stone" : "", (v) => setClassChoice(n, ["band band--stone", "band--pink"], v)));
    if (n.classList.contains("fw-grid")) parts.push(choice("Cards per row (wide screens)", [2, 3, 4].map((c) => ({ value: `fw-grid--${c}`, label: String(c) })),
      ["fw-grid--2", "fw-grid--3", "fw-grid--4"].find((c) => n.classList.contains(c)) || "fw-grid--3", (v) => setClassChoice(n, ["fw-grid--2", "fw-grid--3", "fw-grid--4"], v)));
    if (n.classList.contains("fw-card")) parts.push(choice("Card colour", [{ value: "", label: "Stone" }, { value: "fw-card--pink", label: "Light pink" }, { value: "fw-card--yellow", label: "Light yellow" }, { value: "fw-card--white", label: "White" }, { value: "fw-card--ink", label: "Charcoal" }],
      ["fw-card--pink", "fw-card--yellow", "fw-card--white", "fw-card--ink"].find((c) => n.classList.contains(c)) || "", (v) => setClassChoice(n, ["fw-card--pink", "fw-card--yellow", "fw-card--white", "fw-card--ink"], v)));
    if (k.kind === "kept") parts.push(h("p", { class: "hint", style: "margin-top:12px" }, "Kept as written; not run here. Edit in HTML."));
    const first = !n.previousElementSibling, last = !n.nextElementSibling;
    parts.push(h("div", { class: "he-actions" },
      h("button", { type: "button", class: "btn btn--light btn--sm", onclick: () => move(-1), disabled: first }, icon("up"), "Move up"),
      h("button", { type: "button", class: "btn btn--light btn--sm", onclick: () => move(1), disabled: last }, icon("down"), "Move down"),
      h("button", { type: "button", class: "btn btn--light btn--sm", onclick: () => duplicate() }, icon("copy"), "Duplicate"),
      h("button", { type: "button", class: "btn btn--light btn--sm", onclick: () => { const p = n.parentElement; if (p && p !== root()) select(p); }, disabled: n.parentElement === root() }, icon("parent"), "Select parent"),
      h("button", { type: "button", class: "btn btn--danger btn--sm", style: "grid-column:1 / -1", onclick: () => removeSelected() }, icon("trash"), "Delete this element")));
    clear(panel, parts);
  }
  const goTo = (fieldKey) => (fieldKey ? h("button", { type: "button", class: "btn btn--light btn--sm", style: "margin-top:10px", onclick: () => onGoToField(fieldKey) }, "Edit in Details", icon("right")) : null);

  /* ---- Modes, layout, templates ---- */
  function setMode(mode) {
    if (mode === state.mode) return;
    if (mode === "html") {
      flush();
      fillCode(); rememberBound();
      visual.hidden = true; code.hidden = false;
    } else {
      clearTimeout(typingTimer); readArea();
      state.undo = []; state.redo = [];
      visual.hidden = false; code.hidden = true;
      renderFrame();
    }
    state.mode = mode;
    renderNote();
    modeBtns.visual.setAttribute("aria-pressed", String(mode === "visual"));
    modeBtns.html.setAttribute("aria-pressed", String(mode === "html"));
    syncUndo();
    updateReport();
  }
  function setDevice(dev) {
    state.device = dev;
    canvas.classList.toggle("is-mobile", dev === "mobile");
    devBtns.desktop.setAttribute("aria-pressed", String(dev === "desktop"));
    devBtns.mobile.setAttribute("aria-pressed", String(dev === "mobile"));
    if (state.mode === "html") setMode("visual");
  }
  function setLayout(l) {
    state.layout = l;
    onChange();
    if (state.mode === "visual") { flush(); renderFrame(); } else { fillCode(); }
    toast(l === "site" ? "The page uses the global navbar and footer." : "Custom page layout: the page is shown without the global navbar and footer. Add your own (Insert → Custom navbar / Custom footer).", "info", 6000);
  }
  function load({ html: nh, css: nc }) {
    state.html = trimDoc(applyBindings(nh, values())); state.css = trimDoc(nc); state.dirtyVisual = false; state.undo = []; state.redo = [];
    if (state.mode === "visual") renderFrame(); else { fillCode(); rememberBound(); }
    syncUndo(); updateReport(); onChange();
  }
  function useStarter() { if (starter) load(starter()); }
  async function resetToStarter() {
    const r = await dialog({ title: card ? "Reset to the standard card?" : "Start over from the template?", danger: true, confirm: "Replace the page",
      body: "The current page content and page styles are replaced by the template. Until you save, you can still leave without saving; after saving, earlier versions stay in History." });
    if (r.ok) { useStarter(); toast("Template loaded. Save the draft to keep it.", "ok"); }
  }

  /* ---- Safety report (what publishing will remove) ---- */
  let reportTimer;
  const scheduleReport = () => { clearTimeout(reportTimer); reportTimer = setTimeout(updateReport, 400); };
  function updateReport() {
    const src = state.mode === "visual" && state.dirtyVisual ? serialize() : state.html;
    const items = describeReport(sanitizeHtml(src, { iframeHosts: config.iframeHosts }).report);
    const cssIssues = sanitizeCss(state.css).removed;
    const all = [...items, ...cssIssues.map((x) => `Styles: removed ${x}`)];
    clear(report, all.length
      ? h("div", { class: "alert alert--warn", style: "margin:0" }, h("div", {}, h("p", {}, h("strong", {}, "Removed when published (unsafe):")), h("ul", {}, all.map((x) => h("li", {}, x)))))
      : h("p", { class: "small muted", style: "margin:0" }, "Safety check: OK."));
  }

  /* ---- Importing a complete page from elsewhere ---- */
  function splitPage(full) {
    const d = new DOMParser().parseFromString(full, "text/html");
    const styles = [...d.querySelectorAll("style")].map((s) => s.textContent.trim()).filter(Boolean);
    const imports = [...d.querySelectorAll('link[rel~="stylesheet"][href]')].map((l) => l.getAttribute("href")).filter((u) => /^https:\/\//i.test(u)).map((u) => `@import url("${u.replace(/"/g, "")}");`);
    const skipped = d.head.querySelectorAll("script").length;
    d.querySelectorAll("style").forEach((s) => s.remove());
    return { html: d.body.innerHTML.trim(), css: [...imports, ...styles].join("\n\n"), title: d.title?.trim() || "", description: d.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "", skipped };
  }
  async function importPage() {
    const ta = h("textarea", { class: "input mono", rows: 12, placeholder: "<!doctype html><html>…</html>", spellcheck: "false" });
    const r = await dialog({ title: "Import a complete page", body: "Paste the full HTML of a page built elsewhere. Its styles become this page’s styles, its body becomes the page content, and its title and description are offered for Search and sharing. This replaces the current page content.", content: h("div", { class: "field" }, ta), confirm: "Import", wide: true });
    if (!r.ok || !ta.value.trim()) return;
    const p = splitPage(ta.value);
    load({ html: p.html, css: p.css });
    onImportMeta({ title: p.title, description: p.description });
    toast(`Page imported.${p.skipped ? ` ${p.skipped} script(s) in its head were not imported.` : ""} Use “Use global navbar and footer” off if it has its own header and footer.`, "ok", 7000);
  }

  // Ctrl+Z / Ctrl+Y while focus is on the editor's toolbar (outside the frame)
  el.addEventListener("keydown", (ev) => { if (state.mode === "visual" && !readOnly && ev.target.closest(".he-bar")) keys(ev); });

  renderFrame();
  updateReport();

  return {
    el,
    getValue() {
      if (state.mode === "html") { state.html = parseDoc(area.value).html; state.css = cssArea.value; } // the pending readArea still syncs Details
      else flush();
      return { html: state.html, css: state.css, layout: state.layout };
    },
    // Current body HTML without side effects (never interrupts in-place typing)
    peekHtml: () => (state.mode === "html" ? parseDoc(area.value).html : state.dirtyVisual && !state.editing ? serialize() : state.html),
    setValue: load,
    hasVisualChanges: () => state.dirtyVisual,
    refreshBindings,
    show() { if (state.mode === "html" && document.activeElement !== area && document.activeElement !== cssArea) { fillCode(); rememberBound(); } },
  };
}
