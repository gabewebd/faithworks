// Content renderers for tools/build.mjs. A page source calls one with {{name}} or {{name:arg}}.
// Content comes from the CMS (tools/content.mjs). Program, event, resource and testimonial pages
// are page documents (cms/shared/page-doc.mjs): this file fills in the values Details controls
// and the parts only the website can generate (forms, lists of other pages).
import { esc } from "./layout.mjs";
import {
  badge, tbc, list, extLink as ext, img, preview, eventCta, isPastEvent, programCtaLabel,
  applyBindings, bindingValues, fillComponents, recordComponent,
} from "../cms/shared/page-doc.mjs";
export { img, preview };

let D;
export function init(data) { D = data; }

const TZ = "Asia/Manila";
const today = new Date();

/* ---- Helpers ----------------------------------------------------------- */
function eventDate(e) {
  if (!e.date) return null;
  return new Date(`${e.date}T12:00:00+08:00`);
}
function fmt(d, opts) { return new Intl.DateTimeFormat("en-PH", { timeZone: TZ, ...opts }).format(d); }
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

// Home: bento of the three open-track programs. One featured card (Charcoal panel) spans two rows;
// the other two sit beside it on solid Faith Pink and AI Yellow. Each colour panel carries a static
// example of what a learner actually produces; the white body says what you leave with.
const BENTO_TONE = { "ai-workforce-accelerator": "ink", "ai-linkedin-b2b-growth": "pink", "ai-websites-workflow-building": "yellow" };
// The approved homepage's typographic marks for each pathway
const BENTO_SYMBOL = { "ai-workforce-accelerator": "[ AI ]", "ai-linkedin-b2b-growth": "in ↗", "ai-websites-workflow-building": "↗_" };
// Each colour panel shows one short, simplified example of what a learner produces.
// Rows are [text, status, tone]; the tone colours the status chip, "picked" highlights the row.
const BENTO_ART = {
  "ai-workforce-accelerator": ["Pick one task to start", [["Weekly team update", "Start here", "picked"], ["Inquiry follow-up"], ["Client proposal"]]],
  "ai-linkedin-b2b-growth": ["A four-week content plan", [["Week 1 · A client question", "Reviewed", "pink"], ["Week 2 · A practical how-to", "Reviewed", "pink"], ["Week 3 · A recent lesson", "AI draft", "yellow"]]],
  "ai-websites-workflow-building": ["A simple lead tracker", [["New inquiry", "New", "pink"], ["Workshop question", "Follow up", "yellow"], ["Team proposal", "Done", "stone"]]],
};
function bentoArt(slug) {
  const [label, rows] = BENTO_ART[slug];
  return `<ul class="pick" aria-label="${esc(label)}">${rows.map(([t, chip, tone]) =>
    `<li${tone === "picked" ? ' class="is-picked"' : ""}>${esc(t)}${chip ? ` <span class="pick__chip pick__chip--${tone}">${esc(chip)}</span>` : ""}</li>`).join("")}</ul>`;
}
export function programRowsHome() {
  const picks = D.programs.filter((p) => BENTO_TONE[p.slug]);
  return `<div class="bento">${picks.map((p, i) => `
      <article class="bento__card bento__card--${BENTO_TONE[p.slug]}${i === 0 ? " bento__card--feature" : ""}">
        <div class="bento__art">
          <p class="bento__labels">${esc(p.category)}</p>
          <p class="bento__symbol" aria-hidden="true">${esc(BENTO_SYMBOL[p.slug])}</p>
          ${bentoArt(p.slug)}
        </div>
        <div class="bento__body">
          <h3><a href="/programs/${p.slug}/" data-track="program_click">${esc(p.title)}</a></h3>
          <p class="bento__summary">${esc(p.summary)}</p>
          <p class="bento__leave">You leave with</p>
          ${list(p.outputs, "ticks bento__list")}
          <div class="bento__foot">
            <a class="text-link" href="/programs/${p.slug}/" data-track="program_click">See the program <span class="link-arrow" aria-hidden="true">↗</span></a>
            ${badge(p.statusKey, p.statusLabel)}
          </div>
        </div>
      </article>`).join("")}
    </div>`;
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
const venue = (e, past) => tbc(e.venue, past ? "Not listed" : "To be confirmed") + (e.mapUrl ? ` · ${ext(e.mapUrl, "Map")}` : "");
const timeLabel = (e) => (e.timeZone && e.timeZone !== "Asia/Manila" ? `Time (${esc(e.timeZone)})` : "Time (Asia/Manila)");
const timeValue = (e, past) => (e.time ? esc(e.time) + (e.timeZone && e.timeZone !== "Asia/Manila" ? "" : " PHT") : '<span class="tbc">' + (past ? "Not listed" : "To be confirmed") + "</span>");
const eventImg = (im) => `<img src="${esc(im.src)}"${im.width && im.height ? ` width="${im.width}" height="${im.height}"` : ""} alt="${esc(im.alt)}" loading="lazy" decoding="async">`;

function eventCard(e) {
  const d = eventDate(e);
  const past = isPast(e);
  const status = past ? "past" : e.status;
  const when = d
    ? `<time datetime="${e.date}">${fmt(d, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</time>`
    : `<span>${esc(e.dateLabel || "Date to be announced")}</span>`;
  const cta = eventCta(e.rec, past);
  const program = e.programRef && D.programs.find((p) => p.slug === e.programRef);
  return `<article class="event${past ? " event--past" : ""}">
      <div class="event__date" aria-hidden="true">${d ? `<b>${fmt(d, { day: "numeric" })}</b><span>${fmt(d, { month: "short" })} ${fmt(d, { year: "numeric" })}</span>` : `<b>TBA</b><span>Date soon</span>`}</div>
      <div class="event__body">
        <p class="event__type">${esc(e.type)} ${badge(status)}</p>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.summary)}</p>
        <dl class="event__facts">
          <div><dt>Date</dt><dd>${when}</dd></div>
          <div><dt>${timeLabel(e)}</dt><dd>${timeValue(e, past)}</dd></div>
          <div><dt>Venue</dt><dd>${venue(e, past)}</dd></div>
          <div><dt>Format</dt><dd>${tbc(e.format)}</dd></div>
          <div><dt>Capacity</dt><dd>${tbc(e.capacity, past ? "Not listed" : "To be confirmed")}</dd></div>
        </dl>
        <div class="event__cta">${cta}${e.hasPage ? `<a class="text-link" href="/events/${esc(e.slug)}/">Event details <span class="link-arrow" aria-hidden="true">↗</span></a>` : ""}${program ? `<a class="text-link" href="/programs/${program.slug}/">About the program <span class="link-arrow" aria-hidden="true">↗</span></a>` : ""}</div>
      </div>
      ${e.image ? `<figure class="event__img">${eventImg(e.image)}${e.image.caption ? `<figcaption>${esc(e.image.caption)}</figcaption>` : ""}</figure>` : ""}
    </article>`;
}
export function eventPage(e) {
  if (!e.doc) return null;
  const past = isPast(e);
  const program = e.programRef && D.programs.find((p) => p.slug === e.programRef);
  const body = docBody(e, "events", {
    "event-actions": () => {
      const cta = eventCta(e.rec, past);
      return cta || program ? `${cta}${program ? `<a class="btn btn--light" href="/programs/${program.slug}/">About the program</a>` : ""}` : null;
    },
  });
  return {
    title: e.seoTitle || `${e.title} · Faith Works`,
    description: e.metaDescription || e.summary,
    path: `/events/${e.slug}/`,
    nav: "learn",
    body,
    image: e.socialImage || e.image?.src,
    ...pageFrame(e),
  };
}

export function events(which) {
  const up = D.events.filter((e) => !isPast(e));
  const past = D.events.filter(isPast).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const set = which === "past" ? past : up;
  if (!set.length) {
    return which === "past"
      ? `<p class="empty">No past events listed yet.</p>`
      : `<div class="empty"><p><strong>No dates are confirmed right now.</strong> Get notified when the next workshop opens.</p><a class="btn" href="/workshops/#notify">Get notified</a></div>`;
  }
  return `<div class="events">${set.map(eventCard).join("")}</div>`;
}
export function eventOptions() {
  return D.events.filter((e) => !isPast(e)).map((e) => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join("");
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
// Exact quotes, exact attribution. Consent evidence is NEEDS VERIFICATION (docs/03).
export function testimonials(limit) {
  const pick = D.stories.filter((s) => s.quote).slice(0, Number(limit) || 3);
  if (!pick.length) return EMPTY_SECTION;
  return `<div class="quotes">${pick.map((s, i) => `
      ${storyCard(s, ["pink", "stone", "yellow"][i % 3])}`).join("")}
    </div>`;
}
// With a card template, the template arranges the exact quote and name (bound from Details);
// a card whose class is just "quote" takes the rotating colour.
export function storyCard(s, tone) {
  if (!s.card) {
    return `<figure class="quote quote--${tone}">
        <blockquote><p>${esc(s.quote)}</p></blockquote>
        <figcaption>${esc(s.name)}<span>${esc(s.role || "Workshop participant")}</span></figcaption>
      </figure>`;
  }
  let html = applyBindings(s.card.html, bindingValues("testimonials", s.card.rec), { removeEmptyLinks: true });
  html = fillComponents(html, (name) => { const out = recordComponent(name, "testimonials", s.card.rec, { today }); return out === undefined ? "" : out; });
  html = html.trim().replace(/^<figure class="quote"/, `<figure class="quote quote--${tone}"`);
  return s.card.css ? `<div class="cms-card ${s.card.scope}"><style>${s.card.css}</style>${html}</div>` : html;
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
