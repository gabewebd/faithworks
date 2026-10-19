# Faith Works CMS

A separate, headless content management system for faithph.ai. Staff manage **programs, events,
resources/articles, testimonials, tags and site settings** in a dashboard. Content is stored in
**Google Sheets** through a server-side integration. The public website is rebuilt from the
**published** content only.

- No runtime dependencies (Node 20+ built-ins only): nothing to `npm install`, no supply-chain surface.
- Runs on Vercel or Netlify (serverless functions + static dashboard), or locally with `npm run dev`.
- Brief: *Faith Works Brand and Website Development Brief v2.0* (15 Oct 2026), §2, §6, §7.

---

## 1. Architecture

```
 Staff browser ──► CMS dashboard (cms/public, static)
                        │  same-origin JSON API, session cookie, CSRF header
                        ▼
                   CMS API (cms/server, serverless function)
                        │  service-account JWT (server only)
                        ▼
                   Google Sheets  ── tabs: programs, events, resources, testimonials, settings,
                                          tags, users, published, history, audit_log
                        │
     GET /api/public/content (published copies only, cached)
                        ▼
 Website build (tools/build.mjs + tools/content.mjs) ──► static HTML ──► host (Netlify/Vercel/GHL)
```

| Piece | Where | Notes |
| --- | --- | --- |
| Content model | `cms/shared/schema.mjs` | One definition drives the sheet columns, the forms, validation, field permissions and which fields are public. |
| Workflow | `cms/shared/workflow.mjs`, `cms/server/services/records.mjs` | Statuses, transitions, role rules. Enforced on the server. |
| Public projection | `cms/shared/public.mjs` | The only code that decides what leaves the CMS. |
| Sanitizer | `cms/shared/sanitize-html.mjs`, `sanitize-css.mjs` | Allowlist tokenizer that re-serializes the markup, plus CSS neutralization and scoping. |
| Storage adapters | `cms/server/store/` | `sheets-store.mjs` (production), `json-store.mjs` (local development and tests). Same interface. |
| Website content interface | `tools/content.mjs` | `fixtures`, `local` or `cms` source; `published` or `preview` view; same output shape. |

**The public website does not depend on the CMS being online.** It is static. It reads the CMS
only while it is being built. If the CMS or Google is unavailable, the build stops and the host
keeps serving the previous deploy.

## 2. Roles

Two roles: **Super Admin** and **Author**. Every rule is checked in the API (`cms/shared/workflow.mjs`
and `cms/server/services/`). Hiding a button is never the protection.

| | Super Admin | Author |
| --- | :-: | :-: |
| Read content items (to link and reference them) | ✓ | ✓ |
| Create content | ✓ | ✓ |
| Edit, preview, publish (one step), unpublish, archive, restore to draft | any item | own items |
| Show or hide an event or testimonial on the website | any item | own items |
| Change a live page’s slug (with confirmation), restore earlier versions | any item | own items |
| Tags, site settings (including launch and tracking), activity log, website rebuild | ✓ | – |
| Delete / undelete, recovery, backups, users and roles | ✓ | – |

- **Own items:** an Author owns an item they created or are listed on as an author. `created_by`
  is set by the server only. The creator (or a Super Admin) manages the authors list; a co-author
  may add people and take themselves off but cannot remove anyone else. Imported content has no
  Author owner, so only Super Admins change it until they add authors to it.
- Super Admins listed in `CMS_SUPER_ADMINS` are pinned. They cannot be changed or locked out from the UI.
- **Unknown roles.** The only roles are `super_admin` and `author`. A `users` row with any other
  role cannot sign in and shows “Review: was …” on **Users and roles** until a Super Admin saves a
  current role for it. Nothing is rewritten in the sheet automatically.
- Other people are rows in the `users` tab, managed only from **Users and roles**. Nobody can change their own role.
- Sign-in is **Google OAuth** (OpenID Connect with PKCE). The CMS never stores or sees a password.
- A session is a signed HttpOnly cookie (8 hours by default). The role is re-read on every request, so removing someone takes effect within 30 seconds.
- **First Super Admin:** set `CMS_SUPER_ADMINS=faith@…` in the hosting environment, deploy, and sign in with that Google account. Then add the team under *Users and roles*. There are no default credentials.

## 3. Publishing, drafts and the live version

Statuses: **Draft → Published**, plus **Archived**. There is no review or approval step and no
publisher role: an item's owners (its creator and listed authors) and Super Admins publish it with
one click. Tags are separate.

- **Draft:** saved, not on the website. **Published:** on the website. **Archived:** kept for the record, off the website (*More → Restore to draft* brings it back).
- **Show on the website** (events and testimonials): a published item with this switch off is not on the website but stays in the CMS, marked *Hidden*, so it can be shown again later. Change the switch and press **Publish**.
- A record row is the **working copy**. What the website shows is the sanitized payload in the `published` tab.
- Editing a live item makes it a Draft again; the website keeps showing the live version until **Publish** (which saves first). The dashboard shows "Live · v5" (or "Hidden") next to the draft's status.
- **Concurrent edits:** every save sends the version it was based on. If someone saved in between, the save is refused with who and when, and nothing is overwritten. The storage layer double-checks with a per-row `write_id`.
- **Slugs:** format-checked, unique per route type (including old slugs that now redirect). A slug made from the title gets `-2`, `-3`… when it is taken (e.g. a monthly event with the same title). Changing a live page's slug needs a confirmation. The old URL then gets a redirect page (plus a Netlify `_redirects` 301 in deploy mode).
- Every save and publishing step is copied to `history`, and every action is recorded in `audit_log`.

### Testimonials

Five things: the **testimonial** (the quote), the **person's name**, an optional **profile photo**
(a small round image beside the name), a **card colour** from the brand palette (Faith Pink by
default, AI Yellow, Stone, Charcoal) and **Show on the website**. No approval step. A card
without a photo has no image element at all, and a photo that cannot load is removed in the browser.
The home page shows published, visible testimonials in display order.

### Events

An event is information for the Workshops page and its calendar: **title**, optional **short
description**, **start date** (needed to publish), start time, optional end date and end time, **time
zone** (Asia/Manila by default; stored as entered, never converted), optional **location or meeting
details**, optional **image**, **Show on the website**, and *Where should the registration button go?*

| Choice | The card's button | Page on the website |
| --- | --- | --- |
| **External link** (GHL page, form or funnel, or any URL; the link is required) | opens the link in a new tab | none, unless *Also give this event its own page* is on (then the card also links to *Event details*) |
| **CMS event page** | goes to `/events/{slug}/` | built with the page editor (*Event page* tab); content is required to publish |
| **No registration link** | none (no empty button) | none, unless *Also give this event its own page* is on |

The detail page and the registration destination are separate: an event can have its own page
while its button still goes to a GHL funnel. Upcoming and past events are separated from the
last day of the event in its own time zone; past events show no registration button. The Workshops
page has a month **calendar** (drawn by `js/main.js` from data the build embeds) and the build also
writes `/events/calendar.json` (published, visible events with a date: ISO start and end with the
zone's offset, the page or registration link). Drafts and hidden events are never in either.

## 3a. Details and the page editor

Programs and resources have three tabs: **Details** (essential metadata: title, slug, summary, price
or dates, featured image, SEO, authors, tags), the **page** itself (Visual editor and HTML mode, two
views of one document), and **History**. Events show the **Event page** tab only when the event has
its own page. Testimonials have Details and History only (no page or card template).

**One document, explicit connections.** The page (`body_html` + `body_css`) is the only place page
content lives. Values Details controls are marked in the page and filled in by one shared module
(`shared/page-doc.mjs`, used by the editor, the preview and the website build); nothing is ever
matched by text:

| Marker | Meaning |
| --- | --- |
| `data-cms-bind="title"` / `"summary"` | The element's text **is** the Details value, both ways: editing the heading in the page changes Details, editing Details changes the page. |
| `data-cms-bind="price"`, `"event-date"`, `"duration"`, `"read-time"`, `"byline"`… | Always taken from Details (read-only in the page). `data-cms-empty="…"` is shown when the value is empty. |
| `data-cms-href="registration-url"` / `"resource-url"` | A link whose destination is the Details URL; the website leaves it out when the URL is empty. |
| `data-cms-component="…"` | Generated by the website: status badge, featured image, event facts, interest form, other programs, related articles. |
| `data-cms-list="outputs"`, `data-cms-extract="format"` | Program lists and facts reused on the Learn and home cards, so cards never disagree with the page. |

The website build applies the same values, so a published page always matches Details even if the
stored page text is stale. Reading time (articles, 180 words a minute) and event duration are
calculated, never typed. Event times are stored as entered in the event's own time zone; changing
the zone never moves the event.

**Starter templates** (`shared/starters.mjs`): new records start from a complete page that shows each
supported element with replaceable example copy ("This Is a Card", "This Is a Video"…). Images use the
labelled placeholders in `assets/images/placeholder-*.svg`; video blocks stay a placeholder until a
YouTube or Vimeo address is added. *More → Start over from the template* replaces a page after a
confirmation. Existing records keep their content.

**Layout.** *Use global navbar and footer* (on by default) wraps the page in the site header and footer.
Turned off (*Custom page layout*), the published page has no global header or footer and brings its
own (*Insert → Custom navbar / Custom footer*), with any classes, ids and page CSS. Page CSS is scoped
to its page on the website and lives in a sandboxed frame in the editor, so it can never restyle the
site or the CMS.

**Page CSS** holds only what is special to one page. The site stylesheet (`css/style.css`) applies to every
page and, in the editor, while *Website styles* is ticked; Page CSS is scoped to its page and takes precedence.

**Preview** opens a full-screen sheet that slides up from the bottom (instant with reduced motion):
your unsaved draft, or the live version when there is one; desktop and mobile widths; Esc or the
X closes it and returns to the editor unchanged. It never saves or publishes.

**Safety** is unchanged: the editor and preview frames run no scripts; active elements are kept as
inert placeholders while editing; publishing sanitizes HTML and CSS on the server, and the editor
lists anything publishing would remove. HTML mode has two boxes: the page as a complete HTML
document (its `<head>` is generated from Details; only the `<body>` is saved, and the editor says so
when other head elements are ignored) and **Page CSS** below it. Any `<style>` typed or pasted into
the HTML is moved into the Page CSS box.

### Migration of existing records (no data changed)

Records saved before page documents have no `doc_version`. They are **upgraded when read**
(`upgradeRecord()`), by the editor and by the website build alike: their structured fields (audience,
outcomes, agenda, FAQ, inclusions…) become an equivalent page, and existing page HTML is kept
verbatim inside it. Nothing is written until someone saves; the website renders the same pages as
before (verified against the previous build output), and live content changes only when it is
published. Retired fields stay in storage as hidden *legacy* fields (their columns and
values are never deleted, and saving keeps them), and every earlier version stays in History.

### Migration to the simplified events, testimonials and statuses (no data deleted)

Records and live copies saved by earlier versions are converted **when read** (`migrateRecord()` in
`shared/schema.mjs`, applied by the server's store wrapper `server/store/migrate.mjs`, the public
snapshot and the website build). Nothing is rewritten until someone saves the item:

- **Statuses:** Needed, Under Review, Changes Requested, Approved and Rejected read as **Draft**. Whether an item is live is decided by the `published` tab, so live content stays live.
- **Events:** the old *Registration destination* becomes the new choice. An external page, or a page on this website (a `/path`), becomes **External link** with the same address; the *Get notified* form and *No button* become **No registration link** (the Workshops page keeps its general *Get notified* form). Events with page content keep their page. *Related program*, event type, event status, delivery format, map and meeting links, capacity, registration deadline and the text shown without a date are retired.
- **Testimonials:** Faith Pink card, shown, unless consent was recorded as declined or withdrawn, or the website was holding the live copy back for missing consent (those stay hidden until someone turns them on and publishes). Role, kind, source, consent fields, display approval and card templates are retired.

**Retired fields** (`retired` in `shared/schema.mjs`) are read from older rows so they can be
converted, and their stored values are written back unchanged, but new sheets do not get those
columns and they are never published. `approved_*`, `submitted_*`, `reviewed_*` and `review_note`
are no longer CMS columns; an older sheet keeps them (hand-added columns are always preserved).

Google Sheets: run `npm run sheets:setup` once after deploying this version. It adds the new columns
(`registration_type`, `event_page`, `visible`, `tone`…) at the end of each tab without moving or
deleting anything. Take a backup first (`npm run backup`).

## 4. Spreadsheet design (Google Sheets)

One spreadsheet, one tab per collection, plus system tabs. Row 1 holds the column headers.
**Columns are found by header name, not position.** Rows are found by the immutable `id`,
never by row number.

| Tab | Holds | Key columns |
| --- | --- | --- |
| `programs`, `events`, `resources`, `testimonials` | Working copies | `id` (e.g. `prg_3fa9…`), `status`, `version`, `write_id`, `slug`, `tags`, ownership and workflow timestamps, then the type's fields |
| `settings` | One row, `id = site` | Brand, contacts, social, CTA, footer, legal links, tracking IDs |
| `published` | Live copies | `id = collection:record_id`, `slug`, `version`, `state` (`live` or `unpublished`), `payload` (sanitized JSON) |
| `history` | Version snapshots | `record_id`, `version`, `kind` (save, publish, delete…), `data` (full JSON) |
| `audit_log` | Who did what | `at`, `actor`, `role`, `action`, `record_id`, `version`, `detail` (no content, no secrets) |
| `users` | Role assignments (no passwords) | `id = email`, `role`, `active` |
| `tags` | Reusable tags | `id` (slug), `label`, `archived` |

Current columns, after the system columns (`id, status, version, write_id, created_at, created_by,
updated_at, updated_by, published_at, published_by, published_version, published_slug,
previous_slugs, deleted_at, deleted_by`):

- `events`: `title, summary, event_date, start_time, end_date, end_time, time_zone, venue, registration_type, registration_url, cta_label, event_page, featured_image_url, featured_image_alt, slug, seo_title, meta_description, social_image_url, body_html…body_html__6, body_css, body_css__2, page_layout, doc_version, visible, authors, byline, sort_order`
- `testimonials`: `quote, display_name, featured_image_url, tone, visible, authors, sort_order`
- `programs`, `resources`, `settings`: unchanged by this version.

Encoding: lists are one item per line; tags are comma-separated ids; agenda, FAQ and social links are JSON; booleans are `TRUE` or `FALSE`. Dates use ISO 8601 (`2026-10-20`, `2026-10-16T08:00:00Z`).
Every value is written with `valueInputOption=RAW`, so text that starts with `=` is never evaluated as a formula.
A cell holds at most 50,000 characters, so long values continue in overflow columns:
`body_html` to `body_html__6` (~270k characters), and `payload`/`data` up to `__10`.
Columns added by hand are preserved but ignored.

**Rules for people with access to the sheet** (only the owner and maybe one technical admin should have it):
- Edit content in the CMS, not in the sheet. The sheet is not the authentication system. Anyone who can edit it can edit roles and live content directly.
- Do **not** sort rows, insert rows in the middle, rename headers or delete rows. Use *Data → Filter views* to look at data. If rows move during a save, the CMS refuses to confirm and the item's history keeps the previous version.
- Protect the tabs (*Data → Protect sheets and ranges*: only the owner and the service account).

## 5. Setup

### 5.1 Local development (no Google needed)

```bash
cd cms
cp .env.example .env          # CMS_STORE=json and CMS_DEV_LOGIN=true are fine locally
npm run dev                   # http://localhost:5174
npm test                      # 60 tests: roles, workflow, publishing, sanitizer, Sheets adapter
```

The JSON store lives at `cms/.data/store.json` (git-ignored) and is seeded from `cms/fixtures/seed.json`.
The login screen offers the three `@example.test` users (one Super Admin, two Authors). The dev login is refused
unless the CMS is on localhost **and** not deployed (`VERCEL`/`NETLIFY` set) **and** not `NODE_ENV=production`.

To see your local edits on the website: `node tools/build.mjs --content=local` from the repository root.

### 5.2 Google Cloud and the spreadsheet

1. **Spreadsheet:** create a blank Google Sheet owned by a Faith Works Google account (not a personal developer account). Keep sharing *Restricted*; never "Anyone with the link". Copy its ID from the URL (`/d/<ID>/edit`).
2. **Google Cloud project** (owned by the same organization): enable the **Google Sheets API**.
3. **Service account:** *IAM & Admin → Service accounts → Create*. Give it no project roles. Create a JSON key.
4. **Share the spreadsheet** with the service account's email as **Editor**, and with nobody else who does not need it.
5. **OAuth client for sign-in:** *APIs & Services → OAuth consent screen* (Internal if you use Google Workspace, otherwise External with test users), then *Credentials → Create OAuth client ID → Web application*.
   Authorized redirect URI: `https://<cms-domain>/api/auth/google/callback` (and `http://localhost:5174/api/auth/google/callback` for local tests).
6. Set the environment variables (section 6), then create the tabs and load the starting content:
   ```bash
   cd cms
   npm run sheets:setup    # creates tabs and header columns (never reorders or deletes)
   npm run sheets:seed     # adds missing cms/fixtures/seed.json rows by id; safe to rerun (dev users are skipped)
   npm run sheets:seed -- --dry-run   # read-only: which seed rows are present / missing
   npm run sheets:check    # access, headers and row counts
   ```

### 5.3 Deploying the CMS

**Vercel:** new project from this repository, Root Directory `cms`. `cms/vercel.json` sets the build, the `public/` output, the `/api` rewrite and security headers. Keep *Include files outside the Root Directory* enabled; the page preview imports the site templates from `../tools`.
**Netlify:** new site from this repository, Base directory `cms` (build command `node scripts/build-static.mjs`, publish directory `cms/public`, functions directory `cms/netlify/functions`; `cms/netlify.toml` sets all three plus headers). Every `/api/*` request goes to the one function `netlify/functions/api.mjs`. Set the environment variables in the Netlify UI with a scope that includes **Functions** (variables in `netlify.toml` do not reach functions), and redeploy after changing them.

Use a separate domain or subdomain (e.g. `cms.faithph.ai`) and separate Development, Preview and Production environment variables. Point Production at the production spreadsheet. Do not reuse the production spreadsheet for preview deployments.

### 5.4 Connecting the website

| Setting (website project) | Value |
| --- | --- |
| Build command | `node tools/build.mjs --deploy` |
| `CONTENT_SOURCE` | `cms` |
| `CMS_CONTENT_URL` | `https://cms.faithph.ai` |
| `CMS_PREVIEW_TOKEN` | **staging site only:** builds drafts (requires `staging` on in Site settings) |

In the CMS, set `PUBLIC_SITE_DEPLOY_HOOK_URL` to the website's build hook. Every publish,
unpublish, archive or delete then starts a rebuild, and admins also get a *Rebuild website* button.
**Timing:** the public endpoint caches for 60 seconds, and a static build takes about 1–2 minutes,
so new content is usually live **within about 3 minutes** of *Publish*.

> Exclude `cms/` from the **website** deploy (it is source code and fixtures, not site pages). With a
> publish directory or `.vercelignore`/Netlify settings, serve only the generated site files.

## 6. Environment variables (server-side only)

See `cms/.env.example`. Required on a hosted deployment (the CMS refuses to start without them):
`CMS_STORE=sheets`, `GOOGLE_SHEETS_SPREADSHEET_ID`, the service-account credentials
(`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`, or `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`),
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CMS_BASE_URL`, `CMS_SESSION_SECRET`
(32+ random characters) and `CMS_SUPER_ADMINS`. Optional: `CMS_ALLOWED_EMAIL_DOMAINS`,
`PUBLIC_SITE_URL`, `PUBLIC_SITE_DEPLOY_HOOK_URL`, `CMS_PREVIEW_TOKEN`, `CMS_IFRAME_HOSTS`,
`CMS_SESSION_HOURS`.

None of these is ever sent to the browser. `/api/session` exposes only non-secret settings.

## 7. Security

- **Credentials:** only in the host's environment variables. `.env` files are git-ignored (`cms/.gitignore` and the repository `.gitignore`). Turn on GitHub *secret scanning* and *push protection* for the repository (Settings → Code security). Repository access does not grant spreadsheet access.
- **If a secret leaks:** service-account key → delete the key in Google Cloud, create a new one, update the host env, redeploy. OAuth client secret → reset it in Google Cloud. `CMS_SESSION_SECRET` → change it (everyone is signed out). `CMS_PREVIEW_TOKEN` or a deploy hook → regenerate. Then check `audit_log` and the sheet's version history.
- **API:** every protected route requires a session. State-changing requests need the `X-CMS-CSRF` header and a same-origin `Origin`, and cookies are `SameSite=Lax`. Inputs are validated on the server (types, URL schemes, slugs, lengths, references).
- **Dashboard:** strict CSP (`script-src 'self'`), no inline scripts, `frame-ancestors 'none'`. All CMS data is rendered with DOM text APIs, never as HTML.
- **Page HTML (stored XSS):** drafts keep exactly what was pasted. Editing previews run in sandboxed iframes without `allow-scripts` and with their own CSP, and active elements (scripts, meta, base, frames…) are replaced by inert placeholders while editing. Published HTML goes through the allowlist sanitizer on the server, and again in the website build. It removes scripts, event handlers, `javascript:`/`data:` URLs, forms and embeds from hosts that are not on the allowed list, and `<style>` cannot break out of its element. Page CSS is scoped to the page's content wrapper, so it cannot restyle the header, footer or other pages. The editor and preview list everything publishing will remove.
- **Public endpoint:** returns only `published` payloads, without hidden events and testimonials. Internal and retired fields (owners, editors' emails, old consent and review data) are never included; there is a test for this.

## 8. Reliability, quotas and caching

- Google calls have an 8-second timeout. Reads and full-row writes retry 429, 5xx and network errors with exponential backoff and jitter, honouring `Retry-After`. Appends are never blindly retried: after a failure the tab is re-read, and the row is appended again only if it is missing (no duplicates).
- A save is reported as successful only after the row is read back with its new `write_id`.
- **Quotas:** Google Sheets allows about 300 read and 300 write requests per minute per project, and 60 per minute per user. All CMS traffic counts as one user, the service account. A save costs about 2 reads and 3 writes; a dashboard load costs 1 batched read. That is comfortable for a team of a few editors. On a rate limit, users see "Google Sheets is busy, wait a minute", and nothing is half-saved.
- **No cross-tab transactions:** publishing writes the live copy first, then the record. If the second write fails, the item is live but flagged; *Finish publishing* (or *Recovery*) completes it. If the first write fails, nothing changed.
- **Public cache:** 60 seconds in memory per server instance, plus a CDN copy (`s-maxage=60, stale-while-revalidate=600, stale-if-error=86400`). If Google is down, the last good snapshot is served with `x-content-stale: 1`. A failed edit is never shown as saved. The cache is not a backup.
- **Growth:** about 10 million cells per spreadsheet. `history` grows with every save, so archive old rows yearly (copy them to an archive spreadsheet, then delete them from `history`) once it passes about 20,000 rows.

## 9. Backup, recovery and rollback

| Situation | What to do |
| --- | --- |
| Wrong edit | Open the item → **History** → *Restore this version* (it becomes a draft), then publish. |
| Accidental delete | Super Admin → **Recovery and backup** → *Restore*. Deletes are soft; the row stays in the sheet. |
| Publish did not finish | Item banner or **Recovery** → *Finish publishing*. |
| Bad content went live | *Unpublish* the item (it is removed at the next rebuild), or restore an earlier version and publish it. |
| Sheet damaged by hand | Google Sheets *File → Version history* → restore a version from before the change. Then `npm run sheets:check`. |
| Full restore | `npm run restore -- backups/<file>.json` into a **new, empty** spreadsheet (the script refuses to overwrite data). Share it with the service account, update `GOOGLE_SHEETS_SPREADSHEET_ID`, redeploy. |
| Website deploy broke | Roll back to the previous deploy in Netlify/Vercel (*Deploys → Publish deploy* / *Promote to production*). The CMS is not affected. |
| CMS deploy broke | Roll back the CMS project's deploy the same way. Content in the sheet is unaffected. |

**Backups:** weekly, and before any bulk change: `npm run backup` (writes to `cms/backups/`,
git-ignored) or *Recovery → Download a full backup*. Store backups privately. They contain
internal fields (owners, editors' emails and any retired consent notes). Google's own version history is a second line,
not a replacement.

## 10. What is tested, and what is not

**Automated (`npm test`, 65 tests, all passing).** Added for this version: one-step publishing with no approval actions (the old ones answer 404) and no approval columns; testimonials with and without a photo, colour changes, hide and show again (public output, Hidden filter and dashboard count) and Author boundaries; the three event registration destinations (external link required, informational events never keep a URL, CMS event page needs content), automatic free slugs; hidden and draft events kept out of public and staging output; event cards (button routing, separate *Event details* link, no empty buttons, past events without buttons, date order) and the calendar data; time zones (offsets with summer time, past decided in the event's zone); migration of records and live copies from the earlier workflow without rewriting them; and, on the Sheets adapter mock, new tabs without retired columns while an older sheet's retired and hand-added columns are read and preserved. Earlier coverage: scoped Page CSS keeps its tokens; page documents (marker-based bindings that never match by text, nested and commented markup, empty-value placeholders, links removed when empty, generated components, card lists from the page); the read-time upgrade of older records without losing content; starter templates for all four types that publish with nothing removed and use only labelled placeholder images; reading time (reproduces every existing article’s value) and event duration; time-zone changes never moving an event; authors from the user list with a names-only byline; server-calculated reading time; hidden legacy values kept on save; event date ranges; preview following Details, custom layouts without the global navbar and footer, live-version preview; testimonial cards always showing the exact quote; and, as before: configuration fails closed; CSRF and authentication; the dev login is localhost-only; every role boundary; Author workflow; draft vs live separation; concurrent-edit conflicts; slug format, duplicates and live renames with redirects; field-level permissions (Super-Admin-only); content ownership (Authors change only their own items, including direct API requests); retired-role accounts mapped to Author and flagged for review; user management; archive, delete, undelete, history restore and audit; unsafe HTML kept in drafts but never published; both partial-publish failure paths; draft preview with the site templates; 45 XSS vectors; sanitizer stability and fidelity (all seven article bodies round-trip byte-for-byte); CSS sanitizing and scoping; and the Sheets adapter against an in-memory **mock** of the Sheets REST API (RS256 token exchange, header-name mapping, overflow cells, re-sorted rows, conflicts, retries, rate limits, duplicate-safe appends, actionable 403/key errors, a full create→publish flow).

**Manual in Chrome (local JSON store):** the full editor test from the brief. Paste a page with CSS → preview → edit a heading in place → change a button's label and URL → delete an element → save → reopen with styling intact → HTML mode shows the updated markup → preview with the site templates → publish. The website build of the published view shows the edited content with scoped CSS and no script.

**Not yet tested (needs real credentials or access):** calls against **real Google Sheets** (including `sheets:setup` and `sheets:seed`); real Google sign-in; a deployed Vercel/Netlify function (including the preview importing `../tools`); the deploy hook; GHL hosting. Run `npm run sheets:check` and the checklist in section 12 when credentials exist.

## 11. GoHighLevel (GHL)

faithph.ai is currently served by GHL (verified from response headers; see `docs/04`, decision D1).
The CMS does not need GHL; GHL keeps CRM, forms, workflows and email. Options for the pages:

- **Option C (recommended with this CMS):** host the generated static site on Netlify/Vercel. CMS publishes rebuild it automatically, rollback is one click, and GHL forms are embedded (`api.leadconnectorhq.com` / `link.msgsndr.com` are on the iframe allowed list). Event funnels stay on GHL.
- **Option B (pages inside GHL):** GHL pages are edited in GHL's builder. CMS content would have to be re-pasted after each publish, or loaded in the browser from `GET /api/public/content` (CORS is open for this read-only endpoint) by a custom-code element. Client-side loading is worse for SEO and is **not built or verified**.

**Status: not technically verified.** No GHL account access was available. Before choosing, run a one-page pilot (docs/04 §4).

## 12. Go-live checklist (CMS)

1. Sheet created, owned by Faith Works, shared only with the service account and the owner; tabs protected.
2. `npm run sheets:setup`, `npm run sheets:seed`, `npm run sheets:check` pass against the production sheet.
3. Hosted env vars set; `/api/health` shows `"configured": true`; dev login unavailable.
4. First Super Admin signs in with Google; team added under *Users and roles*; a test Author can publish their own item but cannot edit another Author’s item or open Users and roles.
5. Website project builds with `CONTENT_SOURCE=cms`; a test publish triggers the rebuild and appears within minutes; unpublish removes it.
6. Secret scanning and push protection enabled; first backup taken and stored privately.
7. Content team walked through: drafts, Publish, Show on the website, preview, HTML/visual editing, event registration choices. Testimonials are published only with the person's agreement to be quoted (the CMS no longer records consent; keep that record wherever the team keeps it).
