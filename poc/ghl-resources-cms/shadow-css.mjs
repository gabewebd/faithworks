// Moving css/style.css into a shadow root: the page's html/:root become the shadow host and body
// becomes the .fw-root wrapper. Used by build.mjs (text, at build time) and, through prepare.mjs,
// by the live embed (the browser's parsed stylesheet). The reader is the one in
// cms/shared/sanitize-css.mjs: strings, comments and brackets are skipped.
export function readUntil(src, i, stops) {
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
export function matchBrace(src, i) {
  for (let depth = 1; i < src.length;) {
    const j = readUntil(src, i, "{}");
    if (j >= src.length) return src.length;
    depth += src[j] === "{" ? 1 : -1;
    if (depth === 0) return j;
    i = j + 1;
  }
  return src.length;
}
export const splitSelectors = (p) => { const out = []; for (let i = 0; i <= p.length;) { const j = readUntil(p, i, ","); out.push(p.slice(i, j)); i = j + 1; } return out; };

// One selector → its shadow-root form, or null when it can never match inside the embed.
export function mapSelector(sel) {
  const s = sel.trim();
  if (/^body\[data-page/.test(s)) return null; // other pages' variants
  const m = s.match(/^(?:html|:root)(?:\s*>\s*|\s+)body\b|^body\b|^(?:html|:root)\b/);
  if (!m) return s;
  const rest = s.slice(m[0].length);
  if (/^[.:[#]/.test(rest)) return null; // html.motion…, :root:has(…): document states the embed never has
  return (/body$/.test(m[0]) ? ".fw-root" : ":host") + rest;
}
// A whole selector list; null when none of it can match.
export function mapSelectorList(list) {
  const out = splitSelectors(list).map(mapSelector).filter(Boolean);
  return out.length ? out.join(", ") : null;
}

// Rules the embed adds: GHL's inherited styles (font, colour, line height…) stop at the host, and
// in-page links land below the sticky header (the site does this with html scroll-padding).
export const HOST_CSS = ":host{all:initial;display:block}";
export const EXTRA_CSS = `.fw-main [id]{scroll-margin-top:calc(var(--header-h) + 16px)}
[hidden]{display:none!important}
/* Live embed, while the CMS answers: wireframes of the cards (or the article), shimmering in Faith Pink */
.fw-skel .fw-skel__bar,.fw-skel .fw-skel__img{display:block;background:linear-gradient(100deg,rgb(239 172 186/.14) 30%,rgb(239 172 186/.42) 50%,rgb(239 172 186/.14) 70%) #fff;background-size:300% 100%;animation:fw-skel 1.5s ease-in-out infinite}
.fw-skel .fw-skel__bar{height:12px;margin:0 0 12px;border-radius:6px}
.fw-skel .rcard{pointer-events:none}
.fw-skel .rcard:nth-child(2) .fw-skel__bar,.fw-skel .rcard:nth-child(2) .fw-skel__img{animation-delay:.12s}
.fw-skel .rcard:nth-child(3) .fw-skel__bar,.fw-skel .rcard:nth-child(3) .fw-skel__img{animation-delay:.24s}
.fw-skel .rcard:nth-child(4) .fw-skel__bar,.fw-skel .rcard:nth-child(4) .fw-skel__img{animation-delay:.36s}
.fw-skel__chips{display:flex;gap:8px;margin-bottom:16px}
.fw-skel .fw-skel__chip{width:64px;height:22px;margin:0;border-radius:999px}
.fw-skel .fw-skel__h{height:24px;margin-bottom:10px}
.fw-skel .fw-skel__search{width:min(100%,420px);height:50px;border-radius:999px}
.fw-skel__w20{width:20%}.fw-skel__w30{width:30%}.fw-skel__w50{width:50%}.fw-skel__w60{width:60%}.fw-skel__w70{width:70%}.fw-skel__w90{width:90%}
.fw-skel .fw-skel__title{height:clamp(36px,6vw,64px);margin-bottom:14px;border-radius:10px}
.fw-skel .fw-skel__cover{aspect-ratio:16/7;border-radius:var(--r-lg,20px)}
/* Resource cards: no white card, photo on top at 16/10 and the details below; three columns on
   desktop, two on tablets, one on phones. The featured (lead) card spans the row, photo left and
   details right, with a hairline under it, until phones stack it like the rest; on phones every
   card has hairlines between. Desktop and tablets: a hairline across the full grid width,
   centred in the gap between rows (the featured card's own line sits the same way) */
.rcards{--fw-rgap:clamp(40px,4vw,56px);--fw-cgap:clamp(20px,2.4vw,32px);grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--fw-rgap) var(--fw-cgap);border-top:0}
.rcards .rcard,.rcards .rcard--lead{display:flex;flex-direction:column;grid-column:auto;gap:18px;padding:0;overflow:visible;border:0;border-radius:0;background:none;box-shadow:none}
.rcards .rcard:hover{transform:none;box-shadow:none}
.rcards .rcard:focus-within{outline-offset:6px}
.rcards .rcard__media{border-radius:var(--r-lg)}
.rcards .rcard__img img,.rcards .rcard__img--blank{aspect-ratio:16/10;height:auto;min-height:0}
.rcards .rcard__body{flex:1;justify-content:flex-start;gap:8px;padding:0}
.rcards .rcard h3,.rcards .rcard--lead h3{font-size:clamp(19px,1.5vw,22px);line-height:1.22;letter-spacing:-0.025em}
.rcards .rcard__excerpt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* Lighter reading: the type pill and the meta share one line, and the meta and summary sit in
   softer Charcoal (translucent ink) at a smaller size, so each card reads title first */
.rcards .rcard__body{flex-direction:row;flex-wrap:wrap;align-content:flex-start;align-items:center;gap:10px 12px}
.rcards .rcard__body>:not(.rcard__badges):not(.rcard__meta){flex:0 0 100%;min-width:0}
.rcards .rcard__meta{font-size:13px;font-weight:500;color:rgb(26 26 26 / 0.66)}
.rcards .rcard__excerpt{font-size:15px;line-height:1.6;color:rgb(26 26 26 / 0.72)}
.rcards .rcard h3{margin-top:2px}
.rcards .rcard--lead{display:grid;grid-column:1/-1;grid-template-columns:minmax(0,6fr) minmax(0,6fr);align-items:center;gap:clamp(20px,3.4vw,56px);padding-bottom:calc(var(--fw-rgap) / 2);margin-bottom:calc(var(--fw-rgap) / -2);border-bottom:1px solid var(--line)}
.rcards .rcard--lead .rcard__body{align-content:center;justify-content:flex-start}
.rcards .rcard--lead h3{font-size:clamp(28px,3.2vw,46px);line-height:1.12;letter-spacing:-0.035em}
.rcards .rcard--lead .rcard__excerpt{-webkit-line-clamp:3;font-size:17px}
/* Row lines hang off the first card of every row after the first, counted among the visible
   non-featured cards only (paging, search and the type filter hide cards with [hidden]) */
.rcards .rcard:nth-child(3n+4 of .rcard:not([hidden]):not(.rcard--lead))::before{content:"";position:absolute;top:calc(var(--fw-rgap) / -2);left:0;width:calc(300% + 2 * var(--fw-cgap));border-top:1px solid var(--line);pointer-events:none}
@media (max-width:960px){
.rcards{grid-template-columns:repeat(2,minmax(0,1fr))}
.rcards .rcard:nth-child(3n+4 of .rcard:not([hidden]):not(.rcard--lead))::before{content:none}
.rcards .rcard:nth-child(2n+3 of .rcard:not([hidden]):not(.rcard--lead))::before{content:"";position:absolute;top:calc(var(--fw-rgap) / -2);left:0;width:calc(200% + var(--fw-cgap));border-top:1px solid var(--line);pointer-events:none}
}
@media (max-width:640px){
.rcards{grid-template-columns:minmax(0,1fr);gap:0;border-top:1px solid var(--line)}
.rcards .rcard,.rcards .rcard--lead{display:flex;gap:16px;padding-block:24px;margin-bottom:0;border-bottom:1px solid var(--line)}
.rcards .rcard:nth-child(n of .rcard:not([hidden]):not(.rcard--lead))::before{content:none}
.rcards .rcard h3,.rcards .rcard--lead h3{font-size:22px}
.rcards .rcard__meta{font-size:13px}
.rcards .rcard__excerpt{font-size:15px}
}
/* Resource pages (9 cards a page): page numbers as the type chips' pink-outlined pills, the current
   page filled Charcoal; Previous / Next as light grey outlined pills with arrow icons */
.rcards__pager{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 12px;margin-top:clamp(40px,5vw,64px)}
.rcards__pages{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;padding:0;list-style:none}
.rcards__page{min-width:40px;height:40px;padding:0 12px;border:1px solid var(--pink);border-radius:999px;background:transparent;font-family:inherit;font-size:14px;font-weight:600;line-height:1;color:var(--ink);cursor:pointer;transition:background-color var(--dur-fast,.15s)}
.rcards__page:hover{background:var(--pink-tint)}
.rcards__page[aria-current="page"]{border-color:var(--ink);background:var(--ink);color:var(--white);cursor:default}
.rcards__step{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 18px;border:1px solid var(--line);border-radius:999px;background:transparent;font-family:inherit;font-size:14px;font-weight:600;line-height:1;color:var(--ink);cursor:pointer;transition:background-color var(--dur-fast,.15s),border-color var(--dur-fast,.15s)}
.rcards__step:hover:not(:disabled){border-color:var(--pink);background:var(--pink-tint)}
.rcards__step:disabled{opacity:.4;cursor:default}
.rcards__arrow{flex:none;transition:transform var(--dur-fast,.15s)}
.rcards__step:hover:not(:disabled) .rcards__arrow{transform:translateX(2px)}
.rcards__step:first-child:hover:not(:disabled) .rcards__arrow{transform:translateX(-2px)}
.rcards__gap{min-width:20px;text-align:center;color:var(--ink)}
@media (max-width:640px){.rcards__pager{margin-top:32px}.rcards__step{padding:0 14px}}
/* Article contents: no rail or bar; the heading in view sits on a filled Faith Pink tint */
.toc__list{gap:2px;border-left:0}
.toc__link{margin-left:0;padding:8px 12px;border-left:0;border-radius:var(--r-sm);transition:color var(--dur-fast),background-color var(--dur) var(--ease-out)}
.toc__link:hover{background:rgb(247 229 230/.6)}
.toc__link.is-active{background:var(--pink-tint)}
@keyframes fw-skel{0%{background-position:100% 0}100%{background-position:0 0}}
@media (prefers-reduced-motion:reduce){.fw-skel .fw-skel__bar,.fw-skel .fw-skel__img{animation:none}}
/* Page hero: heading and lead rise in, as on the site (main.js .motion + .is-in → fw-rise). Scoped to the
   hero only: the site's global .motion mode would also gate cards and sections the embed shows at once.
   runtime.js keeps the hero element when the live content replaces the loading frame, so it plays once. */
@keyframes fw-hero-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:no-preference){
.phero__copy[data-reveal]>*{animation:fw-hero-rise 700ms var(--ease-out,cubic-bezier(.215,.61,.355,1)) both}
.phero__copy[data-reveal]>:nth-child(2){animation-delay:80ms}
.phero__copy[data-reveal]>:nth-child(3){animation-delay:160ms}
.phero__copy[data-reveal]>:nth-child(n+4){animation-delay:240ms}
}`;
