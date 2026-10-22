# Faith Works CMS

A separate, headless content management system for faithph.ai. Staff manage **programs, events,
resources/articles, testimonials, tags and site settings** in a dashboard. Content is stored in
**Supabase (Postgres)**, the single source of truth for CMS content, through a server-side
integration. The public website is rebuilt from the **published** content only.

Sign-in stays **Google OAuth**. The earlier **Google Sheets** integration (code, scripts, spreadsheet
and credentials) is kept, unchanged, for future data workflows (form submissions, inquiries,
registrations) and as an explicit rollback store. It is not used for CMS content.

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
                        │  service-role key (server only), Supabase Data API over HTTPS
                        ▼
                   Supabase Postgres ── tables cms_programs, cms_events, cms_resources,
                                        cms_testimonials, cms_settings, cms_tags, cms_users,
                                        cms_published, cms_history, cms_audit_log (RLS on)
                        │
                   (Google Sheets: separate, kept for future workflows; not CMS content)
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
| Storage adapters | `cms/server/store/` | `supabase-store.mjs` (production), `json-store.mjs` (local development and tests), `sheets-store.mjs` (kept; rollback only). Same interface. Chosen by `CMS_STORE`; never a silent fallback. |
| Database schema | `cms/supabase/migrations/` | SQL migrations for the Supabase tables, privileges and Row Level Security. |
| Website content interface | `tools/content.mjs` | `fixtures`, `local` or `cms` source; `published` or `preview` view; same output shape. |

**The public website does not depend on the CMS being online.** It is static. It reads the CMS
only while it is being built. If the CMS or its database is unavailable, the build stops and the host
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
  current role for it. Nothing is rewritten in the database automatically.
- Other people are rows in the `cms_users` table (the `users` tab with the Sheets store), managed only from **Users and roles**. Nobody can change their own role.
- Sign-in is **Google OAuth** (OpenID Connect with PKCE). The CMS never stores or sees a password.
  Scopes are `openid email` only. The ID token's RS256 signature is verified with Google's published
  keys (`https://www.googleapis.com/oauth2/v3/certs`, cached), then its issuer, audience, `azp`,
  expiry, nonce and `email_verified` are checked before the allowlist (`CMS_SUPER_ADMINS`, then
  active `users` rows) is consulted. The Google access token is discarded. Session and OAuth-state
  cookies are separately typed signed tokens; rotating `CMS_SESSION_SECRET` signs everyone out.
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

Five things: the **testimonial** (the quote), the **person's name**, an optional **role or title**
(shown below the name, e.g. *HR Manager*), an optional **profile photo** (a small round image
beside the name) and **Show on the website**. No approval step. A card without a photo has no image
element at all, and a photo that cannot load is removed in the browser.
The home page shows published, visible testimonials in display order. Card colours are not stored:
the website gives the cards Faith Pink, AI Yellow and Works White in turn by position, so
neighbouring cards always differ. Older records may still hold a `tone` value; it is ignored, and
`supabase/manual/20261020120000_testimonials_drop_card_colour.sql` removes it once approved (run
by hand after a backup; it is not applied by `supabase db push`).

### Events

An event is information for the Workshops page and its calendar: **title**, optional **short
description**, **start date** (needed to publish), start time, optional end date and end time, **time
zone** (Asia/Manila by default; stored as entered, never converted), optional **location or meeting
details**, optional **event images** (a gallery; see below), **Show on the website**, and *Where should the registration button go?*

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

**Event images (gallery).** An event holds up to 24 photos in display order (`gallery` in the
record: `{ url, alt, primary, featured }`). Editors upload JPEG/PNG/WebP files (5 MB each; the
server checks the file itself, never only its name), pick photos already on the website (the photo
registry, `src/data/gallery.json`) or paste an address; they describe each photo (alt text, needed
to publish), choose exactly one **Cover image**, tick **Show in the events gallery**, reorder by
dragging or with the arrow buttons, and remove photos. The cover is copied into
`featured_image_url` / `featured_image_alt` on every save, so event cards, link previews and older
readers keep working; an event saved before galleries is read as a one-image gallery (its image is
the cover, not shown in the Events gallery) until someone saves it. Event pages can show the other
photos with the **Event photos** block (`data-cms-component="event-gallery"`). The website's Events
gallery (homepage and Workshops, `tools/event-gallery.mjs`) shows the images marked for it from
published, visible events, followed by the archive in `src/data/events.json`. Uploads go to the
public Supabase Storage bucket `event-images` (local JSON store: `assets/images/uploads/`, or
`CMS_UPLOAD_DIR`); only their addresses are stored. The database enforces the gallery's shape (one
cover, no duplicate addresses, at most 24) with
`supabase/migrations/20261022000000_event_galleries.sql` (undo:
`supabase/manual/20261022000000_event_galleries_down.sql`). Uploaded files that end up on no event
are kept in the bucket (nothing deletes files automatically).

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

## 4. Database design (Supabase)

Migration: `cms/supabase/migrations/20261020000000_cms_content.sql` (idempotent; safe to run again).
One table per CMS collection and system tab, named `cms_<tab>`, all in the `public` schema.

| Table | Holds | Columns |
| --- | --- | --- |
| `cms_programs`, `cms_events`, `cms_resources` | Working copies (drafts) of page collections | `id` (PK), `slug`, workflow columns (below), `fields` jsonb |
| `cms_testimonials`, `cms_settings` | Working copies without a page | `id` (PK), workflow columns, `fields` jsonb |
| `cms_published` | The live, sanitized copy of each published item | `id` = `{collection}:{record_id}`, `record_id`, `collection`, `slug`, `version`, `state` (live / unpublished), `published_at/by`, `write_id`, `payload` jsonb |
| `cms_history` | Full copy of a record after every change (append-only) | `id`, `record_id`, `collection`, `version`, `kind`, `status`, `at`, `by`, `write_id`, `data` jsonb |
| `cms_audit_log` | Who did what, when (append-only) | `id`, `at`, `actor`, `role`, `action`, `collection`, `record_id`, `version`, `detail`, `request_id` |
| `cms_users` | CMS user records and roles (sign-in itself is Google OAuth) | `id` = lower-case email, `email`, `name`, `role`, `active`, `version`, `write_id`, created/updated |
| `cms_tags` | Tags | `id` (slug), `label`, `description`, `archived`, `version`, `write_id`, created/updated |

- **Workflow columns** (typed): `status`, `version`, `write_id`, `created_at/by`, `updated_at/by`,
  `published_at/by`, `published_version`, `published_slug`, `previous_slugs`, `deleted_at/by`.
- **`fields` (jsonb)** holds the collection's content fields exactly as defined in
  `cms/shared/schema.mjs` (title, summary, page HTML and CSS, tags, authors…), including legacy and
  retired values. Adding a field to the content model needs no migration. The adapter merges
  `fields` and the columns back into one flat record, so the services are store-independent.
- **Relationships** (authors → users, tags → tags, published/history → records) are checked by the
  CMS server, as before; there are no foreign keys, so a history row outlives its record.
- **Concurrency:** a save is one `UPDATE … WHERE id = … AND write_id = <the version you opened>`. If
  someone saved in between, nothing matches and the save is refused (no lost updates).
- **Access:** Row Level Security is enabled on every table with **no policies**, and the `anon` and
  `authenticated` roles have no privileges, so the public Data API (publishable/anon key) can read
  or write nothing. Only the CMS server, with the service-role key, has access: `select, insert,
  update` on content, users and tags; `select, insert` on `cms_history` and `cms_audit_log`. No role
  can delete rows (deletes are soft), and triggers reject any change to history or the audit log.
- Roles are not constrained in the database on purpose: a row with a retired role is kept,
  refused at sign-in and flagged for review (section 2).

## 4a. Spreadsheet design (Google Sheets: kept, not the content store)

The spreadsheet below is the earlier CMS content store. Its tabs, rows and credentials are left
exactly as they were. The CMS does not read or write it while `CMS_STORE=supabase`. It can be
read by `npm run supabase:import -- --from-sheets`, maintained with the `sheets:*` scripts, and
used again only by setting `CMS_STORE=sheets` deliberately (rollback). Future form, inquiry or
registration workflows can reuse `cms/server/store/sheets-api.mjs` (service-account client) with
their own tabs; do not route CMS content through it as well.


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
- `testimonials`: `quote, display_name, role, featured_image_url, visible, authors, sort_order` (an older sheet's `tone` column is kept but no longer used)
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

### 5.1 Local development (no Google or Supabase needed)

```bash
cd cms
cp .env.example .env          # CMS_STORE=json and CMS_DEV_LOGIN=true are fine locally
npm run dev                   # http://localhost:5174
npm test                      # roles, workflow, publishing, sanitizer, Supabase and Sheets adapters
```

The JSON store lives at `cms/.data/store.json` (git-ignored) and is seeded from `cms/fixtures/seed.json`.
The login screen offers the three `@example.test` users (one Super Admin, two Authors). The dev login is refused
unless the CMS is on localhost **and** not deployed (`VERCEL`/`NETLIFY` set) **and** not `NODE_ENV=production`.

To see your local edits on the website: `node tools/build.mjs --content=local` from the repository root.

### 5.2 Supabase (CMS content)

1. **Project:** create a Supabase project owned by a Faith Works account (not a personal developer account). Use a separate project (or at least a separate database) for preview/staging.
2. **Schema:** run the migration once. Either paste `cms/supabase/migrations/20261020000000_cms_content.sql` into *SQL Editor → New query → Run*, or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push` (run from `cms/`). It is idempotent.
3. **Keys:** *Project Settings → API Keys*. Copy the project URL into `SUPABASE_URL` and a **secret** key (`sb_secret_…`, *Secret keys* section) into `SUPABASE_SECRET_KEY`, in the CMS host's environment only. The CMS refuses to start with a publishable/anon key. The legacy `SUPABASE_SERVICE_ROLE_KEY` (the `service_role` JWT) is still accepted while `SUPABASE_SECRET_KEY` is unset, so existing deployments keep working; when both are set, `SUPABASE_SECRET_KEY` wins. To migrate: set `SUPABASE_SECRET_KEY`, redeploy, confirm `/api/health` shows `"supabaseKey":"secret"`, then delete `SUPABASE_SERVICE_ROLE_KEY`. The public website needs no Supabase key at all.
4. **Data API:** leave the Data API on (the CMS uses it with the secret key). The `cms_*` tables are closed to the public keys by the migration, so nothing is exposed.
5. **Load the content** (every command only adds missing rows, never changes or deletes, and is safe to rerun):
   ```bash
   cd cms
   npm run supabase:import -- --from-sheets --dry-run   # what would be copied from the Google Sheet
   npm run supabase:import -- --from-sheets             # copy the CMS tabs of the Sheet (the Sheet is only read)
   npm run supabase:seed                                # or: start from cms/fixtures/seed.json instead
   npm run supabase:check                               # access, tables and row counts
   ```
   `supabase:import -- <backup.json>` loads a backup file instead. Imports keep ids, versions,
   timestamps, publishing state and history, and verify every row afterwards.

**Status of the existing spreadsheet (checked 20 Oct 2026, read only):** it held 4 programs, 4
events, 9 resources, 8 testimonials, the Site settings row and its live copy, and no users, tags,
history or audit rows. Every row was identical (same `write_id`) to `cms/fixtures/seed.json`,
so there was no editorial content beyond the seed. Its `settings` tab is also missing the four
newest columns (`booking_url`, `featured_video_*`), so `sheets:check` currently stops there; the
import reads the sheet without that check, and the missing values are empty.

### 5.3 Google Cloud: sign-in and the spreadsheet

1. **Spreadsheet:** create a blank Google Sheet owned by a Faith Works Google account (not a personal developer account). Keep sharing *Restricted*; never "Anyone with the link". Copy its ID from the URL (`/d/<ID>/edit`).
2. **Google Cloud project** (owned by the same organization): enable the **Google Sheets API**.
3. **Service account:** *IAM & Admin → Service accounts → Create*. Give it no project roles. Create a JSON key.
4. **Share the spreadsheet** with the service account's email as **Editor**, and with nobody else who does not need it.
5. **OAuth client for sign-in:** *APIs & Services → OAuth consent screen* (Internal if you use Google Workspace, otherwise External with test users), then *Credentials → Create OAuth client ID → Web application*.
   Authorized redirect URI: `https://<cms-domain>/api/auth/google/callback` (and `http://localhost:5174/api/auth/google/callback` for local tests).
6. **Sheets integration (optional, kept):** set the `GOOGLE_SHEETS_*` / service-account variables only if a workflow uses the spreadsheet (or for `supabase:import -- --from-sheets`). These scripts maintain the CMS tabs of the sheet, which are no longer the content store:
   ```bash
   cd cms
   npm run sheets:setup    # creates tabs and header columns (never reorders or deletes)
   npm run sheets:seed     # adds missing cms/fixtures/seed.json rows by id; safe to rerun (dev users are skipped)
   npm run sheets:seed -- --dry-run   # read-only: which seed rows are present / missing
   npm run sheets:check    # access, headers and row counts
   ```

### 5.4 Deploying the CMS

**Vercel:** new project from this repository, Root Directory `cms`. `cms/vercel.json` sets the build, the `public/` output, the `/api` rewrite and security headers. Keep *Include files outside the Root Directory* enabled; the page preview imports the site templates from `../tools`.
**Netlify:** new site from this repository, Base directory `cms` (build command `node scripts/build-static.mjs`, publish directory `cms/public`, functions directory `cms/netlify/functions`; `cms/netlify.toml` sets all three plus headers). Every `/api/*` request goes to the one function `netlify/functions/api.mjs`. Set the environment variables in the Netlify UI with a scope that includes **Functions** (variables in `netlify.toml` do not reach functions), and redeploy after changing them.

Use a separate domain or subdomain (e.g. `cms.faithph.ai`) and separate Development, Preview and Production environment variables. Point Production at the production Supabase project. Do not reuse the production database for preview deployments.

**Netlify, when switching an existing CMS site to Supabase:** add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (scope: Functions), set `CMS_STORE=supabase` or remove `CMS_STORE` (the hosted default is `supabase`; a leftover `CMS_STORE=sheets` keeps using Sheets), keep every Google variable, and redeploy. `/api/health` then shows `"store":"supabase"` and `"supabaseKey":"secret"`.

### 5.5 Connecting the website

The website's root `vercel.json` sets the build: `node tools/build.mjs --deploy --content=cms
--view=published --out=dist`, served from `dist/`. That folder holds only the generated pages, `css/`,
`js/` and `assets/` (not `assets/data`); `cms/`, `src/`, `tools/` and `docs/` are never served.

| Setting (website project) | Value |
| --- | --- |
| `CMS_CONTENT_URL` | `(the CMS address; required, the build stops without it) |
| `CONTENT_SOURCE` | `cms` (optional: `vercel.json` already passes `--content=cms`) |
| `CMS_PREVIEW_TOKEN` | **never on production.** Staging site only, with its own build command using `--view=preview` |

The website project needs **no** Supabase, Google or CMS secrets.

**Failures:** if the CMS cannot be reached, answers an error, or has never published Site settings, the
build stops with an error and Vercel keeps serving the previous deployment. A Vercel build never falls
back to the fixtures (it refuses any source other than `cms`).

**The CMS must be publicly reachable at `/api/public/content`.** Netlify *Visitor access* (password or
team-login protection) blocks every request, including the website build's (HTTP 401). Set it to protect
**non-production deploys only**, or turn it off. That is safe because the CMS protects itself: every
route except `/api/health`, `/api/public/content`, `/api/session` and the Google sign-in routes needs a
signed-in user on the CMS user list (there is a test for this), drafts need `CMS_PREVIEW_TOKEN`, and
the dashboard page itself holds no data until you sign in.

In the CMS, set `PUBLIC_SITE_DEPLOY_HOOK_URL` to the website's build hook (Vercel: *Settings → Git →
Deploy Hooks*, branch `main`). Every publish, unpublish, archive or delete then starts a rebuild, admins
also get a *Rebuild website* button, and `netlify/functions/daily-rebuild.mjs` rebuilds the site every
day at 00:05 Manila time so that finished events move from *Upcoming* to *Past* without an edit.
**Timing:** the public endpoint is not cached by the CDN (at most 10 seconds in memory), and a static
build takes about 1–2 minutes, so new content is usually live **within about 2 minutes** of *Publish*.

## 6. Environment variables (server-side only)

See `cms/.env.example`. Required on a hosted deployment (the CMS refuses to start without them):

| Purpose | Variables |
| --- | --- |
| CMS content (Supabase) | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (`sb_secret_…`; legacy `SUPABASE_SERVICE_ROLE_KEY` still read if unset); `CMS_STORE=supabase` (the hosted default) |
| Sign-in (Google OAuth) | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` |
| Session and access | `CMS_SESSION_SECRET` (32+ random characters), `CMS_SUPER_ADMINS`; optional `CMS_SESSION_HOURS`, `CMS_ALLOWED_EMAIL_DOMAINS` |

Kept for the Google Sheets integration (required only with `CMS_STORE=sheets`, otherwise optional):
`GOOGLE_SHEETS_SPREADSHEET_ID` and the service-account credentials (`GOOGLE_SERVICE_ACCOUNT_EMAIL` +
`GOOGLE_PRIVATE_KEY`, or `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`). Optional website settings:
`PUBLIC_SITE_URL`, `PUBLIC_SITE_DEPLOY_HOOK_URL` (also used by the daily rebuild), `CMS_PREVIEW_TOKEN`, `CMS_IFRAME_HOSTS`.
Website form submissions (all optional; the endpoint stays off without `FORMS_ALLOWED_ORIGINS`):
`FORMS_ALLOWED_ORIGINS`, `FORMS_RATE_LIMIT`, `RESEND_API_KEY`, `FORMS_EMAIL_FROM`, `FORMS_NOTIFY_TO`,
`FORMS_NOTIFY_TO_<FORM_ID>`, `FORMS_SHEETS_MIRROR`, `FORMS_SHEETS_TAB`, `NETLIFY_FORMS_WEBHOOK_SECRET` (§13).

The public website (Vercel) needs none of these; it only reads `/api/public/content` from the CMS
(its one setting is `CMS_CONTENT_URL`, see §5.5).

None of these is ever sent to the browser. `/api/session` exposes only non-secret settings.

## 7. Security

- **Credentials:** only in the host's environment variables. `.env` files are git-ignored (`cms/.gitignore` and the repository `.gitignore`). Turn on GitHub *secret scanning* and *push protection* for the repository (Settings → Code security). Repository access does not grant spreadsheet access.
- **If a secret leaks:** Supabase service-role/secret key → rotate it in *Project Settings → API Keys* (create a new secret key and delete the old one, or roll the JWT secret for legacy keys), update the host env, redeploy. Service-account key → delete the key in Google Cloud, create a new one, update the host env, redeploy. OAuth client secret → reset it in Google Cloud. `CMS_SESSION_SECRET` → change it (everyone is signed out). `CMS_PREVIEW_TOKEN` or a deploy hook → regenerate. Then check the audit log (`cms_audit_log`).
- **API:** every protected route requires a session. State-changing requests need the `X-CMS-CSRF` header and a same-origin `Origin`, and cookies are `SameSite=Lax`. Inputs are validated on the server (types, URL schemes, slugs, lengths, references).
- **Dashboard:** strict CSP (`script-src 'self'`), no inline scripts, `frame-ancestors 'none'`. All CMS data is rendered with DOM text APIs, never as HTML.
- **Page HTML (stored XSS):** drafts keep exactly what was pasted. Editing previews run in sandboxed iframes without `allow-scripts` and with their own CSP, and active elements (scripts, meta, base, frames…) are replaced by inert placeholders while editing. Published HTML goes through the allowlist sanitizer on the server, and again in the website build. It removes scripts, event handlers, `javascript:`/`data:` URLs, forms and embeds from hosts that are not on the allowed list, and `<style>` cannot break out of its element. Page CSS is scoped to the page's content wrapper, so it cannot restyle the header, footer or other pages. The editor and preview list everything publishing will remove.
- **Public endpoint:** returns only `published` payloads, without hidden events and testimonials. Internal and retired fields (owners, editors' emails, old consent and review data) are never included; there is a test for this.

## 8. Reliability, quotas and caching

- **Supabase store:** every call has an 8-second timeout; reads and updates retry 429, 5xx and network errors with backoff (an update recognises its own earlier attempt by its `write_id`). Inserts and log entries are retried only after checking that the first attempt did not land, so there are no duplicates. A database failure is reported to the user ("The CMS database (Supabase) could not be reached…"); the CMS never falls back to Google Sheets or local data. Publishing still writes the live copy first and the record second (see below).
- *The rest of this section describes the Google Sheets store (rollback only).* Google calls have an 8-second timeout. Reads and full-row writes retry 429, 5xx and network errors with exponential backoff and jitter, honouring `Retry-After`. Appends are never blindly retried: after a failure the tab is re-read, and the row is appended again only if it is missing (no duplicates).
- A save is reported as successful only after the row is read back with its new `write_id`.
- **Quotas:** Google Sheets allows about 300 read and 300 write requests per minute per project, and 60 per minute per user. All CMS traffic counts as one user, the service account. A save costs about 2 reads and 3 writes; a dashboard load costs 1 batched read. That is comfortable for a team of a few editors. On a rate limit, users see "Google Sheets is busy, wait a minute", and nothing is half-saved.
- **No cross-tab transactions:** publishing writes the live copy first, then the record. If the second write fails, the item is live but flagged; *Finish publishing* (or *Recovery*) completes it. If the first write fails, nothing changed.
- **Public cache:** 10 seconds in memory per server instance and `cache-control: no-store` (no CDN copy), so a build started by *Publish* always reads the new content. If the database is down, an instance that has a snapshot serves it with `x-content-stale: 1` (the website build logs a warning). A failed edit is never shown as saved. The cache is not a backup.
- **Growth:** about 10 million cells per spreadsheet. `history` grows with every save, so archive old rows yearly (copy them to an archive spreadsheet, then delete them from `history`) once it passes about 20,000 rows.

## 9. Backup, recovery and rollback

| Situation | What to do |
| --- | --- |
| Wrong edit | Open the item → **History** → *Restore this version* (it becomes a draft), then publish. |
| Accidental delete | Super Admin → **Recovery and backup** → *Restore*. Deletes are soft; the row stays in the database. |
| Publish did not finish | Item banner or **Recovery** → *Finish publishing*. |
| Bad content went live | *Unpublish* the item (it is removed at the next rebuild), or restore an earlier version and publish it. |
| Sheet damaged by hand | Google Sheets *File → Version history* → restore a version from before the change. Then `npm run sheets:check`. |
| Full restore (Supabase) | Supabase *Database → Backups* (daily on paid plans; point-in-time recovery if enabled), or `npm run supabase:import -- backups/<file>.json` into an empty project after running the migration. |
| Full restore (Sheets store) | `npm run restore -- backups/<file>.json` into a **new, empty** spreadsheet (the script refuses to overwrite data). Share it with the service account, update `GOOGLE_SHEETS_SPREADSHEET_ID`, redeploy. |
| Website deploy broke | Roll back to the previous deploy in Netlify/Vercel (*Deploys → Publish deploy* / *Promote to production*). The CMS is not affected. |
| CMS deploy broke | Roll back the CMS project's deploy the same way. Content in the database is unaffected. |
| Roll back to the Sheets store | Only deliberately: `npm run supabase:backup`, set `CMS_STORE=sheets`, redeploy. Edits made in Supabase since the switch are **not** in the sheet; copy them by hand, or load the backup with `npm run restore` into a new, empty spreadsheet. |

**Backups:** weekly, and before any bulk change: `npm run supabase:backup` (writes to `cms/backups/`,
git-ignored; `npm run backup` is the Sheets equivalent) or *Recovery → Download a full backup*. Store backups privately. They contain
internal fields (owners, editors' emails and any retired consent notes). Google's own version history is a second line,
not a replacement.

## 10. What is tested, and what is not

**Automated (`npm test`, 65 tests, all passing).** Added for this version: one-step publishing with no approval actions (the old ones answer 404) and no approval columns; testimonials with and without a photo, colour changes, hide and show again (public output, Hidden filter and dashboard count) and Author boundaries; the three event registration destinations (external link required, informational events never keep a URL, CMS event page needs content), automatic free slugs; hidden and draft events kept out of public and staging output; event cards (button routing, separate *Event details* link, no empty buttons, past events without buttons, date order) and the calendar data; time zones (offsets with summer time, past decided in the event's zone); migration of records and live copies from the earlier workflow without rewriting them; and, on the Sheets adapter mock, new tabs without retired columns while an older sheet's retired and hand-added columns are read and preserved. Earlier coverage: scoped Page CSS keeps its tokens; page documents (marker-based bindings that never match by text, nested and commented markup, empty-value placeholders, links removed when empty, generated components, card lists from the page); the read-time upgrade of older records without losing content; starter templates for all four types that publish with nothing removed and use only labelled placeholder images; reading time (reproduces every existing article’s value) and event duration; time-zone changes never moving an event; authors from the user list with a names-only byline; server-calculated reading time; hidden legacy values kept on save; event date ranges; preview following Details, custom layouts without the global navbar and footer, live-version preview; testimonial cards always showing the exact quote; and, as before: configuration fails closed; CSRF and authentication; the dev login is localhost-only; every role boundary; Author workflow; draft vs live separation; concurrent-edit conflicts; slug format, duplicates and live renames with redirects; field-level permissions (Super-Admin-only); content ownership (Authors change only their own items, including direct API requests); retired-role accounts mapped to Author and flagged for review; user management; archive, delete, undelete, history restore and audit; unsafe HTML kept in drafts but never published; both partial-publish failure paths; draft preview with the site templates; 45 XSS vectors; sanitizer stability and fidelity (all seven article bodies round-trip byte-for-byte); CSS sanitizing and scoping; and the Sheets adapter against an in-memory **mock** of the Sheets REST API (RS256 token exchange, header-name mapping, overflow cells, re-sorted rows, conflicts, retries, rate limits, duplicate-safe appends, actionable 403/key errors, a full create→publish flow).

**Manual in Chrome (local JSON store):** the full editor test from the brief. Paste a page with CSS → preview → edit a heading in place → change a button's label and URL → delete an element → save → reopen with styling intact → HTML mode shows the updated markup → preview with the site templates → publish. The website build of the published view shows the edited content with scoped CSS and no script.

**Supabase (20 Oct 2026).** `npm test` includes `test/supabase.test.mjs`: configuration (service-role key required, anon/publishable keys refused, Google settings still loaded), record ↔ row mapping, database-side conflict detection, duplicate-safe inserts after a dropped connection, retries and error reporting, insert-only imports, and a create → publish → unpublish → history → audit flow. Against a **real Postgres 16 + PostgREST** (a local Supabase-equivalent with the `anon`/`authenticated`/`service_role` roles and Supabase's default grants, in Docker): the migration applies and re-applies cleanly; anon and key-less requests are refused on every table; the service role cannot delete rows or change history/audit (triggers also stop the table owner); `test/api.test.mjs` and `test/pages.test.mjs` pass on the Supabase store (44 of 45; the other test reads the JSON file directly, and the same check was confirmed in SQL); `supabase:import -- --from-sheets` copied the real spreadsheet, a rerun added nothing, and all 27 records compared field by field were identical. To repeat: set `CMS_TEST_SUPABASE_URL`, `CMS_TEST_SUPABASE_KEY` and `CMS_TEST_SUPABASE_RESET` (see `test/helpers.mjs`; use a throwaway database) and run `node --test --test-concurrency=1 test/api.test.mjs test/pages.test.mjs`.

**Not yet tested (needs real credentials or access):** a hosted **Supabase project** (no project or keys were available: the migration and adapter were verified on Postgres + PostgREST, not on supabase.co); writes to **real Google Sheets** (including `sheets:setup` and `sheets:seed`; reading it was verified); real Google sign-in; a deployed Vercel/Netlify function (including the preview importing `../tools`); the deploy hook; GHL hosting. Run `npm run sheets:check` and the checklist in section 12 when credentials exist.

## 11. GoHighLevel (GHL)

faithph.ai is currently served by GHL (verified from response headers; see `docs/04`, decision D1).
The CMS does not need GHL; GHL keeps CRM, forms, workflows and email. Options for the pages:

- **Option C (recommended with this CMS):** host the generated static site on Netlify/Vercel. CMS publishes rebuild it automatically, rollback is one click, and GHL forms are embedded (`api.leadconnectorhq.com` / `link.msgsndr.com` are on the iframe allowed list). Event funnels stay on GHL.
- **Option B (pages inside GHL):** GHL pages are edited in GHL's builder. CMS content would have to be re-pasted after each publish, or loaded in the browser from `GET /api/public/content` (CORS is open for this read-only endpoint) by a custom-code element. Client-side loading is worse for SEO and is **not built or verified**.

**Status: not technically verified.** No GHL account access was available. Before choosing, run a one-page pilot (docs/04 §4).

## 12. Go-live checklist (CMS)

1. Supabase project owned by Faith Works; migration run; `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (`sb_secret_…`) set only in the CMS host's environment; no `SUPABASE_SERVICE_ROLE_KEY` left behind.
2. `npm run supabase:import -- --from-sheets` (or `supabase:seed`) and `npm run supabase:check` pass against the production project; the spreadsheet stays shared only with the service account and the owner.
3. Hosted env vars set; `/api/health` shows `"store": "supabase"`, `"configured": true` and `"supabaseKey": "secret"`; dev login unavailable.
4. First Super Admin signs in with Google; team added under *Users and roles*; a test Author can publish their own item but cannot edit another Author’s item or open Users and roles.
5. Website project builds with `CONTENT_SOURCE=cms`; a test publish triggers the rebuild and appears within minutes; unpublish removes it.
6. Secret scanning and push protection enabled; first backup taken and stored privately.
7. Content team walked through: drafts, Publish, Show on the website, preview, HTML/visual editing, event registration choices. Testimonials are published only with the person's agreement to be quoted (the CMS no longer records consent; keep that record wherever the team keeps it).
8. Form submissions (§13): migration run; one labelled test per form appears under *Form submissions*; the alert arrives at the right recipients; an Author cannot open the page.

## 13. Website form submissions

Every website form (Starter Kit, program interest, corporate inquiry, speaking, Faith AI demo,
general contact, event notify) can send its submissions to the CMS. Super Admins see them under
**Inbox → Form submissions**. This replaces the earlier plan of native GHL forms (docs/04, docs/06)
for capture. GHL itself is untouched; a GHL forwarder could later be added as another delivery
channel.

### 13.1 Architecture

```
 Website form (js/forms.js, any host) ── POST JSON + request id ──► CMS /api/forms/submit
                                                                     │  validate (shared/forms.mjs),
 Netlify Forms (future, optional) ── signed webhook ──► /api/forms/netlify   classify, rate-limit
                                                                     ▼
                                        Supabase cms_form_submissions   ◄── canonical record
                                                                     │  then, each with its own state:
                                       ┌─────────────────────────────┴───────────────┐
                                       ▼                                             ▼
                          Team email alert (Resend)                 Copy in the Sheet's own
                                                                    "form_submissions" tab (optional)
          retried by netlify/functions/forms-retry.mjs (every 10 min) and by "Retry now" in the CMS
```

| Piece | Where |
| --- | --- |
| Form definitions (fields, options, limits), one source for the website markup and the server | `shared/forms.mjs` (used by `tools/render.mjs`) |
| Provider adapters (the hosting boundary) | `server/forms/adapters.mjs`: `cms_endpoint` (website forms, any host), `netlify_forms` (Netlify webhook) |
| Capture, delivery, retries, CMS operations | `server/forms/submissions.mjs` |
| Email alert | `server/forms/notify.mjs` (Resend over HTTPS, no SDK) |
| Sheets copy | `server/forms/sheets-mirror.mjs` (reuses `server/store/sheets-api.mjs`) |
| Dashboard screens | `public/ui/submissions.mjs` |
| Database | `supabase/migrations/20261021000000_form_submissions.sql` |

**One source of truth.** The row in `cms_form_submissions` is the submission. The email and the
Sheets row are notifications/copies; the CMS never reads them back, so the Submissions page works
while Resend or Google is down. Each row is keyed by provider + provider id (the browser's request
id, reused on retries, or Netlify's submission id), so a retry, double click or webhook redelivery
never creates a second row or a second alert.

**Order of work.** Validate → store → only then email and copy. The visitor sees success as soon
as the row is stored, never before. If email or Sheets fails, the row keeps the error
(`notify_state` / `sheets_state` = failed, with the message), the list shows *Delivery failed*,
and the retry job tries again (up to 6 automatic attempts; a Super Admin can always press *Retry
now*). Resend receives the submission id as its Idempotency-Key, and the Sheets copy looks for the
id in the tab before appending, so retries do not duplicate.

### 13.2 Security

- **Public endpoint** `POST /api/forms/submit`: off until `FORMS_ALLOWED_ORIGINS` is set; accepts
  only requests whose `Origin` is listed (CORS answers only that origin); JSON up to 64 KB; every
  field is validated and normalised on the server against `shared/forms.mjs` (unknown fields
  dropped, control characters removed, select values checked, lengths limited).
- **Spam:** the honeypot field and the 2.5-second time trap are re-checked on the server. Spam is
  stored as *Spam* (reviewable and reclassifiable), answered like a success so bots learn
  nothing, and never emailed or copied. **Test records** (addresses at `example.com/.org/.net` or
  `*.test`, or a name starting with "Test"/"[TEST]") are labelled *Test*, and their alert subject
  starts with `[TEST]`.
- **Rate limit:** `FORMS_RATE_LIMIT` (default 5) per connection per 10 minutes, counted in the
  database with a keyed hash of the visitor's address (HMAC with `CMS_SESSION_SECRET`). The
  address itself is never stored.
- **Access:** Super Admins only (API-enforced: 403 for Authors, 401 without a session). The table
  has RLS on, no policies, no privileges for `anon`/`authenticated`, and no DELETE for anyone.
  Status and type changes go to the audit log (no personal data in the entry).
- **Email content:** form type, the person's name, the time (Manila), the form's answers (option
  labels; free text over 300 characters shortened), the offer and source page, and a link into the
  CMS. Never the email address, phone or consent record: those stay behind the sign-in. Spam is
  never emailed; tests are marked `[TEST]`.
- **Recipient:** `projects@digitalgrowthscale.com` for every form, built in
  (`DEFAULT_NOTIFY_TO`, server/config.mjs). `FORMS_NOTIFY_TO` replaces it only if set; an invalid
  value switches alerts off rather than falling back.
- **Netlify webhook:** `X-Webhook-Signature` (JWS, HS256) is verified with
  `NETLIFY_FORMS_WEBHOOK_SECRET`, including the issuer and the SHA-256 of the exact body, before
  anything is read. Without the secret the route answers 404.
- **Secrets** (`RESEND_API_KEY`, `NETLIFY_FORMS_WEBHOOK_SECRET`, Supabase and Google keys) exist
  only in the CMS host's environment. The website has none: `js/config.js` holds only the endpoint
  URL. Logs contain submission ids and error codes, never answers or addresses.

### 13.3 Google Sheets coexistence

The spreadsheet holds only the earlier CMS-content tabs (rollback store, §4a). No form, report or
trigger tabs were found (read-only check, 20 Oct 2026). With `FORMS_SHEETS_MIRROR=true` the CMS
writes **only** the tab named by `FORMS_SHEETS_TAB` (`form_submissions`). It creates the tab with a
header row if it is missing. If the tab exists, its own header row is used as-is: columns are
matched by name, extra columns are left empty, nothing is reordered or overwritten, and rows are
only appended (values RAW). The CMS-content tabs, credentials, sharing and `sheets:*` scripts are
unchanged. Note: `npm run sheets:check` already reported a missing `role` column on the
`testimonials` tab before this change; that is a separate, pre-existing item (`npm run
sheets:setup`, after a backup).

### 13.4 Setup (needs credentials and approval)

1. **Database** (additive: one new table): run `supabase/migrations/20261021000000_form_submissions.sql`
   in the Supabase SQL editor, or `supabase db push`. Check: `/api/health` shows `"forms": {…}` and
   the Submissions page loads.
2. **Email:** a Resend account owned by Faith Works; verify the sending domain (Resend lists the
   SPF/DKIM DNS records to add; faithph.ai's DNS is on Cloudflare in front of GHL); create an API
   key with *sending access* only; set `RESEND_API_KEY` and `FORMS_EMAIL_FROM`. Leave
   `FORMS_NOTIFY_TO` empty to use projects@digitalgrowthscale.com. Then send one labelled test
   per form and confirm each alert arrives there before calling alerts live.
3. **Sheets copy:** `FORMS_SHEETS_MIRROR=true`. The service account already has access.
4. **Switch on the endpoint:** `FORMS_ALLOWED_ORIGINS=https://<website origin>` (staging first).
   Set every variable in the Netlify UI with the **Functions** scope and redeploy. The retry
   function (`netlify/functions/forms-retry.mjs`) runs on published production deploys only.
5. **Website:** in `js/config.js` set `forms.mode = "endpoint"` and
   `forms.endpoint = "https://<cms-domain>/api/forms/submit"`; rebuild and deploy. Send one
   labelled test per form (`[TEST]` name, an `@example.test` address) and check the CMS, the alert
   and the Sheets tab.

| Variable (CMS host, Functions scope) | Purpose |
| --- | --- |
| `FORMS_ALLOWED_ORIGINS` | Website origins allowed to submit; empty = endpoint off |
| `FORMS_RATE_LIMIT` | Per connection per 10 minutes (default 5) |
| `RESEND_API_KEY`, `FORMS_EMAIL_FROM` | Alert sending (sender on a verified domain) |
| `FORMS_NOTIFY_TO`, `FORMS_NOTIFY_TO_<FORM_ID>` | Optional overrides of the built-in recipient (projects@digitalgrowthscale.com) |
| `FORMS_SHEETS_MIRROR`, `FORMS_SHEETS_TAB` | Optional copy to the spreadsheet |
| `NETLIFY_FORMS_WEBHOOK_SECRET` | Only with native Netlify Forms (§13.5) |

Problems with these settings never stop the CMS. They are listed on the Submissions page (and
counted on `/api/health`), and only the affected part stays off.

### 13.5 Moving the website from Vercel to Netlify

The CMS and its submission history do not move or change.

- **A. Keep the website's own forms (recommended; nothing to rebuild).** Deploy the website to
  Netlify (build `node tools/build.mjs --deploy --content=cms --view=published --out=dist`,
  publish `dist`, `CMS_CONTENT_URL` as today; `_redirects` is already generated). Add the new
  origin to `FORMS_ALLOWED_ORIGINS`, keeping the Vercel origin until the switch is complete. The
  forms keep posting to the same CMS endpoint. In the new Netlify site turn *Forms → Form
  detection* off, so Netlify does not collect them a second time.
- **B. Native Netlify Forms.** Each form needs `data-netlify="true"`, a `name` equal to its form id
  (`general_contact`…), a hidden `form-name` input and static markup in the built HTML (it already
  is), and js/forms.js must post url-encoded to the page instead of JSON to the CMS. In Netlify add
  an outgoing webhook *Form submission → https://<cms-domain>/api/forms/netlify* with a JWS
  secret, and set the same secret as `NETLIFY_FORMS_WEBHOOK_SECRET` on the CMS. Submissions then
  appear in the same CMS list (marked *Netlify Forms*), stored once under Netlify's id.
  **Not built:** the markup and js/forms.js changes for B. The webhook receiver is built and tested
  with signatures made to Netlify's documented format, not against a live Netlify site.

After a move, test: one labelled submission per form, a duplicate, an alert, the Sheets row, and a
signed-out request to `/api/submissions` (must answer 401). DNS and the production host change
only with approval.

### 13.6 Tested

`npm test` (102 tests) includes `test/forms.test.mjs` and a Supabase-adapter test: the website
renders exactly the fields the server accepts; server validation; endpoint off by default; CORS;
storage before alerting; duplicates (one row, one email); honeypot and time-trap spam; test-record
labelling; rate limits; Resend HTTP and network failures, the 6-attempt cap, manual retry with the
same idempotency key; an interrupted send; a status change during a send; the database unavailable
(no false success; the browser's retry succeeds); the Sheets copy (own tab only, existing header
order kept, Google failure and a lost reply without duplicate rows); Netlify signatures (wrong
secret, body, issuer) and redelivery; Super-Admin-only access; search, filters (type, Manila dates,
status, spam/test) and audited status changes. In Chrome (local JSON store, no email key): a test
contact submission from the built website reached the CMS list and detail screens and its status
was changed. **Not yet tested** (needs credentials or access): the migration on the hosted
Supabase project, a real Resend send and domain verification, writes to the real spreadsheet, the
deployed Netlify functions including the scheduled retry, and a live Netlify Forms webhook.
