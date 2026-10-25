# Faith Works Website

The faithph.ai website for Faith Works PH: practical AI learning for founders, professionals and teams.
Built to the *Faith Works Brand and Website Development Brief v2.0* (15 October 2026).

**Current phase:** staging. Every page in the brief's sitemap exists. Most forms are GoHighLevel
embeds (GoHighLevel stores them and alerts the team). The contact form is the site's own form, in
**preview mode** (nothing is sent); its destination is the CMS, which stores each submission in
Supabase under *Form submissions* (`cms/README.md` §13), switched on with `js/config.js`
(`mode: "endpoint"`). The pages are `noindex` until launch.

Plain HTML, CSS and JavaScript. No framework, no npm packages. A small Node script generates the pages so
that the header, footer and repeated content (programs, events, articles) come from one place.

**Content is managed in the Faith Works CMS** (`cms/`, a separate app backed by Supabase; see
[`cms/README.md`](cms/README.md)). The website stays static: it
reads CMS content only while it is built.

## Run it locally

```bash
node tools/build.mjs                         # build from the CMS fixtures (cms/fixtures/seed.json)
node tools/build.mjs --content=local         # build from your local CMS (cms/.data/store.json)
CONTENT_SOURCE=cms CMS_CONTENT_URL=https://cms.example node tools/build.mjs --deploy   # production: live CMS content
```

Content view: drafts are shown only while Site settings say **staging** (noindex + staging bar).
Otherwise only published, approved content is built (`--view=published|preview` overrides).

Then open `index.html` directly, or use any local server (VS Code Live Server, `python -m http.server`).
The default build writes **relative** links (`css/style.css`, `../learn/index.html`), so styles, images
and navigation work from disk, from a sub-folder, or from a server root.

For production on a host that serves this folder at the domain root, build with clean URLs instead:

```bash
node tools/build.mjs --deploy                # root-relative links: /learn/, /css/style.css
```

**Public address (`PUBLIC_SITE_URL`).** Canonical URLs, link-preview tags (`og:url`, `og:image`,
`twitter:*`), share links, `sitemap.xml` and `robots.txt` use one origin, chosen when the site is
built: `PUBLIC_SITE_URL` if set (e.g. `https://faithworks.vercel.app`; an origin, no path), else on
Vercel the project's production domain (`VERCEL_PROJECT_PRODUCTION_URL`), else the CMS Site setting
*Website address*. Set it per Vercel environment (Production / Preview) and change it when the domain
moves; nothing else hardcodes a domain. Staging builds stay `noindex`, but `robots.txt` lets
link-preview crawlers (LinkedInBot, facebookexternalhit, Twitterbot, Slackbot) read pages.

**Link previews after a deploy.** LinkedIn and Facebook cache what they read. To refresh a URL:
LinkedIn *Post Inspector* (https://www.linkedin.com/post-inspector/) → paste the article URL →
*Inspect* (this re-scrapes it); Facebook *Sharing Debugger* (https://developers.facebook.com/tools/debug/)
→ *Debug* → *Scrape Again*. Instagram does not show link previews for website links in posts, so
there is no equivalent check there.

**Vercel (production):** `vercel.json` runs `node tools/build.mjs --deploy --content=cms --view=published
--out=dist` and serves `dist/`, which holds only the generated pages, `css/`, `js/` and `assets/`
(never `cms/`, `src/`, `tools/` or `docs/`). Set `CMS_CONTENT_URL=https://faithworks-cms.netlify.app` in
the Vercel project. If the CMS cannot be reached the build fails and Vercel keeps the previous deployment;
it never falls back to the fixtures. See `cms/README.md` §5.5.

## Where things live

| Path | What |
| --- | --- |
| `src/pages/*.html` | Page bodies. Each starts with a `<!--meta {...}-->` header (route, title, description, nav). `{{renderer}}` tokens insert generated content. |
| `cms/` | The CMS (dashboard, API, Supabase store). Programs, events, resources/articles, testimonials, tags and site settings are edited there. |
| `cms/fixtures/seed.json` | Development content fixture (all current content, with its approval state). Regenerate with `node cms/scripts/seed-from-site.mjs`. |
| `src/data/gallery.json` | **Photo registry**: every site photo once (original, alt text, crop, focal point) and, per page, the galleries and photo slots that page sources fill with `{{gallery:page.slot}}` (hero stacks and mosaics, founder photos). Edit this to add, remove, reorder or replace photos. |
| `src/data/events.json`, `tools/event-gallery.mjs` | **Events gallery** (separate from Resources): the archive of photos from past sessions, by registry id, with order, `featured` (also on the homepage) and optional caption, focal point and CMS `eventId`. The build adds the images editors mark *Show in the events gallery* on published CMS events (the CMS is authoritative for those), never repeats a photo, and lays them out as a masonry grid: `{{eventGallery:home}}` (18 photos, featured first, as three rows that the page scroll slides left, right, left (`js/motion.js` §5c), below Trusted by) and `{{eventGallery:all}}` (Workshops page). |
| `src/data/trusted-by.json` | The homepage **Trusted by** logo strip. Placeholders until approved client logos are supplied; set `name` and `logo` per entry to use a real one (`show: false` keeps an entry without showing it). |
| `tools/images.py`, `assets/images/web/` | Makes each registered photo's web versions from its original: WebP at 640 and 1280px (plus a 1200×630 JPEG link preview where `social` is set). Run `python tools/images.py` (needs Pillow) after changing the registry, then build; the web files are committed, so deploys need nothing extra. Originals in `assets/images/` are never edited and never deployed. |
| `assets/data/programs.json`, `events.json`, `resources.json`, `insights.json`, `success-stories.json`, `site.json` | **Migration source only** (used to create the seed). The build no longer reads them; edit content in the CMS. |
| `tools/content.mjs` | The website's content interface: fixtures, local CMS or live CMS → the shapes the templates render. |
| `tools/build.mjs`, `layout.mjs`, `render.mjs` | The generator, shared page chrome, and content/form renderers (CMS page documents with their Details values, forms and lists filled in). |
| `css/style.css` | The design system: tokens, components, states, responsive and reduced-motion rules; section 21 holds the CMS page templates (program, event, resource pages, testimonial cards, `fw-*` editor blocks). |
| `js/main.js` | Navigation, tabs, program selector, thank-you state, analytics events (`dataLayer`, no personal data). |
| `js/forms.js`, `js/config.js` | Form validation, states and submission; `config.js` sets the form mode (`preview` / `endpoint`) and the kit download URL. Never put secrets here. |
| `docs/01–07_*.docx` | Project documents: scope, audit, gap list, architecture, copy, forms spec, acceptance checklist. |

Generated output (do not edit by hand): `index.html`, `404.html`, `sitemap.xml`, `robots.txt` and the
route folders `about/ build/ business/ community/ contact/ free-ai-starter-kit/ learn/ privacy/ professionals/ programs/
resources/ speaking/ terms/ workshops/` (and `events/` when an event has its own page content). Pages for
content that is no longer in the build's content view are removed automatically.

## Before launch

See `docs/07_Implementation_and_Acceptance_Checklist.docx`. In short: connect forms in GHL and pass the
brief §14 tests, publish the final Starter Kit and set `starterKit.downloadUrl`, approve copy and legal pages,
then set `"staging": false` (and `"starterKitReady": true`) in `site.json` and rebuild.

## History

- `main`: the earliest multi-page build (SVG motifs originate here).
- `faff08d`: multi-page snapshot before the single-page rebuild.
- `c34bb13`: single-page homepage from Ms. Faith's approved HTML (`docs/source/faithworks-chatgpt-source.html`).
- Uncommitted homepage work from before the full-site build is saved as a git stash entry:
  `backup: homepage WIP before full-site build (2026-10-15)`.
