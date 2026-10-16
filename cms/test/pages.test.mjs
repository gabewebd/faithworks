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
  const card = starterTemplate("testimonials").html;
  assert.ok(card.includes('data-cms-bind="quote"') && card.includes('data-cms-bind="display-name"'));
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
  const two = await u.author.put(`/api/records/programs/${rec(created).id}`, { version: 1, data: program({ authors: [USERS.author, USERS.main] }) });
  assert.equal(rec(two).byline, "Dev Author and Dev Main Admin");
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
  const view = await u.main.get(`/api/records/programs/${p.id}`);
  const saved = await u.main.put(`/api/records/programs/${p.id}`, { version: view.data.record.version, data: { ...program({ slug: p.slug, title: p.title }) } });
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
  const base = { title: "Ev", slug: "ev-range", summary: "S", time_zone: "Asia/Manila", delivery_format: "online", event_status: "open", cta_type: "none" };
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
  assert.match(res.data.html, /data-fw-form="program_interest"/, "generated form component");
  const site = await u.author.post("/api/preview", { collection: "programs", data: program() });
  assert.match(site.data.html, /class="site-header"/);
  assert.match(site.data.html, /href="\/css\/style\.css/);
  const notLive = await u.author.post("/api/preview", { collection: "programs", id: seed.programs[0].id, live: true });
  assert.equal(notLive.status, 404);
  cleanup();
});

test("testimonial cards show the exact quote from Details, whatever the template says", async () => {
  const { u, cleanup } = await setup();
  const t = seed.testimonials[0];
  const body = `<figure class="quote"><blockquote><p data-cms-bind="quote">An invented, polished quote.</p></blockquote><figcaption><b data-cms-bind="display-name">Someone else</b></figcaption></figure>`;
  const res = await u.author.post("/api/preview", { collection: "testimonials", id: t.id, data: { ...t, body_html: body, doc_version: DOC_VERSION } });
  assert.equal(res.status, 200);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  assert.ok(res.data.html.includes(esc(t.quote)), "exact quote");
  assert.ok(!res.data.html.includes("invented"));
  assert.ok(!res.data.html.includes("Someone else"));
  cleanup();
});

test("scoped Page CSS keeps its design tokens even when it starts with a comment", async () => {
  const { scopeCss } = await import("../shared/sanitize-css.mjs");
  assert.equal(scopeCss("/* note */\n:root{--a:1}\n/* x */ .b{c:d}", ".s"), ".s{--a:1}\n.s .b{c:d}");
  const scoped = scopeCss("/* Page CSS */\n:root {\n  --pink: #EFACBA;\n}\n.phero { color: var(--pink); }", ".cms-body--x");
  assert.match(scoped, /^\.cms-body--x\{\n  --pink: #EFACBA;/m, "tokens are defined on the page wrapper");
  assert.ok(!/\.cms-body--x \/\*/.test(scoped), "no comment glued into a selector");
});
