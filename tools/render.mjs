// Content renderers for tools/build.mjs. A page source calls one with {{name}} or {{name:arg}}.
// Content comes from the CMS (tools/content.mjs). Program, event, resource and testimonial pages
// are page documents (cms/shared/page-doc.mjs): this file fills in the values Details controls
// and the parts only the website can generate (forms, lists of other pages).
import { readFileSync } from "node:fs";
import { esc, cleanPath } from "./layout.mjs";
import {
  badge, tbc, extLink as ext, img, preview, eventCta, eventStatus, isPastEvent, eventEndsAt, programCtaLabel,
  applyBindings, bindingValues, fillComponents, recordComponent, tzAbbrev, findMarked, textOf,
} from "../cms/shared/page-doc.mjs";
import { FORMS, optionValue } from "../cms/shared/forms.mjs";
export { img, preview };
export { gallery } from "./gallery.mjs";
export { trustedBy } from "./trusted-by.mjs";
import { eventGallery as eventGalleryOf } from "./event-gallery.mjs";
import { imgTag, gallerySlot } from "./gallery.mjs";

let D;
export function init(data) { D = data; }

// {{eventGallery:home}} / {{eventGallery:all}}: CMS event images plus the archive (tools/event-gallery.mjs)
export const eventGallery = (scope) => eventGalleryOf(scope, D.events);

const today = new Date();

/* ---- Helpers ----------------------------------------------------------- */
// Calendar dates are formatted at noon UTC, so the day never shifts with a time zone.
function eventDate(e) {
  if (!e.date) return null;
  return new Date(`${e.date}T12:00:00Z`);
}
function fmt(d, opts) { return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", ...opts }).format(d); }
const isPast = (e) => isPastEvent(e.rec, today);

// Empty states. Every listing with nothing published shows the same panel the Workshops page
// uses for "No dates are confirmed": one plain sentence and one useful next step. Supporting
// sections (Keep reading, Other programs, past events, testimonials) are removed instead.
export function emptyState({ title, text, href, label, track }) {
  return `<div class="empty"><p><strong>${esc(title)}</strong> ${esc(text)}</p>${href ? `<a class="btn" href="${esc(href)}"${track ? ` data-track="${track}"` : ""}>${esc(label)} <span class="btn__arrow" aria-hidden="true">↗</span></a>` : ""}</div>`;
}
const noPrograms = () => emptyState({
  title: "No programs are open right now.", text: "New programs are announced here first. Until then, start with the free AI Workflow Starter Kit.",
  href: "/start-your-ai-journey/", label: "Start Your AI Journey", track: "starter_kit_click",
});

// A page document with its Details values and generated parts filled in. `site` adds the
// components that need other content (forms, lists); the rest come from the record itself.
function docBody(item, collection, site = {}) {
  const { doc } = item;
  let html = applyBindings(doc.html, bindingValues(collection, doc.rec), { removeEmptyLinks: true });
  html = fillComponents(html, (name) => {
    if (site[name]) return site[name]();
    const out = recordComponent(name, collection, doc.rec, { today });
    return out === undefined ? "" : out;
  });
  return `${doc.css ? `<style>${doc.css}</style>` : ""}<div class="cms-page ${doc.scope}">${html}</div>`;
}
// "Custom page layout" pages are rendered without the global header and footer.
const pageFrame = (item) => ({ chrome: item.doc.layout !== "custom" });

/* ---- Programs ---------------------------------------------------------- */
const ctaFor = (p) => programCtaLabel(p.rec);

// Home: the open-track programs, visual-first. Workforce leads as one wide featured card; the other
// two sit side by side below it. Each card has its own art direction, drawn here as inline SVG
// (aria-hidden: the picture repeats nothing the text doesn't say): Workforce on Faith Pink (example AI tool marks in its AI step), LinkedIn
// as one post-to-profile link on Works White (a LinkedIn badge and one example AI tool), Websites as layered wireframes on AI Yellow. `line` is the
// short homepage description; the full summary and deliverables stay on each program page.
const LIFT = (id, d = 14, o = 0.16, c = "#1A1A1A") => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="180%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${d}"/><feOffset dy="${d}" result="b1"/><feFlood flood-color="${c}" flood-opacity="${o}"/><feComposite in2="b1" operator="in" result="s1"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/><feOffset dy="1.5" result="b2"/><feFlood flood-color="#1A1A1A" flood-opacity="0.14"/><feComposite in2="b2" operator="in" result="s2"/>
      <feMerge><feMergeNode in="s1"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
// Brand marks inside the cover art, read from the same 24×24 files the pages use (one path each)
const MARK = (name, x, y, size, fill) => {
  const file = readFileSync(new URL(`../assets/icons/tools/${name}.svg`, import.meta.url), "utf8");
  const rule = /fill-rule="evenodd"/.test(file) ? ' fill-rule="evenodd"' : "";
  return `<path transform="translate(${x} ${y}) scale(${size / 24})" d="${file.match(/ d="([^"]+)"/)[1]}" fill="${fill}"${rule}/>`;
};
// LinkedIn's "in" mark in its brand blue; the AI marks use their real colours (Claude terracotta, the rest black)
const LINKEDIN = (x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 24})"><rect width="24" height="24" rx="4.5" fill="#0A66C2"/><path transform="translate(3.6 3.6) scale(0.7)" fill="#FFFFFF" d="M7 9H4v11h3V9Zm-1.5-5.2a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM10 9h2.9v1.5c.5-.9 1.6-1.7 3.1-1.7 2.8 0 4 1.8 4 5V20h-3v-5.6c0-1.6-.5-2.7-1.9-2.7-1.5 0-2.1 1.1-2.1 2.7V20h-3V9Z"/></g>`;
const SATIN = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FAF8F4"/></linearGradient>`;
const PROGRAM_COVER = {
  // A task picked from the pile, run through an AI step, checked into a finished output; the
  // checkpoint rail underneath names the three stages
  "ai-workforce-accelerator": {
    tone: "pink", feature: true, view: "0 0 640 420",
    line: "Turn everyday processes into practical AI workflows.",
    svg: `<defs>${LIFT("wf-lift")}${LIFT("wf-lift-s", 5, 0.2)}${SATIN("wf-satin")}
      <radialGradient id="wf-shine" cx="0.35" cy="0.3" r="0.7"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
      <linearGradient id="wf-hub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#333333"/><stop offset="0.4" stop-color="#1A1A1A"/></linearGradient></defs>
      <g class="art__float">
        <rect x="58" y="92" width="164" height="56" rx="10" fill="url(#wf-satin)" opacity="0.55" transform="rotate(-7 140 120)"/>
        <g transform="rotate(4 131 177)">
          <rect x="46" y="148" width="170" height="58" rx="10" fill="url(#wf-satin)" opacity="0.85" filter="url(#wf-lift-s)"/>
          <path d="M66 170 H150 M66 184 H120" stroke="#1A1A1A" stroke-opacity="0.18" stroke-width="3" stroke-linecap="round"/>
        </g>
        <rect x="56" y="272" width="160" height="54" rx="10" fill="url(#wf-satin)" opacity="0.62" transform="rotate(-3 136 299)"/>
        <g filter="url(#wf-lift)">
          <rect x="36" y="204" width="188" height="66" rx="12" fill="url(#wf-satin)"/>
          <rect x="36.5" y="204.5" width="187" height="65" rx="11.5" fill="none" stroke="#1A1A1A" stroke-opacity="0.08"/>
        </g>
        <rect x="54" y="226" width="22" height="22" rx="6" fill="#EFACBA"/>
        <path d="M90 230 H190" stroke="#1A1A1A" stroke-width="3.2" stroke-linecap="round"/><path d="M90 245 H150" stroke="#1A1A1A" stroke-opacity="0.3" stroke-width="3.2" stroke-linecap="round"/>
      </g>
      <path d="M224 237 C 258 237, 254 190, 288 190" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/>
      <circle cx="224" cy="237" r="4.5" fill="#1A1A1A"/>
      <g class="art__float art__float--b">
        <g filter="url(#wf-lift)"><rect x="288" y="96" width="148" height="188" rx="16" fill="url(#wf-hub)"/></g>
        <rect x="296" y="104" width="132" height="172" rx="10" fill="none" stroke="#FFFFFF" stroke-opacity="0.1"/>
        <path d="M304 96.8 H420" stroke="#FFFFFF" stroke-opacity="0.3" stroke-linecap="round"/>
        <circle cx="312" cy="122" r="2.6" fill="#FFFFFF" fill-opacity="0.4"/><circle cx="322" cy="122" r="2.6" fill="#FFFFFF" fill-opacity="0.2"/><circle cx="332" cy="122" r="2.6" fill="#FFFFFF" fill-opacity="0.2"/>
        <g fill="#FFFFFF"><rect x="318" y="136" width="40" height="40" rx="10"/><rect x="366" y="136" width="40" height="40" rx="10"/><rect x="318" y="182" width="40" height="40" rx="10"/><rect x="366" y="182" width="40" height="40" rx="10"/></g>
        ${MARK("notebooklm", 326, 144, 24, "#000000")}${MARK("chatgpt", 374, 144, 24, "#000000")}${MARK("grok", 326, 190, 24, "#000000")}${MARK("claude", 374, 190, 24, "#D97757")}
        <rect x="314" y="232" width="96" height="6" rx="3" fill="#FFFFFF" fill-opacity="0.14"/><rect x="314" y="232" width="64" height="6" rx="3" fill="#EFACBA"/>
        <path d="M314 254 H382" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="3" stroke-linecap="round"/>
      </g>
      <path d="M436 190 H478" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/><path d="M472 184 L480 190 L472 196" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <g class="art__float art__float--c">
        <g filter="url(#wf-lift)"><rect x="490" y="118" width="128" height="144" rx="12" fill="url(#wf-satin)"/></g>
        <path d="M506 140 H570" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/>
        <circle cx="554" cy="186" r="20" fill="#EFACBA"/><circle cx="554" cy="186" r="20" fill="url(#wf-shine)"/>
        <path d="M545 186.5 l6 6 l11.5 -12" fill="none" stroke="#1A1A1A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M506 226 H602 M506 242 H572" stroke="#1A1A1A" stroke-opacity="0.2" stroke-width="3" stroke-linecap="round"/>
      </g>
      <path d="M130 334 V352 M362 290 V352 M554 268 V352" stroke="#1A1A1A" stroke-opacity="0.35" stroke-dasharray="2 5" stroke-linecap="round"/>
      <path d="M60 366 H612" stroke="#1A1A1A" stroke-opacity="0.22" stroke-width="1.2"/>
      <path d="M130 366 H362" stroke="#1A1A1A" stroke-width="2.4" stroke-linecap="round"/>
      <g filter="url(#wf-lift-s)">
        <circle cx="130" cy="366" r="13" fill="#1A1A1A"/><circle cx="362" cy="366" r="13" fill="#1A1A1A"/>
        <circle cx="554" cy="366" r="13" fill="#EFACBA" stroke="#FAF8F4" stroke-width="3"/>
      </g>
      <circle cx="554" cy="366" r="13" fill="url(#wf-shine)"/>
      <path d="M124.5 366.5 l4 4 l7 -7.5 M356.5 366.5 l4 4 l7 -7.5" fill="none" stroke="#FAF8F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="554" cy="366" r="4" fill="#1A1A1A"/>
      <g class="art__label" text-anchor="middle"><text x="130" y="404">Map</text><text x="362" y="404">Design</text><text x="554" y="404">Prototype</text></g>`,
  },
  // One post reaching one person: a single content card joined by one Faith Pink line to a
  // profile, over a soft pink disc. Few shapes, one focal point, plenty of air.
  "ai-linkedin-b2b-growth": {
    tone: "white", view: "0 0 560 300",
    line: "Connect your positioning, content, and client follow-up.",
    svg: `<defs>${LIFT("li-lift", 14, 0.13)}${LIFT("li-lift-s", 5, 0.14)}${SATIN("li-satin")}
      <radialGradient id="li-shine" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.7"/><stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
      <clipPath id="li-avatar"><circle cx="440" cy="132" r="30"/></clipPath></defs>
      <circle cx="300" cy="150" r="132" fill="#EFACBA" fill-opacity="0.2"/>
      <circle cx="300" cy="150" r="148" fill="none" stroke="#1A1A1A" stroke-opacity="0.08"/>
      <g class="art__float">
        <rect x="104" y="44" width="196" height="204" rx="16" fill="#FFFFFF" fill-opacity="0.6" stroke="#1A1A1A" stroke-opacity="0.07" transform="rotate(5 202 146)"/>
        <g filter="url(#li-lift)"><rect x="92" y="54" width="200" height="204" rx="16" fill="url(#li-satin)"/></g>
        <rect x="92.5" y="54.5" width="199" height="203" rx="15.5" fill="none" stroke="#1A1A1A" stroke-opacity="0.08"/>
        <rect x="110" y="72" width="164" height="88" rx="10" fill="#EFACBA"/><rect x="110" y="72" width="164" height="88" rx="10" fill="url(#li-shine)"/>
        <rect x="110" y="178" width="132" height="10" rx="5" fill="#1A1A1A"/><rect x="110" y="196" width="90" height="10" rx="5" fill="#1A1A1A"/>
        <path d="M110 228 H232" stroke="#1A1A1A" stroke-opacity="0.18" stroke-width="3" stroke-linecap="round"/>
        <g filter="url(#li-lift-s)"><circle cx="288" cy="60" r="24" fill="url(#li-satin)"/></g>
        ${LINKEDIN(275, 47, 26)}
        <g filter="url(#li-lift-s)"><rect x="66" y="210" width="48" height="48" rx="13" fill="url(#li-satin)"/></g>
        ${MARK("chatgpt", 77, 221, 26, "#000000")}
      </g>
      <path d="M292 160 C 340 160, 352 132, 396 132" fill="none" stroke="#EFACBA" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="292" cy="160" r="5" fill="#EFACBA" stroke="#1A1A1A" stroke-width="1.5"/>
      <g class="art__float art__float--b">
        <circle cx="440" cy="132" r="58" fill="none" stroke="#1A1A1A" stroke-opacity="0.12"/>
        <g filter="url(#li-lift)"><circle cx="440" cy="132" r="44" fill="url(#li-satin)"/></g>
        <g clip-path="url(#li-avatar)">
          <circle cx="440" cy="132" r="30" fill="#EFACBA"/>
          <circle cx="440" cy="124" r="10" fill="#1A1A1A"/><path d="M418 164 C 420 146, 460 146, 462 164 Z" fill="#1A1A1A"/>
        </g>
        <g filter="url(#li-lift-s)"><circle cx="474" cy="166" r="12" fill="#1A1A1A"/></g>
        <path d="M468.5 166.5 l4 4 l7 -7.5" fill="none" stroke="#EFACBA" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`,
  },
  // A landing page whose form feeds a lead tracker, with a review step floating above it
  "ai-websites-workflow-building": {
    tone: "yellow", view: "0 0 560 300",
    line: "Build landing pages, trackers, and AI-powered workflows.",
    svg: `<defs>${LIFT("ws-lift", 12, 0.18)}${SATIN("ws-satin")}</defs>
      <text x="34" y="32" class="art__mono" fill="#1A1A1A">PAGE</text>
      <g class="art__float">
        <g filter="url(#ws-lift)"><rect x="34" y="44" width="292" height="214" rx="10" fill="url(#ws-satin)"/></g>
        <path d="M34 68.5 H326" stroke="#1A1A1A" stroke-opacity="0.12"/>
        <circle cx="50" cy="56" r="3.4" fill="#1A1A1A" fill-opacity="0.3"/><circle cx="62" cy="56" r="3.4" fill="#1A1A1A" fill-opacity="0.18"/><circle cx="74" cy="56" r="3.4" fill="#1A1A1A" fill-opacity="0.18"/>
        <rect x="52" y="88" width="140" height="14" rx="3" fill="#1A1A1A"/>
        <path d="M52 118 H178 M52 130 H150" stroke="#1A1A1A" stroke-opacity="0.24" stroke-width="3" stroke-linecap="round"/>
        <rect x="52.5" y="150.5" width="128" height="22" rx="5" fill="none" stroke="#1A1A1A" stroke-opacity="0.28"/>
        <rect x="52" y="184" width="74" height="26" rx="6" fill="#1A1A1A"/><path d="M64 197 H100" stroke="#FAF8F4" stroke-width="2.4" stroke-linecap="round"/>
        <rect x="206" y="88" width="102" height="84" rx="6" fill="#FBC522" fill-opacity="0.4"/>
        <path d="M212 164 L238 132 L258 152 L272 140 L302 164" fill="none" stroke="#1A1A1A" stroke-opacity="0.4" stroke-width="2" stroke-linejoin="round"/><circle cx="284" cy="110" r="7" fill="#1A1A1A" fill-opacity="0.35"/>
        <path d="M52 232.5 H190" stroke="#1A1A1A" stroke-opacity="0.12"/>
      </g>
      <path d="M126 197 C 190 197, 214 232, 290 222" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/>
      <circle cx="126" cy="197" r="4" fill="#FAF8F4" stroke="#1A1A1A" stroke-width="2"/>
      <g class="art__float art__float--b">
        <g filter="url(#ws-lift)"><rect x="290" y="112" width="232" height="164" rx="12" fill="#1A1A1A"/></g>
        <path d="M302 112.8 H510" stroke="#FFFFFF" stroke-opacity="0.25" stroke-linecap="round"/>
        <text x="308" y="140" class="art__mono" fill="#FAF8F4">LEADS</text>
        <path d="M290 152.5 H522 M308 196.5 H504 M308 236.5 H504" stroke="#FFFFFF" stroke-opacity="0.12"/>
        <g stroke="#FAF8F4" stroke-width="3" stroke-linecap="round"><path d="M308 176 H376"/><path d="M308 216 H360" stroke-opacity="0.5"/><path d="M308 256 H384" stroke-opacity="0.5"/></g>
        <rect x="452" y="168" width="52" height="16" rx="8" fill="#FBC522"/><rect x="452.5" y="208.5" width="51" height="15" rx="7.5" fill="none" stroke="#FAF8F4" stroke-opacity="0.5"/><rect x="452" y="248" width="52" height="16" rx="8" fill="#FBC522"/>
      </g>
      <path d="M478 108 V90" stroke="#1A1A1A" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/>
      <g class="art__float art__float--c">
        <g filter="url(#ws-lift)"><rect x="396" y="24" width="140" height="62" rx="9" fill="url(#ws-satin)"/></g>
        <text x="410" y="48" class="art__mono" fill="#1A1A1A">REVIEW</text>
        <path d="M410 66 H460" stroke="#1A1A1A" stroke-opacity="0.24" stroke-width="3" stroke-linecap="round"/>
        <rect x="486" y="54" width="34" height="18" rx="9" fill="#1A1A1A"/><circle cx="511" cy="63" r="6" fill="#FBC522"/>
      </g>`,
  },
  // Learn page only (home: false). One use-case brief handed to a Charcoal assistant panel, whose
  // drafted answer stops at a review checkpoint before it goes anywhere
  "ai-agent-builder-bootcamp": {
    tone: "ink", home: false, view: "0 0 560 300",
    svg: `<defs>${LIFT("ag-lift", 12, 0.18)}${LIFT("ag-lift-s", 5, 0.16)}${SATIN("ag-satin")}</defs>
      <text x="34" y="40" class="art__mono" fill="#1A1A1A">USE CASE</text>
      <g class="art__float">
        <g filter="url(#ag-lift-s)"><rect x="34" y="54" width="168" height="150" rx="10" fill="url(#ag-satin)"/></g>
        <rect x="52" y="74" width="96" height="12" rx="3" fill="#1A1A1A"/>
        <path d="M52 104 H180 M52 118 H164 M52 132 H172" stroke="#1A1A1A" stroke-opacity="0.22" stroke-width="3" stroke-linecap="round"/>
        <rect x="52" y="152" width="72" height="22" rx="11" fill="#EFACBA"/>
        <path d="M64 163 H112" stroke="#1A1A1A" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      <path d="M202 129 C 232 129, 236 104, 262 104" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/>
      <circle cx="202" cy="129" r="4" fill="#FAF8F4" stroke="#1A1A1A" stroke-width="2"/>
      <g class="art__float art__float--b">
        <g filter="url(#ag-lift)"><rect x="262" y="40" width="232" height="190" rx="12" fill="#1A1A1A"/></g>
        <path d="M274 40.8 H482" stroke="#FFFFFF" stroke-opacity="0.25" stroke-linecap="round"/>
        <circle cx="290" cy="68" r="10" fill="#FBC522"/><path d="M285 68 h10 M290 63 v10" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/>
        <text x="310" y="72" class="art__mono" fill="#FAF8F4">ASSISTANT</text>
        <path d="M262 88.5 H494" stroke="#FFFFFF" stroke-opacity="0.12"/>
        <rect x="280" y="104" width="128" height="30" rx="8" fill="#FFFFFF" fill-opacity="0.12"/>
        <path d="M292 119 H392" stroke="#FAF8F4" stroke-opacity="0.6" stroke-width="3" stroke-linecap="round"/>
        <rect x="330" y="146" width="146" height="44" rx="8" fill="#FAF8F4"/>
        <path d="M344 162 H458 M344 175 H420" stroke="#1A1A1A" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
        <path d="M280 210 H360" stroke="#FAF8F4" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
      </g>
      <path d="M440 232 V250" stroke="#1A1A1A" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/>
      <g class="art__float art__float--c">
        <g filter="url(#ag-lift-s)"><rect x="356" y="250" width="176" height="40" rx="9" fill="url(#ag-satin)"/></g>
        <text x="372" y="275" class="art__mono" fill="#1A1A1A">REVIEW</text>
        <rect x="474" y="261" width="40" height="18" rx="9" fill="#1A1A1A"/><circle cx="504" cy="270" r="6" fill="#EFACBA"/>
      </g>`,
  },
};

// Home: the open-track programs as a scroll-driven split. On wide screens one mockup holds sticky on
// the left while the programs pass on the right; js/main.js (§5b) marks the program in the middle
// of the screen active and the mockup shows its view. Narrower, each program carries its own copy
// of its view above its text. The mockups are aria-hidden: the tools and statuses are examples,
// so they say nothing the text doesn't.
// Each view is a node network: the output the program leads to (a small interface: a workflow doc,
// a LinkedIn post, a landing page) in the middle, wired by straight hairlines to the tools and
// statuses around it, one layout per program (a left-right split, a top-down cluster, a radial
// spread). Coordinates are in a 480 × 440 map; 16 map units are 1em of the map's type, so the cards
// scale with the map (style.css, "pnet"). A node's wire meets it at the side named by `from`.
// `wire`: h runs level and steps at the trunk (`trunk`, or the midpoint), v runs down and steps at the midpoint, r leaves
// the output level and turns once into the node. Every wire is straight runs and square corners.
// `at` picks the output's side a wire leaves from; `in` reverses it, so its flow runs into the
// output (an input trigger).
const NET_W = 480, NET_H = 440;
const PROGRAM_NET = {
  "ai-workforce-accelerator": {
    layout: "split", out: "steps", hub: [118, 220, 172, 140], trunk: 236, cursor: [318, 246], tip: "Claude",
    nodes: [
      { x: 350, y: 84, icon: "gmail", t: "Gmail", s: "12 requests in", from: "l", wire: "h" },
      { x: 372, y: 220, w: 176, icon: "claude-color", t: "Claude", s: "Drafting steps", from: "l", wire: "h", on: true },
      { x: 342, y: 356, h: 66, icon: "google-sheets", t: "Prototype", s: "2 of 3 stages", meter: 0.66, from: "l", wire: "h" },
      { x: 118, y: 366, w: 152, h: 40, chip: "Readiness map", from: "t", wire: "v" },
    ],
  },
  "ai-linkedin-b2b-growth": {
    layout: "cluster", out: "post", hub: [240, 88, 184, 140], cursor: [300, 278], tip: "LinkedIn",
    nodes: [
      { x: 82, y: 242, w: 150, icon: "chatgpt", t: "ChatGPT", s: "Hook ideas", from: "t", wire: "v" },
      { x: 240, y: 256, w: 150, icon: "linkedin", t: "LinkedIn", s: "Queued", from: "t", wire: "v", on: true },
      { x: 398, y: 242, w: 150, icon: "claude-color", t: "Claude", s: "In your voice", from: "t", wire: "v" },
      { x: 240, y: 386, w: 176, h: 66, icon: "google-calendar", t: "Content plan", s: "Week 2 of 4", meter: 0.5, from: "t", wire: "v", parent: 1 },
    ],
  },
  "ai-websites-workflow-building": {
    layout: "radial", out: "page", hub: [240, 222, 156, 124], cursor: [296, 110], tip: "Claude Code",
    nodes: [
      { x: 108, y: 86, w: 168, icon: "google-sheets", t: "Lead tracker", s: "24 new rows", from: "b", wire: "r" },
      { x: 366, y: 84, w: 184, icon: "claude-code", t: "Claude Code", s: "Building the page", from: "b", wire: "r", on: true },
      { x: 366, y: 358, w: 164, h: 66, icon: "check", t: "Review", s: "3 of 5 checks", meter: 0.6, from: "t", wire: "r" },
      { x: 108, y: 356, w: 168, icon: "gmail", t: "Gmail", s: "New lead alerts", from: "t", wire: "r" },
    ],
  },
  // Learn only: Custom AI Systems & Automation. One trigger feeds the AI logic and rules card,
  // which fans out to the systems it keeps in step
  "ai-agent-builder-bootcamp": {
    layout: "flow", out: "rules", hub: [186, 250, 196, 150], cursor: [312, 288], tip: "Runs automatically",
    nodes: [
      { x: 140, y: 64, w: 176, icon: "form", t: "Website form", s: "New enquiry", from: "b", at: "t", wire: "v", in: true },
      { x: 392, y: 112, w: 164, icon: "google-sheets", t: "CRM sync", s: "Contact added", from: "l", wire: "h" },
      { x: 392, y: 250, w: 164, icon: "gmail", t: "Auto-reply", s: "Sent in 2 min", from: "l", wire: "h", on: true },
      { x: 392, y: 392, w: 164, h: 66, icon: "chart", t: "Analytics", s: "Weekly report", meter: 0.72, from: "l", wire: "h" },
    ],
  },
};
// The output in the middle, drawn as a small window
const NET_OUT = {
  steps: { file: "workflow.doc", body: `<b class="pout__title">Workflow design</b>
              <span class="pout__row is-done"><i></i>Map the task</span><span class="pout__row is-now"><i></i>Design the steps</span><span class="pout__row"><i></i>Prototype</span>` },
  post: { file: "linkedin.com", body: `<span class="pout__author"><i></i><span><em></em><em></em></span></span>
              <span class="pout__line"></span><span class="pout__line pout__line--short"></span><span class="pout__media"></span>` },
  page: { file: "yourbusiness.ph", body: `<span class="pout__head"></span><span class="pout__line"></span><span class="pout__line pout__line--short"></span>
              <span class="pout__form"><span class="pout__field"></span><span class="pout__btn">Get started</span></span>` },
  rules: { file: "automation.ai", body: `<b class="pout__title">AI logic &amp; rules</b>
              <span class="pout__row is-done"><i></i>If a new enquiry arrives</span><span class="pout__row is-now"><i></i>Classify and score it</span><span class="pout__row"><i></i>Sync, reply, report</span>` },
};
const LINKEDIN_IMG = `<svg viewBox="0 0 24 24" focusable="false"><rect width="24" height="24" rx="4.5" fill="#0A66C2"/><path transform="translate(3.6 3.6) scale(0.7)" fill="#FFFFFF" d="M7 9H4v11h3V9Zm-1.5-5.2a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM10 9h2.9v1.5c.5-.9 1.6-1.7 3.1-1.7 2.8 0 4 1.8 4 5V20h-3v-5.6c0-1.6-.5-2.7-1.9-2.7-1.5 0-2.1 1.1-2.1 2.7V20h-3V9Z"/></svg>`;
const CHECK_IMG = `<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="#EFACBA"/><path d="M7.5 12.4l3 2.9 6-6.3" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FORM_IMG = `<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="#EFACBA"/><path d="M7.5 8.8h9M7.5 12h6" stroke="#1A1A1A" stroke-width="1.8" stroke-linecap="round"/><rect x="7.5" y="14.6" width="5.5" height="2.8" rx="1.4" fill="#1A1A1A"/></svg>`;
const CHART_IMG = `<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="#FBC522"/><path d="M8 16.5v-3M12 16.5v-8M16 16.5v-5.5" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"/></svg>`;
const NET_IMG = { linkedin: LINKEDIN_IMG, check: CHECK_IMG, form: FORM_IMG, chart: CHART_IMG };
const netIcon = (icon) => NET_IMG[icon]
  || `<img src="/assets/icons/tools/${icon}.svg" alt="" width="24" height="24" loading="lazy">`;
// Where a wire meets a node, and the wire itself from (sx, sy) to that point
const netSize = (n) => [n.w || 156, n.h || 56];
function netAnchor(n) {
  const [w, h] = netSize(n);
  return { l: [n.x - w / 2, n.y], r: [n.x + w / 2, n.y], t: [n.x, n.y - h / 2], b: [n.x, n.y + h / 2] }[n.from];
}
function netWire([sx, sy], [ax, ay], wire, trunk) {
  if (sx === ax || sy === ay) return `M${sx} ${sy} L${ax} ${ay}`;
  if (wire === "h") { const mx = trunk || (sx + ax) / 2; return `M${sx} ${sy} H${mx} V${ay} H${ax}`; }
  if (wire === "v") { const my = (sy + ay) / 2; return `M${sx} ${sy} V${my} H${ax} V${ay}`; }
  return `M${sx} ${sy} H${ax} V${ay}`;
}
function programMock(p, i) {
  const m = PROGRAM_NET[p.slug] || PROGRAM_NET["ai-workforce-accelerator"];
  const [hx, hy, hw, hh] = m.hub;
  const out = NET_OUT[m.out];
  const wires = m.nodes.map((n, k) => {
    // From the output's edge on the wire's way out (or from a parent node's far side)
    const parent = n.parent != null ? m.nodes[n.parent] : null;
    const start = parent ? [parent.x, parent.y + netSize(parent)[1] / 2]
      : n.at ? { l: [hx - hw / 2, hy], r: [hx + hw / 2, hy], t: [hx, hy - hh / 2], b: [hx, hy + hh / 2] }[n.at]
      : n.wire === "h" ? [hx + hw / 2, hy] : n.wire === "v" ? [hx, hy + hh / 2] : [hx + Math.sign(n.x - hx) * hw / 2, hy];
    const a = netAnchor(n);
    const d = n.in ? netWire(a, start, n.wire, m.trunk) : netWire(start, a, n.wire, m.trunk);
    return `<path class="pnet__wire" d="${d}" pathLength="1" style="--k:${k}"/>${n.on ? `<path class="pnet__flow" d="${d}" pathLength="1"/>` : ""}<circle class="pnet__pin" cx="${a[0]}" cy="${a[1]}" r="3.5" style="--k:${k}"/>`;
  }).join("");
  const nodes = m.nodes.map((n, k) => {
    const [w, h] = netSize(n);
    const pos = `--x:${n.x}; --y:${n.y}; --w:${w}; --h:${h}; --k:${k}`;
    if (n.chip) return `<span class="pnet__node pnet__node--chip" style="${pos}"><span class="pnet__tick"></span>${esc(n.chip)}</span>`;
    return `<span class="pnet__node${n.on ? " is-on" : ""}" style="${pos}"><span class="pnet__icon">${netIcon(n.icon)}</span><span class="pnet__txt"><b>${esc(n.t)}</b><small>${esc(n.s)}</small>${n.meter ? `<span class="pnet__meter" style="--p:${n.meter}"></span>` : ""}</span>${n.on ? `<span class="pnet__live"></span>` : ""}</span>`;
  }).join("");
  return `<div class="pmock__view pnet pnet--${m.layout}" data-pmock="${i}">
          <div class="pnet__map">
            <svg class="pnet__wires" viewBox="0 0 ${NET_W} ${NET_H}" focusable="false">${wires}</svg>
            <span class="pnet__out pout pout--${m.out}" style="--x:${hx}; --y:${hy}; --w:${hw}; --h:${hh}">
              <span class="pout__bar"><i></i><i></i><i></i><em>${out.file}</em></span>
              <span class="pout__body">${out.body}</span>
            </span>
            ${nodes}
            <span class="pnet__cursor" style="--x:${m.cursor[0]}; --y:${m.cursor[1]}"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 3l14 8-6.2 1.6L9.6 19z" fill="#1A1A1A" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="pnet__tip">${esc(m.tip)}</span></span>
          </div>
        </div>`;
}

export function programRowsHome() {
  const picks = D.programs.filter((p) => PROGRAM_COVER[p.slug] && PROGRAM_COVER[p.slug].home !== false)
    .sort((a, b) => !!PROGRAM_COVER[b.slug].feature - !!PROGRAM_COVER[a.slug].feature);
  if (!picks.length) return noPrograms();
  const num = (i) => String(i + 1).padStart(2, "0");
  return `<div class="pscene" data-pscene style="--n:${picks.length}">
      <div class="pscene__stage" aria-hidden="true">
        <div class="pmock" data-pscene-stage data-at="0">
          ${picks.map((_, i) => `<span class="pmock__bg" data-bg="${i}"></span>`).join("")}
          ${picks.map((p, i) => programMock(p, i)).join("")}
          <div class="pmock__dots">${picks.map((_, i) => `<span style="--i:${i}"></span>`).join("")}</div>
        </div>
      </div>
      <ol class="pscene__steps">${picks.map((p, i) => {
    const { tone, feature, line } = PROGRAM_COVER[p.slug];
    const cta = ctaFor(p);
    const external = /^https?:/i.test(p.rec.cta_url || "");
    const ctaUrl = external ? p.rec.cta_url : `/programs/${p.slug}/#register`;
    const outs = (p.outputs || []).slice(0, 3);
    return `
        <li class="pstep pstep--${tone}${i === 0 ? " is-active" : ""}" data-pstep="${i}">
          <div class="pstep__visual" aria-hidden="true"><div class="pmock pmock--inline" data-at="${i}">${programMock(p, i)}</div></div>
          <article class="pstep__body" aria-labelledby="prog-${p.slug}">
            <p class="pstep__cat"><span class="pstep__num" aria-hidden="true">${num(i)}</span>${esc(p.category)}</p>
            <h3 class="pstep__title" id="prog-${p.slug}"><a href="/programs/${p.slug}/" data-track="program_click">${esc(p.title)}</a></h3>
            <p class="pstep__summary">${esc(line || p.summary)}</p>
            ${outs.length ? `<p class="pstep__label">You leave with</p>
            <ul class="pstep__outs">${outs.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
            ${feature && p.statusLabel && p.statusLabel !== cta ? `<p class="prog__notice">${esc(p.statusLabel)}</p>` : ""}
            <div class="pstep__actions">
              <a class="btn" href="/programs/${p.slug}/" data-track="program_click">See the program <span class="btn__arrow" aria-hidden="true">↗</span></a>
              <a class="text-link" href="${esc(ctaUrl)}"${external ? ' target="_blank" rel="noopener"' : ""} data-track="program_click">${esc(cta)} <span class="link-arrow" aria-hidden="true">↗</span>${external ? '<span class="sr-only"> (opens in a new tab)</span>' : ""}</a>
            </div>
          </article>
        </li>`;
  }).join("")}
      </ol>
    </div>`;
}

// Learn: every program, with the home Programs split (programRowsHome) mirrored: the programs
// pass on the left, on the page ground, while one mockup holds sticky on the right and shows the
// view of the program in the middle of the screen (js/main.js §5b). Narrower, each program carries
// its own copy of its view above its text. A program carries only what helps someone choose:
// category, title, one line, the first thing you leave with, who it is for, the format and
// the way in; status, requirements and fees stay on each program page.
export function programGrid() {
  if (!D.programs.length) return noPrograms();
  return `<div class="pscene pscene--learn" data-pscene style="--n:${D.programs.length}">
      <div class="pscene__stage" aria-hidden="true">
        <div class="pmock" data-pscene-stage data-at="0">
          ${D.programs.map((_, i) => `<span class="pmock__bg" data-bg="${i}"></span>`).join("")}
          ${D.programs.map((p, i) => programMock(p, i)).join("")}
          <div class="pmock__dots">${D.programs.map((_, i) => `<span style="--i:${i}"></span>`).join("")}</div>
        </div>
      </div>
      <ol class="pscene__steps pgrid">${D.programs.map((p, i) => {
    const cover = PROGRAM_COVER[p.slug];
    const audience = (p.audience && p.audience.length) ? p.audience.slice(0, 2) : [];
    const outcome = (p.outputs && p.outputs.length) ? p.outputs[0] : "";
    return `
        <li class="pstep${i === 0 ? " is-active" : ""}" id="${p.slug}" data-pstep="${i}">
          <div class="pstep__visual" aria-hidden="true"><div class="pmock pmock--inline" data-at="${i}">${programMock(p, i)}</div></div>
          <article class="prog prog--${cover ? cover.tone : "white"}" aria-labelledby="prog-${p.slug}">
            <div class="prog__body pstep__body">
              <div class="prog__intro">
                <p class="prog__cat">${esc(p.category)}</p>
                <h3 class="prog__title" id="prog-${p.slug}"><a href="/programs/${p.slug}/" data-track="program_click">${esc(p.title)}</a></h3>
                <p class="prog__summary">${esc(cover?.line || p.summary)}</p>
              </div>
              ${outcome ? `<dl class="prog__outcome"><dt>You leave with</dt><dd>${esc(outcome)}</dd></dl>` : ""}
              ${audience.length || p.format ? `<dl class="prog__facts">
                ${audience.length ? `<div class="prog__fact prog__fact--for"><dt>For</dt><dd><ul class="prog__for">${audience.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></dd></div>` : ""}
                ${p.format ? `<div class="prog__fact"><dt>Format</dt><dd>${esc(p.format)}</dd></div>` : ""}
              </dl>` : ""}
              <div class="prog__actions">
                <a class="btn prog__btn" href="/programs/${p.slug}/" data-track="program_click">View program <span class="btn__arrow" aria-hidden="true">↗</span><span class="sr-only">: ${esc(p.title)}</span></a>
              </div>
            </div>
          </article>
        </li>`;
  }).join("")}
      </ol>
    </div>`;
}

// For Professionals: every program as a short card (what you leave with, status), linking to its page.
export function programLinks() {
  if (!D.programs.length) return noPrograms();
  return `<ul class="plinks">${D.programs.map((p) => `
      <li class="plinks__item">
        <a class="plinks__link" href="/programs/${p.slug}/" data-track="program_click">
          <span class="plinks__top"><span class="plinks__cat">${esc(p.category)}</span>${badge(p.statusKey, p.statusLabel)}</span>
          <span class="plinks__title">${esc(p.title)}</span>
          <span class="plinks__summary">${esc(p.summary)}</span>
          ${p.outputs.length ? `<span class="plinks__out"><b>You leave with</b> ${esc(p.outputs.slice(0, 2).join(" · "))}</span>` : ""}
          <span class="text-link plinks__more">See the program <span class="link-arrow" aria-hidden="true">↗</span></span>
        </a>
      </li>`).join("")}
    </ul>`;
}

// Program pages: the hero's right side shows the program's node network from the Programs split
// (same view and ground as on Home and Learn) on a Works White hero; the facts move to a details
// panel under the hero (programInfo).
export function programHeroArt(p, html) {
  const i = D.programs.indexOf(p);
  const art = `<div class="pmock pmock--inline phero__art" data-at="${i}" data-reveal aria-hidden="true">${programMock(p, i)}</div>`;
  return html.replace(/(<section class="phero[^"]*phero--program[\s\S]*?)(<aside class="facts"[\s\S]*?<\/aside>)([\s\S]*?<\/section>)/,
    (_, head, facts, tail) => `${head.replace(/phero--\w+ phero--program/, "phero--paper phero--program")}${art}${tail}\n${programInfo(facts)}`);
}

// Line icons in the journey strip's set (as on Learn's .promise__icon), on a 48 grid
const INFO_ICON = {
  "Next intake": `<rect class="route__node" x="6" y="9" width="36" height="32" rx="3.5"/><path class="route__line" d="M6 18h36M15 5v8M33 5v8"/><rect class="route__node route__node--lead" x="13" y="25" width="8" height="8" rx="1.5"/>`,
  Format: `<path class="route__node" d="M24 22 5 31.5 24 41l19-9.5Z"/><path class="route__node route__node--lead" d="M24 7 5 16.5 24 26l19-9.5Z"/>`,
  "Time commitment": `<circle class="route__node" cx="24" cy="24" r="18"/><path class="route__line" d="M24 13v11l7 5"/><circle class="route__head route__head--lead" cx="24" cy="24" r="2.5"/>`,
  Location: `<path class="route__node" d="M24 44s14-12 14-23a14 14 0 0 0-28 0c0 11 14 23 14 23Z"/><circle class="route__head route__head--lead" cx="24" cy="21" r="5"/>`,
  Fee: `<path class="route__node" d="M7 7h15l20 20-15 15L7 22Z"/><circle class="route__head route__head--lead" cx="15" cy="15" r="3"/>`,
};
// The program facts as one card under the hero: a grid of label/value pairs with filled icon
// tiles (as on the Home flow cards), and the instructor with Faith's portrait when she teaches. The
// status badge is left out here: the hero button and the form section below already carry it. The dd elements are kept as the page document wrote them, so bound values and
// "To be confirmed" text carry over.
function programInfo(facts) {
  const rows = new Map([...facts.matchAll(/<div><dt>([\s\S]*?)<\/dt>(<dd[\s\S]*?<\/dd>)<\/div>/g)].map((m) => [textOf(m[1]).trim(), m[2]]));
  const icon = (paths) => `<span class="pinfo__icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false">${paths}</svg></span>`;
  const item = (k, mark = INFO_ICON[k] ? icon(INFO_ICON[k]) : "") => `<div class="pinfo__${k === "Instructor" && mark.includes("pinfo__photo") ? "teacher" : k.split(" ")[0].toLowerCase()}"><dt>${mark}${esc(k)}</dt>${rows.get(k)}</div>`;
  const teacher = rows.get("Instructor");
  const face = teacher && /Faith Natividad/.test(textOf(teacher))
    ? `<span class="pinfo__photo">${imgTag("founder-studio", { sizes: "128px", alt: "" })}</span>`
    : icon(`<path class="route__node" d="M9 41c0-8.3 6.7-14 15-14s15 5.7 15 14Z"/><circle class="route__head route__head--lead" cx="24" cy="14" r="7"/>`);
  const order = ["Next intake", "Format", "Time commitment", "Location", "Fee", ...[...rows.keys()].filter((k) => !["Status", "Instructor", ...Object.keys(INFO_ICON)].includes(k))];
  return `<section class="wrap pinfo" aria-label="Program details">
  <dl class="pinfo__grid">
    ${order.filter((k) => rows.has(k)).map((k) => item(k)).join("")}${teacher ? item("Instructor", face) : ""}
  </dl>
</section>`;
}

// "Who it's for" as an editorial three-column band (css/style.css .pfor): a workshop photo either
// side of the heading, lead and the audience as Faith Pink / AI Yellow badges. Each program gets
// its own pair of landscape photos so neighbouring program pages don't repeat the same room.
const AUD_PHOTOS = {
  "ai-workforce-accelerator": ["room-chart", "bgc-laptops"],
  "ai-linkedin-b2b-growth": ["roundtable", "talk-big-screen"],
  "ai-websites-workflow-building": ["talk-laptops", "bgc-room"],
  "ai-agent-builder-bootcamp": ["open-qa", "room-wide"],
};
function programAudience(p, html) {
  return html.replace(/<section class="section wrap split" aria-labelledby="for-title">\s*<div>\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<p class="split__lead">([\s\S]*?)<\/p>\s*<\/div>\s*<div><ul class="ticks"([^>]*)>([\s\S]*?)<\/ul><\/div>\s*<\/section>/,
    (all, h2, lead, attrs, items) => {
      const titles = [...items.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
      if (!titles.length) return all;
      const [a, b] = AUD_PHOTOS[p.slug] || ["room-hotel", "bgc-room"];
      // sizes overstates the desktop slot so high-DPI screens get the full 1920px file, not a soft 1280
      const photo = (id, side) => `<figure class="pfor__photo pfor__photo--${side}" data-reveal>${imgTag(id, { sizes: "(min-width: 1024px) 1280px, (min-width: 640px) 50vw, 100vw" })}</figure>`;
      return `<section class="section pfor" aria-labelledby="for-title">
  <div class="wrap pfor__grid">
    <div class="pfor__media">
      ${photo(a, "a")}
      ${photo(b, "b")}
    </div>
    <div class="pfor__copy" data-reveal>
      <h2 id="for-title">${h2}</h2>
      <p class="pfor__lead">${lead}</p>
      <ul class="pfor__checks"${attrs}>${titles.map((t) => `<li>${t}</li>`).join("")}</ul>
    </div>
  </div>
</section>`;
    });
}

// "What you'll learn" and "What you leave with" as a two-step scroll story, the Build with AI use
// cases' pattern (css/style.css §2 and §6, js/main.js §5d): the learning steps, then the outputs,
// pass on the left while the output frame on the right shows the learning path, then the example
// output (the program's own preview, restyled). Only programs listed here; the rest keep the plain
// band. Each path row is drawn from the program's own "How it runs" step: its title, then chips,
// tick chips or a draft sketch, an optional AI or person mark, and `now` for the step where AI
// does the drafting.
const LEARN_PATH = {
  "ai-websites-workflow-building": {
    alt: "Pick a small, useful project that is safe to test; build the first version with AI; check accuracy, privacy and accessibility before you share.",
    rows: [
      { chips: ["Small", "Useful", "Safe to test"] },
      { mini: true, mark: "ai", now: true },
      { ticks: ["Accuracy", "Privacy", "Accessibility"], mark: "person" },
    ],
  },
  "ai-workforce-accelerator": {
    alt: "See what AI can and cannot do in your role; compare tasks by frequency, effort, risk and ease of review; design the workflow with AI steps and human checks; build and test a first prototype.",
    rows: [
      { chips: ["AI can", "AI can’t", "Your judgment"] },
      { chips: ["Frequency", "Effort", "Risk", "Review"] },
      { chips: ["Inputs", "AI steps", "Human checks", "Output"], mark: "ai", now: true },
      { ticks: ["First version", "Low-risk test", "What to improve"], mark: "person" },
    ],
  },
  "ai-linkedin-b2b-growth": {
    alt: "Clarify who you serve, the problem you solve and your proof; plan content drafted with AI and edited by you; follow up in a way you review before anything is sent.",
    rows: [
      { chips: ["Who you serve", "The problem", "Your proof"] },
      { mini: true, mark: "ai", now: true },
      { ticks: ["Reviewed first", "Your voice", "Human-led"], mark: "person" },
    ],
  },
  "ai-agent-builder-bootcamp": {
    alt: "Define one assistant use case with clear inputs and limits; build the first version with AI; test it with review points and a path to a person.",
    rows: [
      { chips: ["Clear inputs", "Limits"] },
      { mini: true, mark: "ai", now: true },
      { ticks: ["Review points", "Hand-off to a person"], mark: "person" },
    ],
  },
};
const pathRow = (r, i, label) => {
  const chips = (list, cls = "") => `<span class="bw-path__chips${cls}">${list.map((c) => `<span>${c}</span>`).join("")}</span>`;
  const art = r.mini ? `<span class="bw-path__mini"><i></i><span class="bw-lines"><i></i><i></i></span></span>` : r.ticks ? chips(r.ticks, " bw-path__chips--ticks") : chips(r.chips || []);
  const mark = r.mark === "ai" ? `<span class="bw-mark bw-mark--ai">AI</span>` : r.mark === "person" ? `<span class="bw-mark bw-mark--person"></span>` : "";
  return `<div class="bw-path__row${r.now ? " is-now" : ""}"><span class="bw-path__num">${String(i + 1).padStart(2, "0")}</span><span class="bw-path__body"><b>${label}</b>${art}</span>${mark}</div>`;
};
function programOutcomes(p, html) {
  const path = LEARN_PATH[p.slug];
  if (!path) return html;
  return html.replace(/<section class="section band band--stone" aria-labelledby="outcomes-title">\s*<div class="wrap outcomes">\s*<div>\s*<h2 id="outcomes-title">([\s\S]*?)<\/h2>\s*<ol class="numbered"([^>]*)>([\s\S]*?)<\/ol>\s*<\/div>\s*<div class="outcomes__leave">\s*<h3>([\s\S]*?)<\/h3>\s*<ul class="ticks"([^>]*)>([\s\S]*?)<\/ul>\s*(<figure class="preview[\s"][\s\S]*?<\/figure>)\s*(<p class="small">[\s\S]*?<\/p>)?\s*<\/div>\s*<\/div>\s*<\/section>/,
    (all, h2, olAttrs, outcomes, h3, ulAttrs, outputs, figure, note = "") => {
      const agenda = [...(html.match(/<section[^>]*aria-labelledby="agenda-title"[^>]*>([\s\S]*?)<\/section>/)?.[1] || "").matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => m[1]);
      if (agenda.length !== path.rows.length) return all; // the agenda changed shape in the CMS: keep the plain band
      const label = agenda;
      return `<section class="section band band--stone bw-learn" aria-labelledby="outcomes-title">
  <div class="wrap">
    <div class="bw-story" data-story>
      <div class="bw-story__steps">
        <span class="bw-story__rail" aria-hidden="true"><i data-story-rail></i></span>
        <div class="bw-story__step" data-story-step>
          <span class="bw-story__num" aria-hidden="true">01</span>
          <h2 id="outcomes-title" class="bw-case__title" data-reveal>${h2}</h2>
          <ol class="numbered"${olAttrs}>${outcomes}</ol>
        </div>
        <div class="bw-story__step" data-story-step>
          <span class="bw-story__num" aria-hidden="true">02</span>
          <h3 class="bw-case__title">${h3}</h3>
          <ul class="ticks"${ulAttrs}>${outputs}</ul>
          ${note}
        </div>
      </div>
      <div class="bw-story__stage">
        <div class="bw-story__frame fcard" data-story-frame>
          <span class="bw-story__bg" data-bg="0" aria-hidden="true"></span><span class="bw-story__bg" data-bg="1" aria-hidden="true"></span>
          <div class="bw-story__arts fcard__art">
            <div class="bw-case__art bw-story__art" role="img" aria-label="Illustration: the ${["three", "four", "five"][path.rows.length - 3] || path.rows.length} learning steps as a path. ${path.alt}" data-story-art>
              <div class="bw-path">
                ${path.rows.map((r, i) => pathRow(r, i, label[i])).join("\n                ")}
              </div>
            </div>
            <div class="bw-case__art bw-story__art bw-learn__out" data-story-art>
              ${figure}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
    });
}

export function programPage(p) {
  if (!p.doc) return null;
  const others = D.programs.filter((o) => o.slug !== p.slug);
  const body = programOutcomes(p, programAudience(p, programHeroArt(p, docBody(p, "programs", {
    "program-form": () => programForm(p),
    "other-programs": () => others.length ? others.map((o) => `<li><a href="/programs/${o.slug}/" data-track="program_click"><span>${esc(o.title)}</span>${badge(o.statusKey, o.statusLabel)}</a></li>`).join("") : EMPTY_SECTION,
  }))));
  return {
    title: p.seoTitle || `${p.title} · Faith Works`,
    description: p.metaDescription || p.summary,
    path: `/programs/${p.slug}/`,
    nav: "learn",
    body,
    image: p.socialImage || p.image?.url,
    ...pageFrame(p),
  };
}

/* ---- Events ------------------------------------------------------------ */
const eventImg = (im) => `<img src="${esc(im.src)}"${im.width && im.height ? ` width="${im.width}" height="${im.height}"` : ""} alt="${esc(im.alt)}" loading="lazy" decoding="async">`;
const EVENT_IMG_SIZES = "(min-width: 1241px) 30vw, (min-width: 641px) 70vw, 100vw";
// One event photo: a registered photo in every web size (srcset), otherwise the address as given.
const eventPhoto = (g, attrs = "") => g.photo
  ? imgTag(g.photo, { sizes: EVENT_IMG_SIZES, alt: g.alt }).replace(/^<img/, `<img${attrs}`)
  : `<img${attrs} src="${esc(g.url)}" alt="${esc(g.alt)}" loading="lazy" decoding="async">`;
const ARROW = { prev: "M15 5l-7 7 7 7", next: "M9 5l7 7-7 7" };
const slideBtn = (dir, label) => `<button type="button" class="voices__btn event__slides-btn" data-slide-${dir} aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ARROW[dir]}"/></svg></button>`;
// The card's picture. Two or more event images become a slideshow: Previous/Next buttons on the
// photo's sides, the arrow keys and a "2 / 5" count for screen readers (js/main.js §20). Without
// script only the cover shows. Past events keep their photos. The Workshops calendar shows the
// same figure in its day panel (eventCalendar).
function eventFigure(e) {
  const photos = e.gallery || [];
  if (photos.length < 2) return e.image ? `<figure class="event__img">${photos.length ? eventPhoto(photos[0]) : eventImg(e.image)}</figure>` : "";
  const n = photos.length;
  return `<figure class="event__img event__slides" data-slides role="group" aria-roledescription="slideshow" aria-label="Photos from ${esc(e.title)}">
          <div class="event__slides-frame">${photos.map((g, i) => eventPhoto(g, `${i ? " hidden" : ""} data-slide="${i}"`)).join("")}
            <div class="event__slides-nav" data-slides-nav hidden>${slideBtn("prev", "Previous photo")}<span class="event__slides-count sr-only" aria-live="polite" data-slide-count>1 / ${n}</span>${slideBtn("next", "Next photo")}</div>
          </div>
        </figure>`;
}

// An event card: what, when and where, the registration button (when there is one) and an
// "Event details" link when the event has its own page and the button goes elsewhere. Past
// events show neither: only what happened and their photos.
function eventCard(e) {
  const d = eventDate(e);
  const past = isPast(e);
  const dateText = d
    ? `<time datetime="${e.date}">${fmt(d, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</time>${e.endDate && e.endDate !== e.date ? ` – <time datetime="${e.endDate}">${fmt(eventDate({ date: e.endDate }), { day: "numeric", month: "long", year: "numeric" })}</time>` : ""}`
    : "Date to be announced";
  const facts = [["Date", dateText]];
  if (e.time) facts.push([`Time (${esc(tzAbbrev(e.timeZone))})`, esc(e.time)]);
  if (e.venue) facts.push(["Location", esc(e.venue)]);
  const cta = eventCta(e.rec, past);
  const details = !past && e.hasPage && e.registration.type !== "page" ? `<a class="text-link" href="/events/${esc(e.slug)}/">Event details <span class="link-arrow" aria-hidden="true">↗</span></a>` : "";
  const actions = cta + details;
  return `<article class="event${past ? " event--past" : ""}" id="event-${esc(e.slug)}">
      <div class="event__date" aria-hidden="true">${d ? `<b>${fmt(d, { day: "numeric" })}</b><span>${fmt(d, { month: "short" })} ${fmt(d, { year: "numeric" })}</span>` : `<b>TBA</b><span>Date soon</span>`}</div>
      <div class="event__body">
        <p class="event__type">${badge(eventStatus(e.rec, today))}</p>
        <h3>${esc(e.title)}</h3>
        ${e.summary ? `<p>${esc(e.summary)}</p>` : ""}
        <dl class="event__facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        ${actions ? `<div class="event__cta">${actions}</div>` : ""}
      </div>
      ${eventFigure(e)}
    </article>`;
}
export function eventPage(e) {
  if (!e.doc) return null;
  const past = isPast(e);
  const body = docBody(e, "events", { "event-actions": () => eventCta(e.rec, past, { onPage: true }) || null });
  return {
    title: e.seoTitle || `${e.title} · Faith Works`,
    description: e.metaDescription || e.summary || "",
    path: `/events/${e.slug}/`,
    nav: "learn",
    body,
    image: e.socialImage || e.image?.src,
    ...pageFrame(e),
  };
}

const byStart = (a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.rec.start_time || "").localeCompare(b.rec.start_time || "");
export function events(which) {
  const up = D.events.filter((e) => !isPast(e)).sort(byStart);
  const past = D.events.filter(isPast).sort((a, b) => byStart(b, a));
  const set = which === "past" ? past : up;
  if (!set.length) {
    return which === "past"
      ? EMPTY_SECTION
      : emptyState({ title: "No dates are confirmed right now.", text: "Get notified when the next workshop opens.", href: "/workshops/#notify", label: "Get notified" });
  }
  return `<div class="events">${set.map(eventCard).join("")}</div>`;
}
export function eventOptions() {
  return D.events.filter((e) => !isPast(e)).sort(byStart).map((e) => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join("");
}

// The data behind the Workshops calendar (js/main.js draws it) and /events/calendar.json.
// Only what the website shows anyway: published, visible events with a date. A past event keeps
// only its title and dates (plus its photos in the embedded calendar): no details, link or button.
export function calendarData() {
  return D.events.filter((e) => e.date).sort(byStart).map((e) => {
    const past = isPast(e);
    const base = { id: e.slug, title: e.title, start: e.start, end: e.end, timeZone: e.timeZone, allDay: !e.rec.start_time, past };
    if (past) return base;
    const r = e.registration;
    const url = e.hasPage ? `/events/${e.slug}/` : r.type === "external" && r.url ? r.url : `/workshops/#event-${e.slug}`;
    const cta = r.type === "external" && r.url ? (e.registration.label || "Register") : r.type === "page" ? (e.registration.label || "Register") : null;
    // endsAt: the calendar treats the event as past once it ends, even on an older build
    return { ...base, summary: e.summary, endsAt: eventEndsAt(e.rec), time: e.time ? `${e.time} ${tzAbbrev(e.timeZone)}` : null, location: e.venue, url, external: /^https?:/i.test(url), cta };
  });
}
// The Event Calendar (Workshops). js/main.js §8 draws the month from the embedded data: days are
// buttons (arrow keys move between them), choosing one lists its events in the panel beside the
// month, and "Next up" jumps to the next event. Each event carries its card's photos (eventFigure,
// the same slideshow) for the panel; /events/calendar.json leaves them out.
// <script type="application/json"> is inert; "<" is escaped so no text can close the element.
export function eventCalendar() {
  const figures = Object.fromEntries(D.events.map((e) => [e.slug, eventFigure(e)]));
  const json = JSON.stringify(calendarData().map((ev) => (figures[ev.id] ? { ...ev, figure: figures[ev.id] } : ev))).replace(/</g, "\\u003c");
  return `<div class="cal" data-fw-calendar>
        <div class="cal__main">
          <div class="cal__head">
            <h3 class="cal__title" data-cal-title aria-live="polite"></h3>
            <div class="cal__controls">
              <button class="cal__today" type="button" data-cal-today>Today</button>
              <button class="cal__nav" type="button" data-cal-prev aria-label="Previous month"><span aria-hidden="true">‹</span></button>
              <button class="cal__nav" type="button" data-cal-next aria-label="Next month"><span aria-hidden="true">›</span></button>
            </div>
          </div>
          <div class="cal__grid" data-cal-grid></div>
          <ul class="cal__legend small" aria-label="Legend">
            <li><span class="cal__key cal__key--up" aria-hidden="true"></span>Upcoming</li>
            <li><span class="cal__key cal__key--past" aria-hidden="true"></span>Past</li>
            <li><span class="cal__key cal__key--today" aria-hidden="true"></span>Today</li>
          </ul>
          <p class="cal__hint small" data-cal-hint hidden>Use the arrow keys to move between days; Page Up and Page Down change the month.</p>
        </div>
        <aside class="cal__panel" data-cal-panel aria-live="polite" aria-label="Selected day"></aside>
        <noscript><p class="small">The calendar needs JavaScript. Every event is listed below.</p></noscript>
        <script type="application/json" data-cal-data>${json}</script>
      </div>`;
}

/* ---- Resources and articles -------------------------------------------- */
// Every resource type is an article page; its Type is only the card badge and a filter.
const newest = (a, b) => String(b.date || "").localeCompare(String(a.date || ""));
const articleDate = (a) => (/^\d{4}-\d{2}-\d{2}/.test(a.date || "") ? fmt(new Date(`${a.date.slice(0, 10)}T12:00:00Z`), { day: "numeric", month: "short", year: "numeric" }) : "");
const articleMeta = (a, ...lead) => [...lead, ...String(a.category || "").split("·").map((c) => c.trim()), articleDate(a), a.readTime].filter(Boolean);
const metaLine = (parts) => parts.map((p) => `<span>${esc(p)}</span>`).join("");
const TYPE_VERBS = { article: "Read", guide: "Read", playbook: "Read", tool: "Try" };
const cardLabel = (a) => `${a.download ? "Download" : TYPE_VERBS[a.type] || "Open"} ${a.typeLabel.toLowerCase()}`;

// Nothing published at all: one message in place of the Resources cards.
export function resourcesEmpty() {
  if (D.articles.some((a) => a.href)) return EMPTY_SECTION;
  return emptyState({
    title: "No resources are published right now.", text: "New guides, worksheets and articles appear here as soon as they are ready. Until then, start your AI journey with the free AI Workflow Starter Kit.",
    href: "/start-your-ai-journey/", label: "Start Your AI Journey", track: "starter_kit_click",
  });
}

// Resources: every resource as one card, featured first, then newest. A search box and Type
// filters (js/main.js §15) appear only with JavaScript; without it every card shows.
export function resourceCards() {
  const items = D.articles.filter((a) => a.href).sort((a, b) => (b.featured - a.featured) || newest(a, b));
  if (!items.length) return EMPTY_SECTION;
  const types = [...new Set(items.map((a) => a.type))];
  const chips = types.length > 1 ? `<div class="rcards__filters" role="group" aria-label="Filter by type">
            <button type="button" class="rcards__chip" aria-pressed="true" data-type="">All</button>${types.map((t) => `<button type="button" class="rcards__chip" aria-pressed="false" data-type="${esc(t)}">${esc(items.find((a) => a.type === t).typeLabel)}</button>`).join("")}
          </div>` : "";
  return `<div class="rcards__tools" data-rcards-tools hidden>
          <label class="rcards__search"><span class="sr-only">Search resources</span><input type="search" placeholder="Search resources" autocomplete="off" data-rcards-search></label>
          ${chips}
        </div>
      <ul class="rcards" data-rcards-list>${items.map((a, i) => {
    const attrs = a.download ? ` download data-track="download_click"` : a.external ? ` target="_blank" rel="noopener"` : "";
    const lead = i === 0 && a.featured;
    const words = [a.title, a.excerpt, a.category, a.typeLabel, ...a.topics].filter(Boolean).join(" ").toLowerCase();
    return `
        <li class="rcard${lead ? " rcard--lead" : ""}" data-type="${esc(a.type)}" data-search="${esc(words)}">
          <a class="rcard__media" href="${esc(a.href)}"${attrs} tabindex="-1" aria-hidden="true">${a.image ? img(a.image, lead ? "(min-width: 900px) 50vw, 100vw" : "(min-width: 900px) 33vw, 100vw", "rcard__img") : `<span class="rcard__img rcard__img--blank"></span>`}</a>
          <div class="rcard__body">
            <p class="rcard__badges"><span class="rcard__type">${esc(a.typeLabel)}</span>${a.featured ? `<span class="rcard__flag">Featured</span>` : ""}</p>
            <p class="rcard__meta">${metaLine(articleMeta(a))}</p>
            <h3><a href="${esc(a.href)}"${attrs}>${esc(a.title)}${a.external ? `<span class="sr-only"> (opens in a new tab)</span>` : ""}</a></h3>
            ${a.excerpt ? `<p class="rcard__excerpt">${esc(a.excerpt)}</p>` : ""}
            <span class="rcard__more" aria-hidden="true">${esc(cardLabel(a))} <span class="link-arrow">${a.download ? "↓" : "→"}</span></span>
          </div>
        </li>`;
  }).join("")}
      </ul>
      <p class="rcards__none small" data-rcards-none hidden>No resources match your search.</p>`;
}

export function block(b) {
  const t = b.type;
  if (t === "paragraph" || t === "p") return `<p>${b.text}</p>`;
  if (t === "heading" || t === "h2") return `<h2>${b.text}</h2>`;
  if (t === "subheading") return `<h3>${b.text}</h3>`;
  if (t === "list") {
    const tag = b.ordered ? "ol" : "ul";
    return `<${tag}>${b.items.map((i) => typeof i === "string" ? `<li>${i}</li>` : `<li><strong>${i.title}</strong> ${i.text}</li>`).join("")}</${tag}>`;
  }
  if (t === "quote") return `<blockquote class="pull"><p>${b.text}</p>${b.cite ? `<cite>${b.cite}</cite>` : ""}</blockquote>`;
  if (t === "callout") return `<aside class="callout"><p class="callout__label">${esc(b.label)}</p>${b.title ? `<h3>${b.title}</h3>` : ""}${b.text ? `<p>${b.text}</p>` : ""}${b.items ? `<ul>${b.items.map((i) => `<li>${i}</li>`).join("")}</ul>` : ""}</aside>`;
  if (t === "takeaway") return `<aside class="takeaway"><h2>${b.title}</h2><ul class="ticks">${b.items.map((i) => `<li>${i}</li>`).join("")}</ul></aside>`;
  if (t === "image") return `<figure class="article__fig">${img(b.image, "(min-width: 900px) 720px, 100vw")}${b.caption ? `<figcaption>${b.caption}</figcaption>` : ""}</figure>`;
  if (t === "link") return `<p><a class="text-link" href="${esc(b.href)}">${esc(b.label)}</a>${b.text ? ` ${b.text}` : ""}</p>`;
  if (t === "cta") return `<aside class="article__cta"><h2>${esc(b.title)}</h2>${b.text ? `<p>${esc(b.text)}</p>` : ""}<a class="btn" href="${esc(b.href)}">${esc(b.label)} <span class="btn__arrow" aria-hidden="true">↗</span></a></aside>`;
  return "";
}

// Keep reading: three other resources with a page, the same category first, each with its featured image.
// None: the whole section is removed.
function relatedArticles(slug) {
  const self = D.articles.find((x) => x.slug === slug);
  const others = D.articles.filter((x) => x.slug !== slug && x.hasPage).sort(newest);
  const picks = [...others.filter((x) => self && x.category === self.category), ...others.filter((x) => !self || x.category !== self.category)].slice(0, 3);
  if (!picks.length) return EMPTY_SECTION;
  return picks.map((r) => `<li><a class="kr" href="/resources/${r.slug}/">
        ${r.image ? img(r.image, "(min-width: 900px) 33vw, 100vw", "kr__img") : `<span class="kr__img kr__img--blank" aria-hidden="true"></span>`}
        <span class="kr__meta">${esc([r.category, r.readTime].filter(Boolean).join(" · "))}</span>
        <span class="kr__title">${esc(r.title)}</span>
      </a></li>`).join("");
}

// Article contents: a sticky sidebar built from the article's section headings (h2), with
// in-page links (js/main.js §14 marks the heading being read). Headings get an id when they have
// none. Fewer than two headings: no sidebar, the article keeps its single column.
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "section";
export function withToc(html) {
  const body = findMarked(html, "class").find((m) => m.attrs.class.split(/\s+/).includes("article__body"));
  if (!body) return html;
  const inner = html.slice(body.openEnd, body.innerEnd);
  const used = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const items = [];
  const named = inner.replace(/<h2\b([^>]*)>([^]*?)<\/h2\s*>/gi, (all, attrs, text) => {
    const label = textOf(text);
    if (!label) return all;
    let id = (attrs.match(/\sid="([^"]+)"/) || [])[1];
    if (!id) {
      const base = `${slugify(label)}`;
      id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      attrs += ` id="${id}"`;
    }
    items.push({ id, label });
    return `<h2${attrs}>${text}</h2>`;
  });
  if (items.length < 2) return html;
  const toc = `<details class="toc" open data-toc>
      <summary class="toc__label">On this page</summary>
      <nav class="toc__nav" aria-label="On this page">
        <ol class="toc__list">${items.map((it) => `<li><a class="toc__link" href="#${esc(it.id)}">${esc(it.label)}</a></li>`).join("")}</ol>
      </nav>
      <div class="toc__progress" aria-hidden="true"><span data-toc-progress></span></div>
    </details>`;
  return `${html.slice(0, body.start)}<div class="article__layout wrap"><aside class="article__aside">${toc}</aside>${html.slice(body.start, body.openEnd)}${named}${html.slice(body.innerEnd, body.end)}</div>${html.slice(body.end)}`;
}

// Keep reading heading gets a way back to the full Resources listing beside it.
const withBackLink = (html) => html.replace(/<h2 id="related-title"[^>]*>[^]*?<\/h2\s*>/, (h) =>
  `<div class="related-head">${h}<a class="btn btn--light" href="/resources/"><span aria-hidden="true">←</span> Back to resources</a></div>`);

// Share: Facebook and LinkedIn open their share windows with the page address; Instagram has
// no share link, so js/main.js §16 uses the phone's share sheet or copies the link instead.
const SHARE_ICONS = {
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3.1h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.2c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.8v3.1h2.6V21h3.1Z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 9H4v11h3V9Zm-1.5-5.2a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM10 9h2.9v1.5c.5-.9 1.6-1.7 3.1-1.7 2.8 0 4 1.8 4 5V20h-3v-5.6c0-1.6-.5-2.7-1.9-2.7-1.5 0-2.1 1.1-2.1 2.7V20h-3V9Z"/></svg>`,
  link: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/></svg>`,
};
function shareBar(path, title) {
  const url = `${String(D.site.origin || "").replace(/\/$/, "")}${cleanPath(path)}`, u = encodeURIComponent(url);
  const out = (net, href, label) => `<a class="share__btn" href="${esc(href)}" target="_blank" rel="noopener" data-share="${net}" aria-label="${label} (opens in a new tab)">${SHARE_ICONS[net]}</a>`;
  return `<div class="share" data-share-bar data-url="${esc(url)}" data-title="${esc(title)}">
      <p class="share__label">Share this</p>
      <div class="share__list">${out("facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`, "Share on Facebook")}${out("linkedin", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, "Share on LinkedIn")}<button type="button" class="share__btn" data-share="instagram" aria-label="Share on Instagram">${SHARE_ICONS.instagram}</button><button type="button" class="share__btn" data-share="copy" aria-label="Copy link">${SHARE_ICONS.link}</button></div>
      <p class="share__note small" role="status" aria-live="polite" data-share-note></p>
    </div>`;
}
// Adds the share bar to the end of the article body.
function withShare(html, path, title) {
  const body = findMarked(html, "class").find((m) => m.attrs.class.split(/\s+/).includes("article__body"));
  return body ? `${html.slice(0, body.innerEnd)}${shareBar(path, title)}${html.slice(body.innerEnd)}` : html;
}

export function articlePage(a) {
  if (!a.doc) return null;
  const body = withBackLink(withToc(withShare(docBody(a, "resources", { "related-articles": () => relatedArticles(a.slug) }), `/resources/${a.slug}/`, a.title)));
  return {
    title: a.seoTitle || `${a.title} · Faith Works`, description: a.metaDescription || a.excerpt, path: `/resources/${a.slug}/`, nav: "resources", body,
    socialTitle: a.seoTitle || a.title, ogType: "article",
    image: a.socialImage || a.image?.social || (a.image?.base && !a.image.formats ? `/${a.image.base}-1440.jpg` : a.image?.url), ...pageFrame(a),
  };
}

/* ---- Proof ------------------------------------------------------------- */
// A renderer with nothing to show returns this marker; tools/build.mjs then removes the
// enclosing <section> so no empty heading is published (brief §2: hide empty sections).
export const EMPTY_SECTION = "<!--fw:empty-section-->";
// Removes the <section> around each marker, with the comment that labels it. A marker that is
// not inside a section (one closes before it) is removed on its own. The CMS preview uses this
// too, so a preview never shows a section the website would leave out.
export function dropEmptySections(html) {
  let at;
  while ((at = html.indexOf(EMPTY_SECTION)) >= 0) {
    let start = html.lastIndexOf("<section", at);
    const end = html.indexOf("</section>", at);
    if (start < 0 || end < 0 || html.lastIndexOf("</section>", at) > start) { html = html.replace(EMPTY_SECTION, ""); continue; }
    const note = html.slice(0, start).match(/<!--(?:(?!-->)[^])*-->\s*$/); // the comment that labels the section
    if (note) start -= note[0].length;
    html = html.slice(0, start) + html.slice(end + "</section>".length);
  }
  return html;
}
// Card colours are a presentation rule, never stored in the CMS: cards take the brand colours in
// turn by position, so neighbours always differ and every build gives the same result. In a loop
// the last card also sits beside the first, so when the count would put two of the same colour
// together there, the last card takes the middle colour instead.
const toneAt = (tones, i, n) => (n > 1 && i === n - 1 && n % tones.length === 1 ? tones[1] : tones[i % tones.length]);

// Published testimonials set to "Show on the website": Faith Pink, AI Yellow and Works White cards.
const QUOTE_TONES = ["pink", "yellow", "stone"];
export function testimonials(limit) {
  const pick = D.stories.filter((s) => s.quote && s.name).slice(0, Number(limit) || 3);
  if (!pick.length) return EMPTY_SECTION;
  return `<div class="quotes">${pick.map((s, i) => `
      ${storyCard(s, QUOTE_TONES[i % QUOTE_TONES.length])}`).join("")}
    </div>`;
}
export function storyCard(s, tone = QUOTE_TONES[0]) {
  // The name is right beside the photo, so the photo itself needs no description (alt="").
  const photo = s.photo ? `<img class="quote__photo" src="${esc(s.photo)}" alt="" width="48" height="48" loading="lazy" decoding="async">` : "";
  return `<figure class="quote quote--${tone}">
        <blockquote><p>${esc(s.quote)}</p></blockquote>
        <figcaption class="quote__by">${photo}<span class="quote__who"><span class="quote__name">${esc(s.name)}</span>${s.role ? `<span class="quote__role">${esc(s.role)}</span>` : ""}</span></figcaption>
      </figure>`;
}

// Home: every published testimonial as a stack of cards (js/main.js §12). The active card lies on
// top; the next two sit tucked behind it, turned slightly, their edges showing below. It moves on
// by itself at a relaxed pace, and a swipe or the arrow keys flip through it: the top card swings
// out to the side and slips to the back. No prev/next buttons. Without JS the cards stay a native
// scroll-snap row. The speaker is named exactly as given,
// with the role from the CMS below; without one, "Faith Works participant" is all that is claimed
// about them (they wrote it after a session). No photos here: the quote is the picture.
// Cards take Faith Pink, AI Yellow and Works White in turn (see toneAt above).
const VOICE_TONES = ["pink", "yellow", "white"];
export function voices() {
  const pick = D.stories.filter((s) => s.quote && s.name);
  if (!pick.length) return EMPTY_SECTION;
  const n = pick.length;
  const slides = pick.map((s, i) => `
          <figure class="voice voice--${toneAt(VOICE_TONES, i, n)}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}" data-slide>
            <blockquote><p>${esc(s.quote)}</p></blockquote>
            <figcaption><b class="voice__name">${esc(s.name)}</b><span class="voice__role">${esc(s.role || "Faith Works participant")}</span></figcaption>
          </figure>`).join("");
  return `<div class="voices${n < 2 ? " voices--single" : ""}" data-carousel role="region" aria-roledescription="carousel" aria-label="What participants said">
      <div class="voices__track" id="voices-track" tabindex="0" role="group" aria-label="Testimonials. Use the left and right arrow keys to move.">${slides}
      </div>
    </div>`;
}

// Where Faith Works has taught: past events that name a venue, newest first, straight from the
// CMS (so a session appears here once it is published there). Only what the record says: the
// session, the date and the place. Hidden when there are none.
export function sessionsRun(limit) {
  const past = D.events.filter((e) => isPast(e) && e.venue && e.date).sort((a, b) => byStart(b, a)).slice(0, Number(limit) || 4);
  if (!past.length) return "";
  return `<div class="sessions"><p class="sessions__label" id="sessions-label">Recent sessions</p><ul class="sessions__list" aria-labelledby="sessions-label">${past.map((e) => `
        <li class="sessions__item">
          <time datetime="${e.date}">${fmt(eventDate(e), { day: "numeric", month: "short", year: "numeric" })}</time>
          <b>${esc(e.title)}</b>
          <span>${esc(e.venue)}</span>
        </li>`).join("")}
      </ul></div>`;
}

// The homepage video: a real Faith Works video set in Site settings (YouTube or Vimeo). It shows
// as a still with a play button and loads the privacy-friendly player only on press
// (js/main.js §13). No video set: the section is removed, never a placeholder.
export function videoEmbedUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (/^(m\.)?youtube(-nocookie)?\.com$/.test(host)) id = u.searchParams.get("v") || (u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/) || [])[2];
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(\d{6,})(?:\/([0-9a-f]{6,}))?/);
    if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1${m[2] ? `&h=${m[2]}` : ""}`;
  }
  return null;
}
export function featuredVideo() {
  const v = D.site.video;
  const src = v && videoEmbedUrl(v.url);
  if (!src) return EMPTY_SECTION;
  const title = v.title || "Faith Works in action";
  const poster = v.poster || "/assets/images/masterclass-room-960.webp";
  return `<div class="video" data-reveal>
        <button type="button" class="video__play" data-video-embed="${esc(src)}" data-video-title="${esc(title)}">
          <img src="${esc(poster)}" alt="" loading="lazy" decoding="async">
          <span class="video__badge"><span class="video__icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M8 5.5v13l10.5-6.5z"/></svg></span><span>Play video<span class="sr-only">: ${esc(title)}</span></span></span>
        </button>
        <p class="video__note">Plays from ${/vimeo/.test(src) ? "Vimeo" : "YouTube"} when you press play.</p>
      </div>`;
}

// "Book a call" (Calendly). Only when Site settings has a booking link. A Calendly link opens the
// scheduler in a dialog, loaded on demand (js/main.js §13); any other link opens in a new tab.
// The form beside it stays the main way to reach us.
let bookingDialogs = 0;
export function bookingCall(context) {
  const url = D.site.bookingUrl;
  if (!url) return "";
  let u;
  try { u = new URL(url); } catch { return ""; }
  const label = context === "business" ? "Prefer to talk first? Book a discovery call" : "Prefer to talk? Book a call";
  if (!/(^|\.)calendly\.com$/.test(u.hostname)) {
    return `<p class="booking"><a class="text-link" href="${esc(url)}" target="_blank" rel="noopener" data-track="booking_open">${label} <span class="link-arrow" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></p>`;
  }
  const id = `booking-${++bookingDialogs}`;
  u.searchParams.set("embed_type", "Inline");
  u.searchParams.set("hide_gdpr_banner", "1");
  return `<div class="booking">
        <a class="btn btn--light booking__open" href="${esc(url)}" target="_blank" rel="noopener" data-booking="${esc(u.toString())}" aria-controls="${id}" aria-haspopup="dialog">${label}</a>
        <p class="booking__note">Scheduling is handled by Calendly. Read our <a class="inline" href="${esc(D.site.privacyUrl || "/privacy/")}">Privacy Notice</a>.</p>
        <dialog class="booking__dialog" id="${id}" aria-label="Book a call">
          <div class="booking__head"><p>Book a call</p><button type="button" class="booking__close" data-booking-close aria-label="Close">×</button></div>
          <div class="booking__slot" data-booking-slot></div>
        </dialog>
      </div>`;
}

// AI agents, coordinated: one process in the middle, the agents that each take one part of it,
// and the person who approves before anything goes out. Static SVG + CSS; signals travel the
// wires only with motion allowed. `variant` "faith-ai" uses the Build page's own examples.
export function agentNetwork(variant) {
  const nodes = variant === "faith-ai"
    ? [["Inquiry tracking", "Logs each new lead", "a"], ["Follow-up", "Drafts the next message", "b"], ["Internal answers", "Finds it in your notes", "c"]]
    : [["Research", "Gathers approved sources", "a"], ["Draft", "Writes a first version", "b"], ["Follow-up", "Prepares the next step", "c"]];
  const hub = variant === "faith-ai" ? "Your business process" : "Your workflow";
  const wires = ["M300 180 C 230 180, 200 64, 128 64", "M300 180 H128", "M300 180 C 230 180, 200 296, 128 296"];
  return `<figure class="agents" data-reveal>
        <div class="agents__canvas" role="img" aria-label="Diagram: ${esc(hub)} in the centre coordinates three AI agents (${nodes.map((n) => esc(n[0])).join(", ")}). Their work meets at a human review step before anything is sent.">
          <svg class="agents__wires" viewBox="0 0 600 360" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            ${wires.map((d) => `<path class="agents__wire" d="${d}"/>`).join("")}
            <path class="agents__wire agents__wire--out" d="M300 180 H472"/>
            ${wires.map((d, i) => `<circle class="agents__signal" r="4"><animateMotion dur="3.6s" begin="${(i * 1.2).toFixed(1)}s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path="${d}"/></circle>`).join("")}
            <circle class="agents__signal agents__signal--out" r="4.5"><animateMotion dur="2.4s" begin="0.6s" repeatCount="indefinite" path="M300 180 H472"/></circle>
          </svg>
          ${nodes.map(([name, job, tone], i) => `<div class="agents__node agents__node--${tone}" style="--n:${i}"><span class="agents__chip" aria-hidden="true">AI</span><span class="agents__txt"><b>${esc(name)}</b><small>${esc(job)}</small></span></div>`).join("\n          ")}
          <div class="agents__hub"><span class="agents__pulse" aria-hidden="true"></span><small>Coordinates</small><b>${esc(hub)}</b></div>
          <div class="agents__human"><span class="agents__seal" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.5 10 17.5 19 7"/></svg></span><span class="agents__txt"><b>You approve</b><small>before anything is sent</small></span></div>
        </div>
        <figcaption class="agents__cap">Illustrative. Each agent takes one part of the work; a person stays in charge of the result.</figcaption>
      </figure>`;
}

/* ---- Site settings ----------------------------------------------------- */
export const contactPhone = () => D.site.contactPhone ? `<p>Phone: <a class="text-link" href="tel:${esc(D.site.contactPhone.replace(/[^0-9+]/g, ""))}">${esc(D.site.contactPhone)}</a></p>` : "";
export const contactEmail = () => `<a class="text-link" href="mailto:${esc(D.site.contactEmail)}">${esc(D.site.contactEmail)}</a>`;
export const communityLink = (label) => `<a class="btn" href="${esc(D.site.community.url)}" target="_blank" rel="noopener" data-track="community_click">Join the Faith Works Community <span class="btn__arrow" aria-hidden="true">↗</span><span class="sr-only"> (opens Facebook in a new tab)</span></a>`;
export const socialList = () => `<ul class="social">${D.site.social.map((s) => `<li>${ext(s.url, s.label)}</li>`).join("")}</ul>`;
export const responseTime = () => D.site.responseTime ? esc(D.site.responseTime) : "We reply as soon as we can. A response time will be shown here once it is agreed.";
export const starterKitNotice = () => D.site.starterKitReady === false
  ? `<div class="notice notice--draft" role="note"><strong>Kit in production.</strong> This page shows the planned kit. It must not receive public traffic until the final kit, Privacy Notice and delivery email are ready.</div>` : "";

/* ---- Forms ------------------------------------------------------------- */
// Shared markup for every lead form; js/main.js adds validation, hidden context
// (source page, UTMs, timestamp, request ID, consent) and the submit states.
const CONSENT = "Send me practical AI tips and updates about Faith Works programs. I can unsubscribe anytime.";

function field(form, f) {
  const id = `${form}-${f.name}`;
  const req = f.required !== false;
  const label = `<label for="${id}">${esc(f.label)}${req ? "" : ' <span class="opt">(optional)</span>'}</label>`;
  const hint = f.hint ? `<p class="field__hint" id="${id}-hint">${esc(f.hint)}</p>` : "";
  const described = `${f.hint ? `${id}-hint ` : ""}${id}-error`;
  const common = `id="${id}" name="${f.name}"${req ? " required" : ""} aria-describedby="${described}"${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ""}`;
  let control;
  if (f.type === "select") {
    control = `<select ${common}><option value="">${esc(f.placeholder || "Choose one")}</option>${(f.options === "events" ? eventOptions() : f.options.map((o) => typeof o === "string" ? `<option>${esc(o)}</option>` : `<option value="${esc(optionValue(o))}">${esc(o.label)}</option>`).join(""))}</select>`;
  } else if (f.type === "textarea") {
    control = `<textarea ${common} rows="${f.rows || 4}" maxlength="${f.maxlength || 3000}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}></textarea>`;
  } else {
    control = `<input ${common} type="${f.type || "text"}" maxlength="${f.maxlength || 160}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}${f.inputmode ? ` inputmode="${f.inputmode}"` : ""}${f.min ? ` min="${f.min}"` : ""}>`;
  }
  return `<div class="field${f.half ? " field--half" : ""}">${label}${hint}${control}<p class="field__error" id="${id}-error" hidden></p></div>`;
}

function form({ key, offer, offerTitle, purpose, button, fields, consent = true, success, redirect, extra = "" }) {
  return `<form class="form" data-fw-form="${key}" data-offer-id="${esc(offer)}" data-offer-title="${esc(offerTitle)}" data-success="${esc(success)}"${redirect ? ` data-redirect="${redirect}"` : ""} novalidate>
      <div class="form__summary" role="alert" tabindex="-1" hidden></div>
      <p class="form__note">All fields are required unless marked optional.</p>
      <div class="form__grid">${fields.map((f) => field(key, f)).join("")}</div>
      ${extra}
      <div class="hp" aria-hidden="true"><label for="${key}-website">Leave this field empty</label><input id="${key}-website" name="website" tabindex="-1" autocomplete="off"></div>
      ${consent ? `<div class="check"><input type="checkbox" id="${key}-consent" name="consent_marketing" value="yes"><label for="${key}-consent">${CONSENT}</label></div>` : ""}
      <p class="form__privacy">We will use your details to ${purpose}. Read our <a href="/privacy/">Privacy Notice</a>.</p>
      <button class="btn btn--full form__submit" type="submit"><span class="form__label">${esc(button)}</span><span class="btn__arrow" aria-hidden="true">↗</span></button>
      <div class="form__status" role="status" aria-live="polite"></div>
    </form>`;
}

function ghlFormEmbed({ id, title, height = 540 }) {
  return `<div class="form form--ghl" style="width:100%;min-height:${height}px;">
      <iframe
        src="https://api.faithph.ai/widget/form/${id}"
        style="width:100%;height:100%;min-height:${height}px;border:none;border-radius:4px"
        id="inline-${id}" 
        data-layout="{'id':'INLINE'}"
        data-trigger-type="alwaysShow"
        data-trigger-value=""
        data-activation-type="alwaysActivated"
        data-activation-value=""
        data-deactivation-type="neverDeactivate"
        data-deactivation-value=""
        data-form-name="${esc(title)}"
        data-height="${height}"
        data-layout-iframe-id="inline-${id}"
        data-form-id="${id}"
        title="${esc(title)}">
      </iframe>
      <script src="https://api.faithph.ai/js/form_embed.js"></script>
    </div>`;
}

export function starterKitForm() {
  return ghlFormEmbed({
    id: "mhloeEueDRLExO5Ct7Xw",
    title: "Free AI Workflow Starter Kit",
    height: 520,
  });
}

export function programForm(p) {
  return ghlFormEmbed({
    id: "AIe91j9ZF3bfizhBoHxX",
    title: `Program Inquiry / Waitlist${p?.title ? ` - ${p.title}` : ""}`,
    height: 580,
  });
}

export function proposalForm() {
  return ghlFormEmbed({
    id: "ftpaEhfFmT2XnE2NrViH",
    title: "Corporate AI Training Proposal",
    height: 720,
  });
}

export function speakingForm() {
  return ghlFormEmbed({
    id: "sXxldcFIY3RFN6iA71NL",
    title: "Speaking or Partnership Inquiry",
    height: 760,
  });
}

export function demoForm() {
  return ghlFormEmbed({
    id: "GTRLqxCYYA2fkVwxrhZU",
    title: "Build with AI Demo Request",
    height: 600,
  });
}

export function contactForm() {
  return ghlFormEmbed({
    id: "R7hcPDBmFdJBEiUyOqpK",
    title: "General Inquiry",
    height: 760,
  });
}

export function notifyForm() {
  return ghlFormEmbed({
    id: "5UInnuA6YOOqEt09Vl7J",
    title: "Workshops and Events Notification",
    height: 500,
  });
}
