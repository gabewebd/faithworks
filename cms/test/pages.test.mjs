// Page documents: bindings between Details and the page, upgrading older records, starter
// templates, computed values, layout and the API rules that keep them consistent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  setBoundText, getBoundText, setBoundLink, fillComponents, extractList, extractText, applyBindings, bindingValues,
  upgradeRecord, readingTime, eventDuration, eventDateText, eventTimeText, isDoc, DOC_VERSION,
} from "../shared/page-doc.mjs";
import { starterTemplate, SNIPPETS } from "../shared/starters.mjs";
import { sanitizeHtml } from "../shared/sanitize-html.mjs";
import { toPublic } from "../shared/public.mjs";
import { testApp, signedIn, USERS } from "./helpers.mjs";

const seed = JSON.parse(readFileSync(new URL("../fixtures/seed.json", import.meta.url), "utf8"));
const rec = (r) => r.data.record;

/* ---- Bindings are marker-based, never text matching ---- */
test("bound text changes only the marked element, never matching text elsewhere", () => {
  const html = `<h1 data-cms-bind="title">Old title</h1><h2>Old title</h2><p>About the Old title here.</p><p data-cms-bind="title">Old <em>title</em></p>`;
  const out = setBoundText(html, "title", "New <title> & more");
  assert.equal(out, `<h1 data-cms-bind="title">New &lt;title&gt; &amp; more</h1><h2>Old title</h2><p>About the Old title here.</p><p data-cms-bind="title">New &lt;title&gt; &amp; more</p>`);
  assert.equal(getBoundText(out, "title"), "New <title> & more");
  assert.equal(getBoundText(html, "summary"), null, "no marker → no value");
});

test("nested elements of the same tag are matched correctly; empty values show their placeholder", () => {
  const html = `<div data-cms-bind="price"><div>inner</div></div><div>after</div>`;
  assert.equal(setBoundText(html, "price", "PHP 1"), `<div data-cms-bind="price">PHP 1</div><div>after</div>`);
  const empty = setBoundText(`<dd data-cms-bind="price" data-cms-empty="To be announced">PHP 1</dd>`, "price", "");
  assert.equal(empty, `<dd data-cms-bind="price" data-cms-empty="To be announced"><span class="tbc">To be announced</span></dd>`);
  assert.equal(getBoundText(empty, "price"), "", "placeholder text is not a value");
});

test("comments, scripts and attribute values containing markup do not confuse the scanner", () => {
  const html = `<!-- <h1 data-cms-bind="title">x</h1> --><p title="a > b" data-cms-bind="title">T</p><script>"<p data-cms-bind='title'>"</script>`;
  const out = setBoundText(html, "title", "Z");
  assert.ok(out.startsWith(`<!-- <h1 data-cms-bind="title">x</h1> --><p title="a > b" data-cms-bind="title">Z</p>`));
  assert.ok(out.endsWith(`<script>"<p data-cms-bind='title'>"</script>`));
});

test("links and components follow Details; empty links are removed on the website", () => {
  const html = `<a class="btn" href="#" data-cms-href="registration-url">Register</a><p>x</p>`;
  assert.equal(setBoundLink(html, "registration-url", "https://example.com/r?a=1&b=2"), `<a class="btn" href="https://example.com/r?a=1&amp;b=2" data-cms-href="registration-url">Register</a><p>x</p>`);
  assert.equal(setBoundLink(html, "registration-url", "", { removeEmpty: true }), `<p>x</p>`);
  const comp = `<div class="a" data-cms-component="featured-image"></div><ul data-cms-component="other-programs"><li>stale</li></ul>`;
  assert.equal(fillComponents(comp, (n) => (n === "featured-image" ? null : "<li>A</li>")), `<ul data-cms-component="other-programs"><li>A</li></ul>`);
});

test("card lists come from the page", () => {
  const html = `<ul class="ticks" data-cms-list="outputs"><li>One &amp; two</li><li> Three </li></ul><dd data-cms-extract="format">Online</dd>`;
  assert.deepEqual(extractList(html, "outputs"), ["One & two", "Three"]);
  assert.equal(extractText(html, "format"), "Online");
  assert.equal(extractList(html, "audience"), null);
});

/* ---- Calculated values ---- */
test("reading time is calculated and reproduces the editorial values of every existing article", () => {
  for (const r of seed.resources.filter((x) => x.resource_type === "article")) assert.equal(readingTime(r.body_html), r.read_time, r.slug);
  assert.equal(readingTime(""), "");
  assert.equal(readingTime(`<h1 data-cms-bind="title">${"word ".repeat(2000)}</h1><p>short</p>`), "1 min read", "Details-controlled text is not counted");
});

test("event duration and dates are derived; changing the time zone never moves the event", () => {
  const e = { event_date: "2026-11-20", start_time: "09:00", end_time: "12:30", time_zone: "Asia/Manila" };
  assert.equal(eventDuration(e), "3 hours 30 minutes");
  assert.equal(eventDuration({ ...e, end_date: "2026-11-22" }), "3 days");
  assert.equal(eventDuration({ ...e, end_time: "08:00" }), "", "end before start");
  assert.equal(eventDuration({ event_date: "2026-11-20" }), "");
  assert.match(eventDateText(e), /^Friday, (20 November|November 20), 2026$/, "the site's en-PH date format");
  const other = { ...e, time_zone: "America/New_York" };
  assert.equal(eventDateText(other), eventDateText(e), "same calendar date in any zone");
  assert.equal(eventTimeText(e), "9:00–12:30 PM PHT".replace("9:00–12:30 PM", "9:00 AM–12:30 PM"));
  assert.equal(eventTimeText(other), "9:00 AM–12:30 PM ET");
});

/* ---- Upgrading older records ---- */
test("older records are upgraded on read without losing any content", () => {
  const p = seed.programs[0];
  const up = upgradeRecord("programs", p);
  assert.ok(isDoc(up) && up.upgraded && !isDoc(p), "the stored record itself is untouched");
  for (const text of [p.title, p.summary, p.problem, ...p.target_audience, ...p.learning_outcomes, ...p.outputs, ...p.requirements, ...p.exclusions, ...p.agenda.map((a) => a.title), ...p.faq.map((f) => f.q)]) {
    assert.ok(up.body_html.includes(text.replace(/&/g, "&amp;")), `kept: ${text}`);
  }
  assert.equal(getBoundText(up.body_html, "title"), p.title);
  assert.deepEqual(extractList(up.body_html, "outputs"), p.outputs);
  const a = seed.resources[0];
  const ua = upgradeRecord("resources", a);
  assert.ok(ua.body_html.includes(a.body_html), "the article body is kept verbatim");
  const e = seed.events.find((x) => !x.body_html);
  assert.equal(upgradeRecord("events", e).body_html, "", "events without page content keep having no page");
  assert.equal(upgradeRecord("programs", up), up, "already a document");
});

/* ---- Starter templates ---- */
test("every content type has a complete starter template that publishes cleanly", () => {
  for (const c of ["programs", "events", "resources"]) {
    const { html, css } = starterTemplate(c);
    for (const s of ["This Is the Full HTML Template", "This Is a Card", "This Is a List", "This Is an Image", "This Is a Video", "This Is a Call to Action", "This Is an FAQ", "This Is a Testimonial"]) assert.ok(html.includes(s), `${c}: ${s}`);
    assert.ok(css.trim().length > 0);
    assert.deepEqual(sanitizeHtml(html).report, [], `${c}: nothing removed when published`);
    assert.ok(getBoundText(html, "title") !== null, `${c}: the title is bound`);
    assert.ok(!/<iframe/i.test(html), `${c}: no pretend video embed`);
    for (const m of html.matchAll(/src="([^"]+)"/g)) assert.match(m[1], /^\/assets\/images\/placeholder-(16x9|4x3|portrait)\.svg$/, "only labelled placeholder images");
  }
  assert.equal(starterTemplate("testimonials").html, "", "testimonials are cards, not pages");
  for (const s of Object.values(SNIPPETS)) assert.deepEqual(sanitizeHtml(s.html).report, [], s.label);
});

/* ---- The published page always matches Details ---- */
test("bindings make the page match Details even if the stored page text is stale", async () => {
  const body = `<h1 data-cms-bind="title">Stale title</h1><p data-cms-bind="summary">Stale</p><dd data-cms-bind="price" data-cms-empty="TBA">PHP 1</dd>`;
  const out = applyBindings(body, bindingValues("programs", { title: "Fresh <b>title</b>", summary: "Now", price_text: "" }));
  assert.match(out, /<h1 data-cms-bind="title">Fresh &lt;b&gt;title&lt;\/b&gt;<\/h1>/);
  assert.match(out, /<span class="tbc">TBA<\/span>/);
});

test("published payloads of page documents carry no legacy fields and no emails", () => {
  const p = { ...upgradeRecord("programs", seed.programs[0]), authors: ["a@example.test"], byline: "Ana" };
  const pub = toPublic("programs", p);
  for (const k of ["target_audience", "agenda", "faq", "problem", "authors", "content_owner", "assigned_to"]) assert.ok(!(k in pub), k);
  assert.equal(pub.byline, "Ana");
  assert.ok(!JSON.stringify(pub).includes("@example.test"));
  const legacy = toPublic("programs", seed.programs[0]);
  assert.ok("target_audience" in legacy, "older records still publish the fields their page is built from");
});

/* ---- API ---- */
async function setup() { const t = testApp(); return { ...t, u: await signedIn(t.app) }; }
const program = (over = {}) => {
  const s = starterTemplate("programs");
  return { title: "Team AI Lab", slug: "team-ai-lab", summary: "A lab.", enrollment_status: "waitlist", price_text: "PHP 9,897", body_html: s.html, body_css: s.css, page_layout: "site", doc_version: DOC_VERSION, ...over };
};

test("authors are CMS users; the byline uses names, never emails; the creator is the default author", async () => {
  const { u, cleanup } = await setup();
  const created = await u.author.post("/api/records/programs", { data: program({ authors: [] }) });
  assert.equal(created.status, 201);
  assert.deepEqual(rec(created).authors, [USERS.author]);
  assert.equal(rec(created).byline, "Dev Author");
  const two = await u.author.put(`/api/records/programs/${rec(created).id}`, { version: 1, data: program({ authors: [USERS.author, USERS.super] }) });
  assert.equal(rec(two).byline, "Dev Author and Dev Super Admin");
  const bad = await u.author.put(`/api/records/programs/${rec(created).id}`, { version: 2, data: program({ authors: ["stranger@example.test"] }) });
  assert.equal(bad.status, 422);
  assert.match(bad.data.error.errors.authors, /Not on the CMS user list/);
  const authors = await u.author.get("/api/authors");
  assert.ok(authors.data.some((a) => a.email === USERS.author2 && a.name === "Dev Second Author"));
  cleanup();
});

test("reading time is calculated by the server; a typed value is ignored", async () => {
  const { u, cleanup } = await setup();
  const r = await u.author.post("/api/records/resources", { data: { title: "Reading", slug: "reading", resource_type: "article", category: "AI", summary: "S", publish_date: "2026-10-16", read_time: "99 min read", body_html: `<p>${"word ".repeat(900)}</p>`, doc_version: DOC_VERSION } });
  assert.equal(rec(r).read_time, "5 min read");
  const g = await u.author.post("/api/records/resources", { data: { title: "Guide", slug: "guide-x", resource_type: "guide", category: "AI", summary: "S", publish_date: "2026-10-16", body_html: "<p>x</p>", file_url: "/files/guide.pdf" } });
  assert.equal(rec(g).read_time, "", "no reading time for guides");
  cleanup();
});

test("saving from the simplified form keeps every stored legacy value", async () => {
  const { u, cleanup } = await setup();
  const p = seed.programs[0];
  const view = await u.super.get(`/api/records/programs/${p.id}`);
  const saved = await u.super.put(`/api/records/programs/${p.id}`, { version: view.data.record.version, data: { ...program({ slug: p.slug, title: p.title }) } });
  assert.equal(saved.status, 200);
  const r = rec(saved);
  assert.deepEqual(r.target_audience, p.target_audience);
  assert.deepEqual(r.agenda, p.agenda);
  assert.equal(r.content_owner, p.content_owner);
  assert.equal(r.doc_version, DOC_VERSION);
  cleanup();
});

test("event dates are validated as a range", async () => {
  const { u, cleanup } = await setup();
  const base = { title: "Ev", slug: "ev-range", summary: "S", time_zone: "Asia/Manila", registration_type: "none" };
  const bad = await u.author.post("/api/records/events", { data: { ...base, event_date: "2026-11-20", end_date: "2026-11-19" } });
  assert.equal(bad.status, 422);
  assert.ok(bad.data.error.errors.end_date);
  const ok = await u.author.post("/api/records/events", { data: { ...base, event_date: "2026-11-20", end_date: "2026-11-21", start_time: "17:00", end_time: "09:00", time_zone: "Europe/London" } });
  assert.equal(ok.status, 201, "overnight across days is fine");
  assert.equal(rec(ok).start_time, "17:00");
  cleanup();
});

test("preview: the page follows Details, custom layouts drop the global chrome, live and draft are distinct", async () => {
  const { u, cleanup } = await setup();
  const data = program({ title: "Bound <Title>", page_layout: "custom", body_html: `<header class="fw-topbar">Own nav</header>` + program().body_html.replace("This Is the Full HTML Template", "Stale heading") });
  const res = await u.author.post("/api/preview", { collection: "programs", data });
  assert.equal(res.status, 200);
  assert.match(res.data.html, /<h1 id="page-title" data-cms-bind="title">Bound &lt;Title&gt;<\/h1>/);
  assert.ok(!res.data.html.includes("Stale heading"));
  assert.ok(!res.data.html.includes('class="site-header"') && !res.data.html.includes('class="site-footer"'), "no global navbar/footer");
  assert.match(res.data.html, /Own nav/);
  assert.match(res.data.html, /class="form form--ghl"/, "generated form component (the GoHighLevel program form)");
  const site = await u.author.post("/api/preview", { collection: "programs", data: program() });
  assert.match(site.data.html, /class="site-header"/);
  assert.match(site.data.html, /href="\/css\/style\.css/);
  const notLive = await u.author.post("/api/preview", { collection: "programs", id: seed.programs[0].id, live: true });
  assert.equal(notLive.status, 404);
  cleanup();
});

test("testimonial cards: the quote, the name and role, an optional round photo; colour from the palette", async () => {
  const { u, cleanup } = await setup();
  const t = seed.testimonials[0];
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const plain = await u.author.post("/api/preview", { collection: "testimonials", id: t.id, data: { ...t, tone: "ink", role: "", featured_image_url: "" } });
  assert.equal(plain.status, 200);
  assert.ok(plain.data.html.includes(esc(t.quote)), "the quote as written");
  assert.match(plain.data.html, /<figure class="quote quote--pink">/, "a stored or sent card colour is ignored");
  assert.match(plain.data.html, new RegExp(`<span class="quote__name">${esc(t.display_name)}</span>`));
  assert.ok(!plain.data.html.includes("quote__photo"), "no image element without a photo");
  const photo = await u.author.post("/api/preview", { collection: "testimonials", id: t.id, data: { ...t, role: "HR & People", featured_image_url: "/assets/images/ana.jpg", visible: false } });
  assert.match(photo.data.html, new RegExp(`<span class="quote__name">${esc(t.display_name)}</span><span class="quote__role">HR &amp; People</span>`), "the role below the name");
  assert.match(photo.data.html, /<img class="quote__photo" src="\/assets\/images\/ana\.jpg" alt=""/, "a round photo beside the name");
  cleanup();
});

test("home testimonial deck: brand colours by position, never charcoal; role below the name; a progress line", async () => {
  const R = await import("../../tools/render.mjs");
  const { toRenderData } = await import("../../tools/content.mjs");
  const { buildSnapshot } = await import("../shared/public.mjs");
  const base = { status: "draft", version: 1, visible: true };
  const people = ["A", "B", "C", "D", "E", "F", "G"]; // 7: the last card sits beside the first
  const records = { settings: seed.settings, testimonials: people.map((name, i) => ({ ...base, id: `t${i}`, display_name: name, quote: `Quote ${name}`, role: i === 0 ? "HR Manager" : "", sort_order: i, tone: "ink" })) };
  R.init(toRenderData(buildSnapshot({ records, view: "preview" })));
  const html = R.voices();
  const tones = [...html.matchAll(/class="voice voice--(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(tones, ["pink", "yellow", "white", "pink", "yellow", "white", "yellow"], "a stored colour is ignored");
  tones.forEach((c, i) => assert.notEqual(c, tones[(i + 1) % tones.length], "neighbours differ, round the loop too"));
  assert.match(html, /<b class="voice__name">A<\/b><span class="voice__role">HR Manager<\/span>/);
  assert.match(html, /<b class="voice__name">B<\/b><span class="voice__role">Faith Works participant<\/span>/, "no role: the standard line");
  assert.match(html, /class="voices__progress" aria-hidden="true"><span data-carousel-progress><\/span>/);
  R.init(toRenderData(buildSnapshot({ records: { ...records, testimonials: records.testimonials.slice(0, 1) }, view: "preview" })));
  assert.ok(!R.voices().includes("voices__progress"), "one card: no autoplay, so no line");
});

test("event cards: registration buttons follow the destination; no empty buttons", async () => {
  const R = await import("../../tools/render.mjs");
  const { toRenderData } = await import("../../tools/content.mjs");
  const { buildSnapshot } = await import("../shared/public.mjs");
  const base = { status: "draft", version: 1, time_zone: "Asia/Manila", visible: true, start_time: "13:00", end_time: "17:00" };
  const records = {
    settings: seed.settings,
    events: [
      { ...base, id: "e1", title: "GHL", slug: "ghl", event_date: "2099-01-10", registration_type: "external", registration_url: "https://faithph.ai/funnel", cta_label: "Get tickets", event_page: true, body_html: "<h1>GHL</h1>", doc_version: 2 },
      { ...base, id: "e2", title: "Info only", slug: "info", event_date: "2099-01-11", registration_type: "none" },
      { ...base, id: "e3", title: "CMS page", slug: "cms-page", event_date: "2099-01-12", registration_type: "page", body_html: "<h1>Page</h1>", doc_version: 2 },
      { ...base, id: "e4", title: "Old", slug: "old", event_date: "2020-01-10", registration_type: "external", registration_url: "https://faithph.ai/old" },
      { ...base, id: "e5", title: "Hidden", slug: "hidden", event_date: "2099-01-13", registration_type: "none", visible: false },
    ],
  };
  const d = toRenderData(buildSnapshot({ records, view: "preview" }));
  R.init(d);
  const up = R.events("upcoming"), past = R.events("past");
  const card = (html, slug) => html.slice(html.indexOf(`id="event-${slug}"`), html.indexOf("</article>", html.indexOf(`id="event-${slug}"`)));
  assert.match(card(up, "ghl"), /href="https:\/\/faithph\.ai\/funnel" target="_blank"[^>]*>Get tickets/, "button to the external funnel");
  assert.match(card(up, "ghl"), /href="\/events\/ghl\/">Event details/, "and a separate detail page link");
  assert.ok(!/class="btn|event__cta/.test(card(up, "info")), "no button, no empty button row");
  assert.match(card(up, "cms-page"), /href="\/events\/cms-page\/"[^>]*>Register/);
  assert.ok(!card(up, "cms-page").includes("Event details"), "the button already goes to the page");
  assert.ok(!card(past, "old").includes("class=\"btn"), "past events have no registration button");
  assert.ok(!up.includes("Hidden") && !past.includes("Hidden"), "hidden events are left out");
  assert.ok(up.indexOf("event-ghl") < up.indexOf("event-info") && up.indexOf("event-info") < up.indexOf("event-cms-page"), "upcoming in date order");
  assert.equal(R.eventPage(d.events.find((e) => e.slug === "info")), null, "no page without one");
  assert.ok(R.eventPage(d.events.find((e) => e.slug === "cms-page")).body.includes("<h1>Page</h1>"));
  const cal = R.calendarData();
  assert.deepEqual(cal.map((e) => [e.id, e.start, e.end, e.url]), [
    ["old", "2020-01-10T13:00:00+08:00", "2020-01-10T17:00:00+08:00", "/workshops/#event-old"],
    ["ghl", "2099-01-10T13:00:00+08:00", "2099-01-10T17:00:00+08:00", "/events/ghl/"],
    ["info", "2099-01-11T13:00:00+08:00", "2099-01-11T17:00:00+08:00", "/workshops/#event-info"],
    ["cms-page", "2099-01-12T13:00:00+08:00", "2099-01-12T17:00:00+08:00", "/events/cms-page/"],
  ]);
  assert.ok(R.eventCalendar().includes("data-cal-data"), "the calendar embeds the same data");
});

test("event times keep their own time zone; past is decided in that zone", async () => {
  const { eventInstant, isPastEvent } = await import("../shared/page-doc.mjs");
  assert.equal(eventInstant("2026-07-01", "09:30", "Europe/London"), "2026-07-01T09:30:00+01:00", "summer time");
  assert.equal(eventInstant("2026-12-01", "09:30", "Europe/London"), "2026-12-01T09:30:00+00:00");
  assert.equal(eventInstant("2026-12-01", "", "Asia/Manila"), "2026-12-01", "all day");
  const now = new Date("2026-10-19T17:00:00Z"); // 20 Oct 01:00 in Manila, 19 Oct 10:00 in Los Angeles
  assert.equal(isPastEvent({ event_date: "2026-10-19", time_zone: "Asia/Manila" }, now), true);
  assert.equal(isPastEvent({ event_date: "2026-10-19", time_zone: "America/Los_Angeles" }, now), false);
  assert.equal(isPastEvent({ event_date: "", time_zone: "Asia/Manila" }, now), false, "no date: never past");
});

test("an event is past once its end time has passed: future, ongoing, multi-day and overnight events", async () => {
  const { eventEndsAt, isPastEvent, eventCta } = await import("../shared/page-doc.mjs");
  const at = (iso) => new Date(iso);
  const timed = { event_date: "2026-10-22", start_time: "13:00", end_time: "16:00", time_zone: "Asia/Manila", registration_type: "external", registration_url: "https://example.test/r", title: "T" };
  assert.equal(eventEndsAt(timed), "2026-10-22T16:00:00+08:00");
  assert.equal(isPastEvent(timed, at("2026-10-22T04:00:00Z")), false, "future (12:00 Manila)");
  assert.equal(isPastEvent(timed, at("2026-10-22T06:30:00Z")), false, "ongoing (14:30 Manila)");
  assert.equal(isPastEvent(timed, at("2026-10-22T08:00:00Z")), true, "ended at 16:00 Manila");
  assert.equal(isPastEvent(timed, at("2026-10-22T07:59:00Z")), false, "a minute before the end");
  // Multi-day: the end date and end time decide
  const multi = { ...timed, end_date: "2026-10-24" };
  assert.equal(isPastEvent(multi, at("2026-10-23T10:00:00Z")), false, "day two of three");
  assert.equal(isPastEvent(multi, at("2026-10-24T08:00:00Z")), true);
  // Date only: lasts the whole day in its own zone
  const allDay = { event_date: "2026-10-22", time_zone: "Asia/Manila" };
  assert.equal(eventEndsAt(allDay), "2026-10-23T00:00:00+08:00");
  assert.equal(isPastEvent(allDay, at("2026-10-22T15:59:00Z")), false, "23:59 Manila");
  assert.equal(isPastEvent(allDay, at("2026-10-22T16:00:00Z")), true, "midnight Manila");
  // Overnight one-day event (22:00–01:00) ends the next morning
  const late = { event_date: "2026-10-22", start_time: "22:00", end_time: "01:00", time_zone: "Asia/Manila" };
  assert.equal(eventEndsAt(late), "2026-10-23T01:00:00+08:00");
  // The button carries the end so the browser can drop it after the event; past events get none
  assert.match(eventCta(timed, false), /data-event-end="2026-10-22T16:00:00\+08:00"/);
  assert.equal(eventCta(timed, true), "");
});

test("scoped Page CSS keeps its design tokens even when it starts with a comment", async () => {
  const { scopeCss } = await import("../shared/sanitize-css.mjs");
  assert.equal(scopeCss("/* note */\n:root{--a:1}\n/* x */ .b{c:d}", ".s"), ".s{--a:1}\n.s .b{c:d}");
  const scoped = scopeCss("/* Page CSS */\n:root {\n  --pink: #EFACBA;\n}\n.phero { color: var(--pink); }", ".cms-body--x");
  assert.match(scoped, /^\.cms-body--x\{\n  --pink: #EFACBA;/m, "tokens are defined on the page wrapper");
  assert.ok(!/\.cms-body--x \/\*/.test(scoped), "no comment glued into a selector");
});

test("listings: empty states, featured resources, Keep reading cards, article contents", async () => {
  const R = await import("../../tools/render.mjs");
  const { toRenderData } = await import("../../tools/content.mjs");
  const { buildSnapshot } = await import("../shared/public.mjs");
  R.init(toRenderData(buildSnapshot({ records: { settings: seed.settings }, view: "preview" })));
  for (const html of [R.programRowsHome(), R.programLinks(), R.resourcesEmpty(), R.events("upcoming")]) {
    assert.match(html, /^<div class="empty"><p><strong>[^<]+<\/strong>/, "one empty panel everywhere");
  }
  for (const html of [R.resourceFeatured(), R.resourceList(), R.guides(), R.featuredInsight(), R.insightList(), R.events("past"), R.voices()]) assert.equal(html, R.EMPTY_SECTION);
  assert.equal(R.dropEmptySections(`<p>a</p><!-- label --><section><h2>X</h2>${R.EMPTY_SECTION}</section><p>b</p>`), "<p>a</p><p>b</p>");
  assert.equal(R.dropEmptySections(`<section>x</section><div>${R.EMPTY_SECTION}</div>`), "<section>x</section><div></div>", "only the section that holds it");

  R.init(toRenderData(buildSnapshot({ records: { settings: seed.settings, resources: seed.resources }, view: "preview" })));
  const feat = R.resourceFeatured();
  const insight = R.featuredInsight();
  assert.equal((insight.match(/<h2 id="insight-title">/g) || []).length, 1, "one featured insight");
  assert.equal((feat.match(/class="rfeat__item/g) || []).length, seed.resources.filter((r) => r.featured).length - 1, "the lead insight is not repeated as a card");
  assert.match(feat, /rfeat__item rfeat__item--lead/);
  assert.ok(seed.resources.filter((r) => r.featured).every((r) => !R.resourceList().includes(`>${r.title}<`) && !R.insightList().includes(`>${r.title}<`)), "featured items are not repeated below");
  assert.match(R.insightList(), /data-insight-filters hidden/, "topic filters appear only with JS");
  assert.equal(R.resourcesEmpty(), R.EMPTY_SECTION);

  const html = `<p>Intro</p><div class="article__body"><h2>Why it works</h2><p>a</p><h2 id="kept">Kept id</h2><h2>Why it works</h2></div><p>after</p>`;
  const out = R.withToc(html);
  assert.match(out, /href="#why-it-works">Why it works<\/a><\/li><li><a class="toc__link" href="#kept">Kept id<\/a><\/li><li><a class="toc__link" href="#why-it-works-2">/, "ids are made, kept and unique");
  assert.ok(out.startsWith("<p>Intro</p><div class=\"article__layout wrap\">") && out.endsWith("</div><p>after</p>"));
  assert.equal(R.withToc(`<div class="article__body"><h2>Only one</h2></div>`), `<div class="article__body"><h2>Only one</h2></div>`, "one heading: no sidebar");

  const a = toRenderData(buildSnapshot({ records: { settings: seed.settings, resources: seed.resources }, view: "preview" })).articles[0];
  const page = R.articlePage(a).body;
  assert.match(page, /<a class="kr" href="\/resources\/[^"]+\/">\s*<picture class="kr__img">/, "Keep reading cards carry the featured image");
  assert.equal((page.match(/class="kr"/g) || []).length, 3);
});
