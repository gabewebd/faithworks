// Content renderers for tools/build.mjs. A page source calls one with {{name}} or {{name:arg}}.
// Content comes from the CMS (tools/content.mjs). Program, event, resource and testimonial pages
// are page documents (cms/shared/page-doc.mjs): this file fills in the values Details controls
// and the parts only the website can generate (forms, lists of other pages).
import { esc } from "./layout.mjs";
import {
  badge, tbc, list, extLink as ext, img, preview, eventCta, eventStatus, isPastEvent, programCtaLabel,
  applyBindings, bindingValues, fillComponents, recordComponent, tzAbbrev,
} from "../cms/shared/page-doc.mjs";
export { img, preview };

let D;
export function init(data) { D = data; }

const today = new Date();

/* ---- Helpers ----------------------------------------------------------- */
// Calendar dates are formatted at noon UTC, so the day never shifts with a time zone.
function eventDate(e) {
  if (!e.date) return null;
  return new Date(`${e.date}T12:00:00Z`);
}
function fmt(d, opts) { return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", ...opts }).format(d); }
const isPast = (e) => isPastEvent(e.rec, today);

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

// Home: the open-track programs as static horizontal cards, each on its own filled surface
// (White outlined in Charcoal, Faith Pink, AI Yellow) with a cover plate in a contrasting brand colour. Each cover
// is drawn for its program: what a learner builds, as one composed picture. The caption on the
// plate names those steps in plain words.
const PROGRAM_COVER = {
  // One task picked from the pile, designed into an AI-assisted workflow, then tested and refined
  "ai-workforce-accelerator": {
    tone: "white", steps: "Map · Design · Prototype",
    svg: `<rect class="pc__ln" x="20" y="54" width="96" height="22" rx="6"/><path class="pc__ln pc__soft" d="M31 65 H74"/>
      <rect class="pc__ink" x="20" y="86" width="96" height="22" rx="6"/><path class="pc__ln pc__ln--on" d="M31 97 H70"/><circle class="pc__yel" cx="103" cy="97" r="5"/>
      <rect class="pc__ln" x="20" y="118" width="96" height="22" rx="6"/><path class="pc__ln pc__soft" d="M31 129 H80"/>
      <rect class="pc__ln" x="20" y="150" width="96" height="22" rx="6"/><path class="pc__ln pc__soft" d="M31 161 H66"/>
      <path class="pc__ln" d="M116 97 H150"/>
      <rect class="pc__ink" x="150" y="28" width="150" height="184" rx="16"/>
      <text class="pc__type pc__type--yel" x="225" y="100" text-anchor="middle">[ AI ]</text>
      <path class="pc__ln pc__ln--on pc__soft" d="M191 148 H214 M236 148 H259"/>
      <circle class="pc__ln pc__ln--on" cx="180" cy="148" r="11"/>
      <circle class="pc__pink" cx="225" cy="148" r="11"/>
      <circle class="pc__yel" cx="270" cy="148" r="11"/><path class="pc__ln pc__ln--ink" d="M265 148.5 L268.5 152 L275 145"/>
      <path class="pc__ln pc__ln--on pc__soft" d="M270 167 Q270 186 251 186 H199 Q180 186 180 167 M174.5 173 L180 166.5 L185.5 173"/>`,
  },
  // Your profile, assisted by AI, reaching the clients you want to work with
  "ai-linkedin-b2b-growth": {
    tone: "pink", steps: "Position · Publish · Follow up",
    svg: `<path class="pc__ln pc__ln--on pc__faint" d="M156 124 L232 58 M156 124 L222 128 M156 124 L284 164 M156 124 L238 196 M156 124 L190 204"/>
      <path class="pc__ln pc__ln--pink" d="M156 124 L276 94"/>
      <circle class="pc__ln pc__ln--on pc__node" cx="232" cy="58" r="6"/><circle class="pc__ln pc__ln--on pc__node" cx="222" cy="128" r="5"/>
      <circle class="pc__ln pc__ln--on pc__node" cx="284" cy="164" r="6"/><circle class="pc__ln pc__ln--on pc__node" cx="238" cy="196" r="5"/>
      <circle class="pc__ln pc__ln--on pc__node" cx="190" cy="204" r="4"/>
      <circle class="pc__pink" cx="276" cy="94" r="11"/>
      <rect class="pc__white" x="34" y="66" width="122" height="122" rx="22"/>
      <text class="pc__type pc__type--in" x="95" y="160" text-anchor="middle">in</text>
      <circle class="pc__yel pc__cut" cx="152" cy="68" r="30"/>
      <text class="pc__type pc__type--ai" x="152" y="76" text-anchor="middle">AI</text>`,
  },
  // A landing page whose form feeds a simple lead tracker
  "ai-websites-workflow-building": {
    tone: "yellow", steps: "Page · Tracker · Review",
    svg: `<rect class="pc__paper" x="18" y="30" width="176" height="160" rx="12"/>
      <path class="pc__ln" d="M18 52 H194"/><circle class="pc__pink" cx="32" cy="41" r="3.5"/><circle class="pc__yel" cx="44" cy="41" r="3.5"/><circle class="pc__ln" cx="56" cy="41" r="3"/>
      <rect class="pc__ink" x="34" y="68" width="104" height="13" rx="3"/>
      <path class="pc__ln pc__soft" d="M34 94 H150 M34 105 H124"/>
      <rect class="pc__ln" x="34" y="120" width="92" height="16" rx="4"/>
      <rect class="pc__pink" x="34" y="146" width="62" height="22" rx="6"/><path class="pc__ln" d="M44 157 H76"/>
      <path class="pc__ln" d="M96 157 C 128 157, 138 108, 166 108"/><path class="pc__ln" d="M160 102 L167 108 L160 114"/>
      <rect class="pc__ink" x="176" y="66" width="128" height="148" rx="14"/>
      <text class="pc__label" x="192" y="94">Leads</text>
      <rect class="pc__yel" x="186" y="104" width="108" height="24" rx="6"/><path class="pc__ln pc__ln--ink" d="M196 116 H236"/><circle class="pc__ink" cx="280" cy="116" r="4"/>
      <path class="pc__ln pc__ln--on pc__soft" d="M196 146 H240 M196 172 H232 M196 198 H246"/>
      <rect class="pc__pink" x="262" y="140" width="24" height="12" rx="6"/><rect class="pc__white" x="262" y="166" width="24" height="12" rx="6"/><rect class="pc__pink" x="262" y="192" width="24" height="12" rx="6"/>`,
  },
};
export function programRowsHome() {
  const picks = D.programs.filter((p) => PROGRAM_COVER[p.slug]);
  return `<ol class="pstack">${picks.map((p, i) => {
    const { tone, steps, svg } = PROGRAM_COVER[p.slug];
    const cta = ctaFor(p);
    const external = /^https?:/i.test(p.rec.cta_url || "");
    const ctaUrl = external ? p.rec.cta_url : `/programs/${p.slug}/#register`;
    return `
      <li class="prog prog--${tone}" style="--i:${i}" data-reveal>
        <article class="prog__card" aria-labelledby="prog-${p.slug}">
          <div class="prog__cover">
            <svg viewBox="0 0 320 240" aria-hidden="true" focusable="false">${svg}</svg>
            <p class="prog__steps">${esc(steps).replace(/ · /g, "&nbsp;· ")}</p>
          </div>
          <div class="prog__main">
            <p class="prog__cat">${esc(p.category)}</p>
            <h3 class="prog__title" id="prog-${p.slug}"><a href="/programs/${p.slug}/" data-track="program_click">${esc(p.title)}</a></h3>
            <p class="prog__summary">${esc(p.summary)}</p>
          </div>
          <div class="prog__side">
            <p class="prog__leave">You leave with</p>
            ${list(p.outputs, "prog__outs")}
            <div class="prog__actions">
              <a class="btn prog__btn" href="/programs/${p.slug}/" data-track="program_click">See the program <span class="btn__arrow" aria-hidden="true">↗</span></a>
              <a class="text-link" href="${esc(ctaUrl)}"${external ? ' target="_blank" rel="noopener"' : ""} data-track="program_click">${esc(cta)} <span class="link-arrow" aria-hidden="true">↗</span>${external ? '<span class="sr-only"> (opens in a new tab)</span>' : ""}</a>
            </div>
            ${p.statusLabel && p.statusLabel !== cta ? `<p class="prog__status">${esc(p.statusLabel)}</p>` : ""}
          </div>
        </article>
      </li>`;
  }).join("")}
    </ol>`;
}

// Learn: the full program index, every program with audience, outcomes, format, requirements and status (brief §2)
export function programCards() {
  return `<div class="pcards">${D.programs.map((p) => `
      <article class="pcard pcard--${p.tone}" id="${p.slug}">
        <div class="pcard__head">
          <p class="pcard__cat">${esc(p.category)}</p>
          ${badge(p.statusKey, p.statusLabel)}
        </div>
        <h3 class="pcard__title"><a href="/programs/${p.slug}/" data-track="program_click">${esc(p.title)}</a></h3>
        <p class="pcard__summary">${esc(p.summary)}</p>
        <dl class="pcard__facts">
          <div><dt>For</dt><dd>${esc(p.audience.join(" · "))}</dd></div>
          <div><dt>Outcomes</dt><dd>${esc(p.outputs.join(" · "))}</dd></div>
          <div><dt>Format</dt><dd>${tbc(p.format)}</dd></div>
          <div><dt>You need</dt><dd>${esc(p.requirements.join(" · "))}</dd></div>
        </dl>
        <a class="btn btn--light pcard__cta" href="/programs/${p.slug}/" data-track="program_click">View program details <span class="btn__arrow" aria-hidden="true">↗</span></a>
      </article>`).join("")}
    </div>`;
}

export function programPage(p) {
  if (!p.doc) return null;
  const others = D.programs.filter((o) => o.slug !== p.slug);
  const body = docBody(p, "programs", {
    "program-form": () => programForm(p),
    "other-programs": () => others.map((o) => `<li><a href="/programs/${o.slug}/" data-track="program_click"><span>${esc(o.title)}</span>${badge(o.statusKey, o.statusLabel)}</a></li>`).join(""),
  });
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

// An event card: what, when and where, the registration button (when there is one) and an
// "Event details" link when the event has its own page and the button goes elsewhere.
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
  const details = e.hasPage && e.registration.type !== "page" ? `<a class="text-link" href="/events/${esc(e.slug)}/">Event details <span class="link-arrow" aria-hidden="true">↗</span></a>` : "";
  const pastPage = past && e.hasPage && e.registration.type === "page" ? `<a class="text-link" href="/events/${esc(e.slug)}/">Event details <span class="link-arrow" aria-hidden="true">↗</span></a>` : "";
  const actions = cta + details + pastPage;
  return `<article class="event${past ? " event--past" : ""}" id="event-${esc(e.slug)}">
      <div class="event__date" aria-hidden="true">${d ? `<b>${fmt(d, { day: "numeric" })}</b><span>${fmt(d, { month: "short" })} ${fmt(d, { year: "numeric" })}</span>` : `<b>TBA</b><span>Date soon</span>`}</div>
      <div class="event__body">
        <p class="event__type">${badge(eventStatus(e.rec, today))}</p>
        <h3>${esc(e.title)}</h3>
        ${e.summary ? `<p>${esc(e.summary)}</p>` : ""}
        <dl class="event__facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        ${actions ? `<div class="event__cta">${actions}</div>` : ""}
      </div>
      ${e.image ? `<figure class="event__img">${eventImg(e.image)}</figure>` : ""}
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
      ? `<p class="empty">No past events listed yet.</p>`
      : `<div class="empty"><p><strong>No dates are confirmed right now.</strong> Get notified when the next workshop opens.</p><a class="btn" href="/workshops/#notify">Get notified</a></div>`;
  }
  return `<div class="events">${set.map(eventCard).join("")}</div>`;
}
export function eventOptions() {
  return D.events.filter((e) => !isPast(e)).sort(byStart).map((e) => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join("");
}

// The data behind the Workshops calendar (js/main.js draws it) and /events/calendar.json.
// Only what the website shows anyway: published, visible events with a date.
export function calendarData() {
  return D.events.filter((e) => e.date).sort(byStart).map((e) => {
    const past = isPast(e);
    const r = e.registration;
    const url = e.hasPage ? `/events/${e.slug}/` : !past && r.type === "external" && r.url ? r.url : `/workshops/#event-${e.slug}`;
    return { id: e.slug, title: e.title, start: e.start, end: e.end, timeZone: e.timeZone, allDay: !e.rec.start_time, time: e.time ? `${e.time} ${tzAbbrev(e.timeZone)}` : null, location: e.venue, url, external: /^https?:/i.test(url), past };
  });
}
// <script type="application/json"> is inert; "<" is escaped so no text can close the element.
export function eventCalendar() {
  const json = JSON.stringify(calendarData()).replace(/</g, "\\u003c");
  return `<div class="cal" data-fw-calendar>
        <div class="cal__head">
          <button class="cal__nav" type="button" data-cal-prev aria-label="Previous month">‹</button>
          <h3 class="cal__title" data-cal-title aria-live="polite"></h3>
          <button class="cal__nav" type="button" data-cal-next aria-label="Next month">›</button>
        </div>
        <div class="cal__grid" data-cal-grid></div>
        <p class="cal__empty small" data-cal-empty hidden>No events this month.</p>
        <noscript><p class="small">The calendar needs JavaScript. Every event is listed below.</p></noscript>
        <script type="application/json" data-cal-data>${json}</script>
      </div>`;
}

/* ---- Resources and articles -------------------------------------------- */
export function resourceList() {
  return `<div class="rlist">${D.resources.map((r) => {
    const attrs = r.hasPage ? "" : r.access === "download" ? ` download data-track="download_click"` : r.access === "external" ? ` target="_blank" rel="noopener"` : ` data-track="starter_kit_click"`;
    const down = !r.hasPage && r.access === "download";
    return `<article class="rlist__item${r.featured ? " rlist__item--featured" : ""}">
        <p class="rlist__kind">${esc(r.kind)}</p>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.summary)}</p>
        <p class="rlist__access">${esc(r.accessLabel || "")}</p>
        <a class="btn${r.featured ? "" : " btn--light"}" href="${esc(r.hasPage ? `/resources/${r.slug}/` : r.url)}"${attrs}>${esc(r.ctaLabel)} <span class="btn__arrow${down ? " btn__arrow--down" : ""}" aria-hidden="true">${down ? "↓" : "↗"}</span></a>
      </article>`;
  }).join("")}</div>`;
}

export function articleCards(limit) {
  const items = [...D.articles].sort((a, b) => b.date.localeCompare(a.date)).slice(0, Number(limit) || 99);
  return `<div class="acards">${items.map((a) => `
      <article class="acard">
        <a class="acard__link" href="/resources/${a.slug}/">
          ${img(a.image, "(min-width: 900px) 33vw, 100vw", "acard__img")}
          <span class="acard__meta">${esc(a.category)} · ${esc(a.readTime)}</span>
          <h3>${esc(a.title)}</h3>
          <span class="acard__excerpt">${esc(a.excerpt)}</span>
        </a>
      </article>`).join("")}
    </div>`;
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

const relatedArticles = (slug) => D.articles.filter((x) => x.slug !== slug).slice(0, 3)
  .map((r) => `<li><a href="/resources/${r.slug}/"><span>${esc(r.title)}</span><span class="small">${esc(r.readTime)}</span></a></li>`).join("");

export function articlePage(a) {
  if (!a.doc) return null;
  const body = docBody(a, "resources", { "related-articles": () => relatedArticles(a.slug) });
  return {
    title: a.seoTitle || `${a.title} · Faith Works`, description: a.metaDescription || a.excerpt, path: `/resources/${a.slug}/`, nav: "resources", body,
    image: a.socialImage || (a.image?.base ? `/${a.image.base}-1440.jpg` : a.image?.url), ...pageFrame(a),
  };
}
// Guides, templates and other downloads have a page only when their page editor has content.
export function resourcePage(r) {
  if (!r.doc) return null;
  const body = docBody(r, "resources", { "related-articles": () => relatedArticles(r.slug) });
  return {
    title: r.seoTitle || `${r.title} · Faith Works`, description: r.metaDescription || r.summary, path: `/resources/${r.slug}/`, nav: "resources", body,
    image: r.socialImage || r.image?.url, ...pageFrame(r),
  };
}

/* ---- Proof ------------------------------------------------------------- */
// A renderer with nothing to show returns this marker; tools/build.mjs then removes the
// enclosing <section> so no empty heading is published (brief §2: hide empty sections).
export const EMPTY_SECTION = "<!--fw:empty-section-->";
// Published testimonials set to "Show on the website", each in its chosen card colour.
export function testimonials(limit) {
  const pick = D.stories.filter((s) => s.quote && s.name).slice(0, Number(limit) || 3);
  if (!pick.length) return EMPTY_SECTION;
  return `<div class="quotes">${pick.map((s) => `
      ${storyCard(s)}`).join("")}
    </div>`;
}
const TONES = new Set(["pink", "yellow", "stone", "ink"]);
export function storyCard(s) {
  const tone = TONES.has(s.tone) ? s.tone : "pink";
  // The name is right beside the photo, so the photo itself needs no description (alt="").
  const photo = s.photo ? `<img class="quote__photo" src="${esc(s.photo)}" alt="" width="48" height="48" loading="lazy" decoding="async">` : "";
  return `<figure class="quote quote--${tone}">
        <blockquote><p>${esc(s.quote)}</p></blockquote>
        <figcaption class="quote__by">${photo}<span class="quote__name">${esc(s.name)}</span></figcaption>
      </figure>`;
}

// Home: every published testimonial in a looping, stacked carousel (js/main.js §12). Without JS
// the cards sit in a row you can scroll. The speaker is named exactly as given; "Faith Works
// participant" is all that is claimed about them (they wrote it after a session).
// Faith Pink is this section's one accent, so the stack alternates light pink and white cards
// (both with Pink quote marks) whatever colour a story has elsewhere. No grey or charcoal slabs.
const voiceTone = (i) => (i % 2 ? "white" : "pink");
const initials = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
export function voices() {
  const pick = D.stories.filter((s) => s.quote && s.name);
  if (!pick.length) return EMPTY_SECTION;
  const n = pick.length;
  const slides = pick.map((s, i) => {
    const tone = voiceTone(i);
    const face = s.photo
      ? `<img class="voice__photo" src="${esc(s.photo)}" alt="" width="44" height="44" loading="lazy" decoding="async">`
      : `<span class="voice__initials" aria-hidden="true">${esc(initials(s.name))}</span>`;
    return `
        <figure class="voice voice--${tone}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}" data-pos="${i}">
          <blockquote><p>${esc(s.quote)}</p></blockquote>
          <figcaption>${face}<span><b class="voice__name">${esc(s.name)}</b><span class="voice__role">Faith Works participant</span></span></figcaption>
        </figure>`;
  }).join("");
  const dots = pick.map((s, i) => `<button type="button" class="voices__dot" data-carousel-dot aria-current="${i === 0}" aria-label="Show testimonial ${i + 1}: ${esc(s.name)}"></button>`).join("");
  return `<div class="voices" data-carousel role="region" aria-roledescription="carousel" aria-label="What participants said">
      <div class="voices__stage">${slides}
      </div>
      <div class="voices__controls">
        <button type="button" class="voices__btn" data-carousel-prev aria-label="Previous testimonial"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="voices__dots">${dots}</div>
        <button type="button" class="voices__btn" data-carousel-next aria-label="Next testimonial"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg></button>
        <button type="button" class="voices__btn voices__btn--toggle" data-carousel-toggle aria-pressed="false" aria-label="Pause the testimonials"><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6v12M15 6v12"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z"/></svg></button>
      </div>
      <p class="sr-only" aria-live="polite" data-carousel-live></p>
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
        <a class="btn btn--light booking__open" href="${esc(url)}" target="_blank" rel="noopener" data-booking="${esc(u.toString())}" aria-controls="${id}" aria-haspopup="dialog">${label} <span class="btn__arrow" aria-hidden="true">↗</span></a>
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
// Shared markup for every lead form; js/forms.js adds validation, hidden context
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
    control = `<select ${common}><option value="">${esc(f.placeholder || "Choose one")}</option>${f.options.map((o) => typeof o === "string" ? `<option>${esc(o)}</option>` : o.raw).join("")}</select>`;
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

const ROLES = ["Founder/Business Owner", "Professional/Freelancer", "Team/HR Leader", "Other"];

export function starterKitForm() {
  return form({
    key: "starter_kit", offer: "ai-workflow-starter-kit", offerTitle: "AI Workflow Starter Kit",
    purpose: "deliver the kit you requested", button: "Send Me the Free Starter Kit",
    success: "Your starter kit is ready.", redirect: "/free-ai-starter-kit/thank-you/",
    fields: [
      { name: "first_name", label: "First name", autocomplete: "given-name", maxlength: 80 },
      { name: "email", label: "Email address", type: "email", autocomplete: "email", inputmode: "email" },
      { name: "role", label: "Your role", type: "select", required: false, options: ROLES },
    ],
    extra: `<input type="hidden" name="lead_magnet_version" value="v1.0-draft">`,
  });
}

export function programForm(p) {
  return form({
    key: "program_interest", offer: p.slug, offerTitle: p.title,
    purpose: `contact you about ${p.title}`, button: ctaFor(p),
    success: `You’re on the list for ${p.title}. We will email you when dates, fees and inclusions are confirmed.`,
    fields: [
      { name: "first_name", label: "First name", autocomplete: "given-name", maxlength: 80, half: true },
      { name: "email", label: "Email address", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "role", label: "Your role", type: "select", required: false, options: ROLES },
      { name: "goal", label: "What would you like to improve?", type: "textarea", required: false, rows: 3, placeholder: "One task or outcome that matters to you" },
    ],
  });
}

export function proposalForm() {
  return form({
    key: "corporate_inquiry", offer: "corporate-training", offerTitle: "Corporate AI training",
    purpose: "respond to your inquiry", button: "Request a proposal", consent: true,
    success: "Thank you. We have your request for corporate training and will be in touch about next steps.",
    fields: [
      { name: "name", label: "Name", autocomplete: "name", half: true },
      { name: "email", label: "Work email", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "company", label: "Company", autocomplete: "organization", half: true },
      { name: "job_role", label: "Your role", autocomplete: "organization-title", half: true },
      { name: "team_size", label: "Team size", type: "select", options: ["2–10", "11–50", "51–200", "200+"], half: true },
      { name: "format", label: "Preferred format", type: "select", required: false, options: ["Open to a recommendation", "Online", "In person", "Hybrid"], half: true },
      { name: "goals", label: "What are your goals for your team?", type: "textarea", rows: 4 },
      { name: "preferred_date", label: "Preferred date or timing", required: false, half: true, placeholder: "For example, Q1 2027" },
      { name: "budget", label: "Budget range", required: false, half: true, placeholder: "A range is fine" },
    ],
  });
}

export function speakingForm() {
  return form({
    key: "speaking_inquiry", offer: "speaking-partnerships", offerTitle: "Speaking or partnership",
    purpose: "respond to your inquiry", button: "Send booking inquiry",
    success: "Thank you. We have your event details and will come back with a tailored proposal.",
    fields: [
      { name: "organization", label: "Organization", autocomplete: "organization", half: true },
      { name: "name", label: "Contact name", autocomplete: "name", half: true },
      { name: "email", label: "Email", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "event_name", label: "Event name", half: true },
      { name: "event_date", label: "Event date", type: "date", half: true },
      { name: "location", label: "Location", placeholder: "City and venue, or online", half: true },
      { name: "audience_size", label: "Audience size", type: "number", inputmode: "numeric", min: "1", half: true },
      { name: "requested_format", label: "Requested format", type: "select", half: true, options: ["Learn with Faith (workshop or training)", "Hear from Faith (keynote or talk)", "Partner with Faith (brand partnership)", "Not sure yet"] },
      { name: "audience_profile", label: "Who is the audience?", type: "textarea", rows: 3 },
      { name: "budget", label: "Budget", required: false, placeholder: "A range is fine" },
    ],
  });
}

export function demoForm() {
  return form({
    key: "faith_ai_demo", offer: "faith-ai-discovery", offerTitle: "Faith AI demo",
    purpose: "arrange your demo", button: "Request a Demo",
    success: "Thank you. We have your demo request and will contact you to arrange a time.",
    fields: [
      { name: "name", label: "Name", autocomplete: "name", half: true },
      { name: "email", label: "Work email", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "company", label: "Company", autocomplete: "organization" },
      { name: "use_case", label: "Which business process needs support?", type: "textarea", rows: 3, placeholder: "For example, inquiry tracking or follow-up" },
      { name: "tools", label: "Tools you use today", required: false },
    ],
  });
}

export function contactForm() {
  return form({
    key: "general_contact", offer: "general-contact", offerTitle: "General inquiry",
    purpose: "respond to your inquiry", button: "Send message",
    success: "Thank you. We have your message and will route it to the right person.",
    fields: [
      { name: "name", label: "Name", autocomplete: "name", half: true },
      { name: "email", label: "Email", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "inquiry_type", label: "Inquiry type", type: "select", half: true, options: [
        { raw: '<option value="programs">Programs and workshops</option>' }, { raw: '<option value="corporate">Corporate training</option>' },
        { raw: '<option value="speaking">Speaking and partnerships</option>' }, { raw: '<option value="faith-ai">Faith AI</option>' },
        { raw: '<option value="other">Something else</option>' }] },
      { name: "phone", label: "Phone", type: "tel", autocomplete: "tel", required: false, half: true },
      { name: "message", label: "Message", type: "textarea", rows: 5 },
    ],
  });
}

export function notifyForm() {
  return form({
    key: "event_notify", offer: "event-notify", offerTitle: "New workshop dates",
    purpose: "tell you about new dates for the events you choose", button: "Notify me",
    success: "Thank you. We will email you when new dates are confirmed.",
    fields: [
      { name: "first_name", label: "First name", autocomplete: "given-name", maxlength: 80, half: true },
      { name: "email", label: "Email address", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "event_interest", label: "Tell me about", type: "select", required: false, placeholder: "Any upcoming workshop or event", options: [{ raw: eventOptions() }] },
    ],
  });
}
