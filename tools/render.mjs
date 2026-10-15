// Content renderers for tools/build.mjs. A page source calls one with {{name}} or {{name:arg}}.
// Everything here renders from assets/data/*.json so a content change is a data change.
import { esc } from "./layout.mjs";

let D;
export function init(data) { D = data; }

const TZ = "Asia/Manila";
const today = new Date();

/* ---- Helpers ----------------------------------------------------------- */
const tbc = (v, fallback = "To be confirmed") => (v == null || v === "" ? `<span class="tbc">${fallback}</span>` : esc(v));
const list = (items, cls = "") => `<ul${cls ? ` class="${cls}"` : ""}>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
const ext = (url, label, track) =>
  `<a class="text-link" href="${esc(url)}" target="_blank" rel="noopener"${track ? ` data-track="${track}"` : ""}>${esc(label)} <span class="link-arrow" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`;

function eventDate(e) {
  if (!e.date) return null;
  return new Date(`${e.date}T12:00:00+08:00`);
}
function fmt(d, opts) { return new Intl.DateTimeFormat("en-PH", { timeZone: TZ, ...opts }).format(d); }
function isPast(e) {
  const d = eventDate(e);
  return e.status === "past" || (d && d < today);
}

const STATUS = {
  open: ["Registration open", "open"],
  waitlist: ["Waitlist", "waitlist"],
  "sold-out": ["Sold out · waitlist open", "soldout"],
  tba: ["Dates to be announced", "tba"],
  past: ["Past event", "past"],
  inquiry: ["Ask about the next run", "waitlist"],
  planned: ["Planned · not yet open", "planned"],
};
function badge(key, label) {
  const [text, tone] = STATUS[key] || [label || key, "tba"];
  return `<span class="badge badge--${tone}">${esc(label || text)}</span>`;
}

/* ---- Output previews (illustrative interface fragments, no motion) ------ */
const PREVIEWS = {
  "readiness-map": () => `<figure class="preview" data-ui>
      <figcaption class="preview__cap">Example output · Workflow readiness map</figcaption>
      <table class="preview__table">
        <thead><tr><th scope="col">Recurring task</th><th scope="col">How often</th><th scope="col">Risk</th><th scope="col">Who reviews</th></tr></thead>
        <tbody>
          <tr class="is-picked"><td>Weekly team update</td><td>Weekly</td><td><span class="chip chip--low">Low</span></td><td>You</td></tr>
          <tr><td>Inquiry follow-up</td><td>Daily</td><td><span class="chip chip--low">Low</span></td><td>Owner</td></tr>
          <tr><td>Client proposal</td><td>Monthly</td><td><span class="chip chip--mid">Medium</span></td><td>Manager</td></tr>
        </tbody>
      </table>
      <p class="preview__foot"><span class="chip chip--pick">Start here</span> Weekly, low risk and easy to check.</p>
    </figure>`,
  "content-plan": () => `<figure class="preview" data-ui>
      <figcaption class="preview__cap">Example output · Four-week content plan</figcaption>
      <ol class="preview__plan">
        <li><b>Week 1</b><span>Answer a question clients often ask</span><span class="chip chip--done">Reviewed</span></li>
        <li><b>Week 2</b><span>Share a practical how-to from your work</span><span class="chip chip--done">Reviewed</span></li>
        <li><b>Week 3</b><span>A lesson from a recent project</span><span class="chip chip--draft">AI draft</span></li>
        <li><b>Week 4</b><span>Invite a conversation about one problem</span><span class="chip">Idea</span></li>
      </ol>
    </figure>`,
  prototype: () => `<figure class="preview preview--proto" data-ui>
      <figcaption class="preview__cap">Example output · A first landing page and lead tracker</figcaption>
      <div class="proto">
        <div class="proto__bar"><i></i><i></i><i></i><span>your-first-version</span></div>
        <div class="proto__body">
          <div class="proto__page"><span class="proto__nav"></span><span class="proto__h"></span><span class="proto__h proto__h--short"></span><span class="proto__btn"></span></div>
          <div class="proto__tracker">
            <p class="proto__title">Lead tracker</p>
            <p class="proto__row"><span>New inquiry</span><b class="is-new">New</b></p>
            <p class="proto__row"><span>Workshop question</span><b class="is-follow">Follow up</b></p>
            <p class="proto__row"><span>Team proposal</span><b class="is-done">Done</b></p>
          </div>
        </div>
      </div>
    </figure>`,
  assistant: () => `<figure class="preview" data-ui>
      <figcaption class="preview__cap">Example output · A business assistant with review points</figcaption>
      <div class="preview__chat">
        <p class="preview__msg preview__msg--in">Can I move my session to next week?</p>
        <p class="preview__msg preview__msg--out">Draft reply: “Yes, here are the available dates…”<span class="chip chip--draft">Needs your review</span></p>
        <p class="preview__msg preview__msg--flag">Refund request detected → handed to a person</p>
      </div>
    </figure>`,
};
export function preview(kind) { return (PREVIEWS[kind] || (() => ""))(); }

/* ---- Programs ---------------------------------------------------------- */
function ctaFor(p) {
  return { waitlist: "Join the waitlist", inquiry: "Ask about the next run", planned: "Register your interest", open: "Register" }[p.statusKey] || "Ask about this program";
}

// Home: bento of the three open-track programs. One featured card (Charcoal panel) spans two rows;
// the other two sit beside it on solid Faith Pink and AI Yellow. Each colour panel carries a static
// example of what a learner actually produces; the white body says what you leave with.
const BENTO_TONE = { "ai-workforce-accelerator": "ink", "ai-linkedin-b2b-growth": "pink", "ai-websites-workflow-building": "yellow" };
// The approved homepage's typographic marks for each pathway
const BENTO_SYMBOL = { "ai-workforce-accelerator": "[ AI ]", "ai-linkedin-b2b-growth": "in ↗", "ai-websites-workflow-building": "↗_" };
export function programRowsHome() {
  const picks = D.programs.filter((p) => BENTO_TONE[p.slug]);
  return `<div class="bento">${picks.map((p, i) => `
      <article class="bento__card bento__card--${BENTO_TONE[p.slug]}${i === 0 ? " bento__card--feature" : ""}">
        <div class="bento__art">
          <p class="bento__labels">${esc(p.category)}</p>
          <p class="bento__symbol" aria-hidden="true">${esc(BENTO_SYMBOL[p.slug])}</p>
          ${preview(p.preview)}
        </div>
        <div class="bento__body">
          <h3><a href="/programs/${p.slug}/" data-track="program_click">${esc(p.title)}</a></h3>
          <p class="bento__summary">${esc(p.summary)}</p>
          <p class="bento__leave">You leave with</p>
          ${list(p.outputs, "ticks bento__list")}
          <div class="bento__foot">
            <a class="btn btn--light" href="/programs/${p.slug}/" data-track="program_click">See the program <span class="btn__arrow" aria-hidden="true">↗</span></a>
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
  const others = D.programs.filter((o) => o.slug !== p.slug);
  const facts = [
    ["Status", badge(p.statusKey, p.statusLabel)],
    ["Format", tbc(p.format)],
    ["Time commitment", tbc(p.timeCommitment)],
    ["Location", tbc(p.location)],
    ["Fee", tbc(p.fee, "Published when the next intake is confirmed")],
    ["Next intake", tbc(p.nextIntake, "To be announced")],
    ["Instructor", tbc(p.instructor)],
  ];
  const section = (cond, html) => (cond ? html : "");
  const body = `
    <section class="phero phero--${p.tone} phero--program" aria-labelledby="program-title">
      <div class="wrap phero__grid">
        <div class="phero__copy">
          <nav class="crumbs" aria-label="Breadcrumb"><a href="/learn/">Learn AI</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.shortTitle)}</span></nav>
          <h1 id="program-title">${esc(p.title)}</h1>
          <p class="phero__lead">${esc(p.summary)}</p>
          <div class="actions">
            <a class="btn" href="#register" data-track="registration_start">${ctaFor(p)} <span class="btn__arrow btn__arrow--down" aria-hidden="true">↓</span></a>
            <a class="btn btn--light" href="/contact/?type=programs">Ask a question</a>
          </div>
        </div>
        <aside class="facts" aria-label="Program facts">
          <dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        </aside>
      </div>
    </section>

    <section class="section wrap split" aria-labelledby="for-title">
      <div>
        <h2 id="for-title">Who it’s for</h2>
        <p class="split__lead">${esc(p.problem)}</p>
      </div>
      <div>${list(p.audience, "ticks")}</div>
    </section>

    <section class="section band band--stone" aria-labelledby="outcomes-title">
      <div class="wrap outcomes">
        <div>
          <h2 id="outcomes-title">What you’ll learn</h2>
          <ol class="numbered">${p.outcomes.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>
        </div>
        <div class="outcomes__leave">
          <h3>What you leave with</h3>
          ${list(p.outputs, "ticks")}
          ${preview(p.preview)}
          <p class="small">Illustrative example. Your output depends on the task you bring.</p>
        </div>
      </div>
    </section>

    ${section(p.agenda.length, `<section class="section wrap" aria-labelledby="agenda-title">
      <div class="section-head"><h2 id="agenda-title">How it runs</h2><p>The outline below is the planned flow. Session dates and durations are confirmed with each intake.</p></div>
      <ol class="agenda">${p.agenda.map((a) => `<li><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></li>`).join("")}</ol>
    </section>`)}

    <section class="section wrap needs" aria-labelledby="needs-title">
      <h2 id="needs-title" class="sr-only">Requirements and scope</h2>
      <div class="needs__col"><h3>What you need</h3>${list(p.requirements, "ticks")}</div>
      ${section(p.inclusions && p.inclusions.length, `<div class="needs__col"><h3>Included</h3>${list(p.inclusions || [], "ticks")}</div>`)}
      ${section(p.exclusions && p.exclusions.length, `<div class="needs__col needs__col--not"><h3>Not included</h3>${list(p.exclusions, "crosses")}</div>`)}
    </section>

    ${section(p.faq.length, `<section class="section section--rule wrap" aria-labelledby="pfaq-title">
      <div class="faq"><div class="faq__head"><h2 id="pfaq-title">Questions about this program</h2></div>
      <div class="faq__items">${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div></div>
    </section>`)}

    <section class="section band band--pink" id="register" aria-labelledby="register-title">
      <div class="wrap formblock">
        <div class="formblock__intro">
          <h2 id="register-title">${ctaFor(p)}.</h2>
          <p>${p.statusKey === "open" ? "Reserve your place." : "There is no open intake yet. Leave your details and we will contact you when dates, fees and inclusions are confirmed. No payment is taken here."}</p>
          ${badge(p.statusKey, p.statusLabel)}
        </div>
        ${programForm(p)}
      </div>
    </section>

    <section class="section wrap" aria-labelledby="more-title">
      <h2 id="more-title" class="h3">Other programs</h2>
      <ul class="more">${others.map((o) => `<li><a href="/programs/${o.slug}/" data-track="program_click"><span>${esc(o.title)}</span>${badge(o.statusKey, o.statusLabel)}</a></li>`).join("")}</ul>
    </section>`;
  return {
    title: `${p.title} · Faith Works`,
    description: p.summary,
    path: `/programs/${p.slug}/`,
    nav: "learn",
    body,
  };
}

/* ---- Events ------------------------------------------------------------ */
function eventCard(e) {
  const d = eventDate(e);
  const past = isPast(e);
  const status = past ? "past" : e.status;
  const when = d
    ? `<time datetime="${e.date}">${fmt(d, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</time>`
    : `<span>${esc(e.dateLabel || "Date to be announced")}</span>`;
  const dest = e.destination || { type: "none" };
  let cta = "";
  if (!past && dest.type === "notify") cta = `<a class="btn btn--light" href="/workshops/?event=${esc(e.id)}#notify">${esc(dest.label || "Get notified")}<span class="sr-only"> about ${esc(e.title)}</span></a>`;
  else if (!past && dest.type === "internal") cta = `<a class="btn" href="${esc(dest.url)}">${esc(dest.label || "Register")}</a>`;
  else if (!past && dest.type === "external") cta = `<a class="btn" href="${esc(dest.url)}" target="_blank" rel="noopener" data-track="registration_start">${esc(dest.label || "Register")} <span class="btn__arrow" aria-hidden="true">↗</span><span class="sr-only"> (opens the event’s own page in a new tab)</span></a>`;
  else if (past && dest.type === "external" && dest.url) cta = ext(dest.url, dest.label || "Original event page");
  const program = e.programRef && D.programs.find((p) => p.slug === e.programRef);
  return `<article class="event${past ? " event--past" : ""}">
      <div class="event__date" aria-hidden="true">${d ? `<b>${fmt(d, { day: "numeric" })}</b><span>${fmt(d, { month: "short" })} ${fmt(d, { year: "numeric" })}</span>` : `<b>TBA</b><span>Date soon</span>`}</div>
      <div class="event__body">
        <p class="event__type">${esc(e.type)} ${badge(status)}</p>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.summary)}</p>
        <dl class="event__facts">
          <div><dt>Date</dt><dd>${when}</dd></div>
          <div><dt>Time (Asia/Manila)</dt><dd>${e.time ? esc(e.time) + " PHT" : '<span class="tbc">' + (past ? "Not listed" : "To be confirmed") + "</span>"}</dd></div>
          <div><dt>Venue</dt><dd>${tbc(e.venue, past ? "Not listed" : "To be confirmed")}</dd></div>
          <div><dt>Format</dt><dd>${tbc(e.format)}</dd></div>
          <div><dt>Capacity</dt><dd>${tbc(e.capacity, past ? "Not listed" : "To be confirmed")}</dd></div>
        </dl>
        <div class="event__cta">${cta}${program ? `<a class="text-link" href="/programs/${program.slug}/">About the program <span class="link-arrow" aria-hidden="true">↗</span></a>` : ""}</div>
      </div>
      ${e.image ? `<figure class="event__img"><img src="${esc(e.image.src)}" width="${e.image.width}" height="${e.image.height}" alt="${esc(e.image.alt)}" loading="lazy" decoding="async">${e.image.caption ? `<figcaption>${esc(e.image.caption)}</figcaption>` : ""}</figure>` : ""}
    </article>`;
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
function img(image, sizes, cls = "") {
  if (!image) return "";
  const base = "/" + image.base.replace(/^\//, "");
  const ws = image.widths;
  const set = (ext) => ws.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  const mid = ws.find((w) => w >= 960) || ws[ws.length - 1];
  return `<picture${cls ? ` class="${cls}"` : ""}><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}"><img src="${base}-${mid}.jpg" srcset="${set("jpg")}" sizes="${sizes}" width="${image.width}" height="${image.height}" alt="${esc(image.alt)}" loading="lazy" decoding="async" style="object-position:${esc(image.position || "50% 50%")}"></picture>`;
}

export function resourceList() {
  return `<div class="rlist">${D.resources.map((r) => {
    const attrs = r.access === "download" ? ` download data-track="download_click"` : r.access === "external" ? ` target="_blank" rel="noopener"` : ` data-track="starter_kit_click"`;
    return `<article class="rlist__item${r.featured ? " rlist__item--featured" : ""}">
        <p class="rlist__kind">${esc(r.kind)}</p>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.summary)}</p>
        <p class="rlist__access">${esc(r.accessLabel)}</p>
        <a class="btn${r.featured ? "" : " btn--light"}" href="${esc(r.url)}"${attrs}>${esc(r.ctaLabel)} <span class="btn__arrow${r.access === "download" ? " btn__arrow--down" : ""}" aria-hidden="true">${r.access === "download" ? "↓" : "↗"}</span></a>
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

function block(b) {
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

export function articlePage(a) {
  const d = new Date(`${a.date}T12:00:00+08:00`);
  const related = D.articles.filter((x) => x.slug !== a.slug).slice(0, 3);
  const body = `
    <article class="article">
      <header class="article__head wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="/resources/">Resources</a><span aria-hidden="true">/</span><span aria-current="page">Article</span></nav>
        <h1>${esc(a.title)}</h1>
        <p class="article__lead">${esc(a.excerpt)}</p>
        <p class="article__meta">${esc(a.author)} · <time datetime="${a.date}">${fmt(d, { day: "numeric", month: "long", year: "numeric" })}</time> · ${esc(a.readTime)}</p>
      </header>
      <div class="article__cover wrap">${img(a.image, "(min-width: 1200px) 1200px, 100vw")}</div>
      <div class="article__body">${a.content.map(block).join("\n")}</div>
    </article>
    <section class="section wrap" aria-labelledby="related-title">
      <h2 id="related-title" class="h3">Keep reading</h2>
      <ul class="more">${related.map((r) => `<li><a href="/resources/${r.slug}/"><span>${esc(r.title)}</span><span class="small">${esc(r.readTime)}</span></a></li>`).join("")}</ul>
    </section>`;
  return { title: `${a.title} · Faith Works`, description: a.excerpt, path: `/resources/${a.slug}/`, nav: "resources", body, image: `/${a.image.base}-1440.jpg` };
}

/* ---- Proof ------------------------------------------------------------- */
// Exact quotes, exact attribution. Consent evidence is NEEDS VERIFICATION (docs/03).
export function testimonials(limit) {
  const pick = D.stories.filter((s) => s.quote).slice(0, Number(limit) || 3);
  return `<div class="quotes">${pick.map((s, i) => `
      <figure class="quote quote--${["pink", "stone", "yellow"][i % 3]}">
        <blockquote><p>${esc(s.quote)}</p></blockquote>
        <figcaption>${esc(s.name)}<span>Workshop participant</span></figcaption>
      </figure>`).join("")}
    </div>`;
}

/* ---- Site settings ----------------------------------------------------- */
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
