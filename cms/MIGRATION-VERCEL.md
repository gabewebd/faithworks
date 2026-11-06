# CMS migration: Netlify → Vercel (preparation)

Status: **audit and plan only.** Nothing has been deployed, no host, DNS, Supabase or GHL setting has
been changed, and the Netlify CMS (`https://faithworks-cms.netlify.app`) keeps running as it is.
Branch: `migration/netlify-to-vercel`. Secrets are never written to this file; names only.

## 1. Current architecture

```
Staff browser ──► CMS dashboard (cms/public, static)  ─┐
                  CMS API  (cms/server, one function) ◄─┘  same origin, signed cookie, CSRF header
                     │  Supabase REST + Storage (secret key, server only; no supabase-js)
                     ▼
                  Supabase: cms_* tables (RLS on) + public bucket "event-images"
                     │
   GET /api/public/content (published only, CORS *, no-store)
      ├──► Website build on Vercel (tools/build.mjs; env CMS_CONTENT_URL)
      └──► GHL pages in the browser (js/fw-live.js, GHL Resources embed: data-cms-url="…netlify.app")
CMS ──► PUBLIC_SITE_DEPLOY_HOOK_URL (Vercel deploy hook of the website) on publish / daily / scheduled
```

* Framework: none. Plain Node ≥ 20 ES modules, **zero dependencies** (no `npm install` needed).
  Build = `node scripts/build-static.mjs` (copies `shared/*.mjs` into `public/shared/`).
* The server is platform-neutral (`server/app.mjs`: web `Request` → `Response`). It already has
  both entry points: `netlify/functions/api.mjs` and `api/index.mjs` (Vercel), plus `cms/vercel.json`.
* Hosted mode is detected from `VERCEL` or `NETLIFY` (`server/config.mjs`). Vercel sets `VERCEL=1` at
  runtime, so the Supabase store and the production checks switch on there too.
* Auth: Google OIDC (code + PKCE) implemented in `server/auth.mjs`; stateless HMAC session cookie
  (`__Host-cms_session`); roles from `cms_users` + `CMS_SUPER_ADMINS`. Supabase Auth is **not** used.
* Media: `POST /api/media` reads the raw body (max 5 MB) and uploads it to Supabase Storage bucket
  `event-images`; the public object URL is stored on the record. Images live in Supabase, not on the host.
* Preview (`POST /api/preview`) imports the website renderers from `../tools`, which read
  `../data/*.json`, `../assets/icons/**` and `fixtures/seed.json` at runtime.

## 2. Compatibility

| Area | Transfers as is | Needs adaptation |
| --- | --- | --- |
| Static dashboard (`public/`) | ✓ `vercel.json` outputDirectory | |
| API function | ✓ `api/index.mjs` + rewrite `/api/(.*)` → `/api` | Verify `request.url` keeps the original path after the rewrite (`app.mjs` has a `__path` fallback that the rewrite does not set) |
| Security headers | ✓ duplicated in `vercel.json`; the server also sets them per response | |
| Supabase DB + Storage | ✓ HTTPS REST calls, no host coupling, no schema change | Pick a function region close to the Supabase region |
| Google sign-in | ✓ code is host-neutral | Add the new callback URL in Google Cloud; set `CMS_BASE_URL` per environment |
| Image upload | | **Vercel request body limit is 4.5 MB**; the CMS accepts up to 5 MB (Netlify allows 6 MB). Lower `MAX_BYTES` to 4 MB or upload straight to Supabase with a signed URL |
| `included_files` (netlify.toml) | | Vercel equivalent: `functions["api/index.mjs"].includeFiles`, plus *Include files outside the Root Directory* ON. Verify the preview renders on a preview deploy |
| Scheduled functions | ✓ none needed | **Scheduled publishing was removed** (user decision, 2026-11-04): no 5-minute job. `daily-rebuild` (Netlify only) is not needed either, since the website build hook is no longer used. No Vercel Cron Jobs required |
| Netlify *Visitor access* | | Vercel *Deployment Protection*: protect Preview only. Production must stay public (`/api/public/content` is read by the website build and by GHL pages) |
| Node version | | `engines: ">=20"` is open-ended; pin `22.x` in Project Settings or `package.json` |
| Root `.vercelignore` | ✓ fixed on this branch | **Confirmed: Vercel applies the repo-root `.vercelignore` to the CMS project too** (first build failed: `Cannot find module /vercel/path0/cms/scripts/build-static.mjs`). This branch allowlists `cms/package.json`, `vercel.json`, `api/`, `server/`, `scripts/`, `public/`, `fixtures/`. `main`'s CDN-only `.vercelignore` needs the same lines (plus `!/tools` and `!/data` without `/data/migration`) before the CMS can deploy from `main` |

Not used, nothing to replace: Netlify Forms, Identity, Blobs, Edge Functions, Image CDN, split testing.
The root `_redirects` belongs to the website, not the CMS.

## 3. Environment variables for the Vercel CMS project

Values come from `cms/env.local.copy` (git-ignored) once it has been pulled from Netlify. Mark every
secret as **Sensitive** in Vercel. None of these may use a `NEXT_PUBLIC_` prefix or reach the browser.

| Variable | Prod | Preview | Secret | Notes |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | ✓ | ✓ | | Preview should point at a separate Supabase project (README §5.4) |
| `SUPABASE_SECRET_KEY` | ✓ | ✓ | ✓ | `sb_secret_…`; drop legacy `SUPABASE_SERVICE_ROLE_KEY` if present |
| `CMS_STORE` | opt. | opt. | | Hosted default is `supabase` |
| `GOOGLE_OAUTH_CLIENT_ID` | ✓ | ✓ | | |
| `GOOGLE_OAUTH_CLIENT_SECRET` | ✓ | ✓ | ✓ | |
| `CMS_BASE_URL` | ✓ | ✓ | | **Different per environment**: the CMS's own address (OAuth redirect + CSRF origin) |
| `CMS_SESSION_SECRET` | ✓ | ✓ | ✓ | ≥ 32 chars; a new value signs everyone out (use a different one for Preview) |
| `CMS_SUPER_ADMINS` | ✓ | ✓ | | |
| `CMS_ALLOWED_EMAIL_DOMAINS` | opt. | opt. | | |
| `CMS_SESSION_HOURS` | opt. | opt. | | |
| `PUBLIC_SITE_URL` | ✓ | ✓ | | |
| `PUBLIC_SITE_DEPLOY_HOOK_URL` | opt. | – | ✓ | Not needed any more: `main` on Vercel is only the asset CDN and the GHL pages load content live (`poc/ghl-cms-pages`, `poc/ghl-resources-cms`). Unset = publishing skips the rebuild. The daily-rebuild cron is then unnecessary too |
| `CMS_PREVIEW_TOKEN` | opt. | opt. | ✓ | ≥ 32 chars |
| `CMS_IFRAME_HOSTS` | opt. | opt. | | |
| `CMS_DEV_LOGIN` | ✗ | ✗ | | Refused on hosted deployments; do not copy |

Do **not** copy obsolete variables if Netlify still has them (README §6): `FORMS_ALLOWED_ORIGINS`,
`FORMS_RATE_LIMIT`, `NETLIFY_FORMS_WEBHOOK_SECRET`, `GOOGLE_SHEETS_SPREADSHEET_ID`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`,
`RESEND_API_KEY`, `FORMS_EMAIL_FROM`, `FORMS_NOTIFY_TO*`, `FORMS_SHEETS_MIRROR`, `FORMS_SHEETS_TAB`.
Vercel's own `VERCEL*` variables are set automatically.

## 4. Vercel project settings

* Import the GitHub repo `gabewebd/faithworks` (same repo); **Root Directory `cms`**; Framework Preset *Other*;
  Install Command empty; Build/Output from `cms/vercel.json`; *Include files outside the Root Directory* ON.
* Node.js 22.x. Function region next to the Supabase project's region.
* Production Branch: choose deliberately (pushes to it deploy the Vercel CMS). Until cutover the Vercel
  production URL is only a parallel copy.
* Deployment Protection: Standard (Preview protected, Production public).
* Owner: ideally a Vercel team owned by Faith Works (the Netlify CMS currently sits in a team named
  "dgs", not in the developer's personal account).

## 5. Callback URLs, origins, consumers of the CMS address

* Google Cloud → OAuth client → *Authorized redirect URIs*: add
  `https://<new-cms-host>/api/auth/google/callback` (and one for a **fixed** preview alias, because
  random preview URLs cannot be registered). Keep the Netlify URI until Netlify is retired.
* The CSRF check accepts only `CMS_BASE_URL` / the request origin, so `CMS_BASE_URL` must match the
  address staff use.
* Supabase: no auth redirect URLs or CORS allowlist involved (server-to-server with the secret key).
* Places that point at `https://faithworks-cms.netlify.app` today and must change at cutover:
  1. Website Vercel project env `CMS_CONTENT_URL`.
  2. **GHL pages**: `data-cms-url` in the pasted Resources embed and the four `fw-live.js` pages
     (needs a GHL edit; outside this preparation).
  3. Local `cms/.env` `CMS_CONTENT_URL` (POC builds), and the docs (`README.md` §5.5).
  4. Staff bookmarks.
* Recommendation: give the CMS a stable custom domain (e.g. `cms.faithph.ai`, CNAME to Vercel) so the
  next host change never touches GHL again.

## 6. Domain and DNS (later, needs approval)

* The CMS has no custom domain today. Adding `cms.faithph.ai` = one CNAME record at the faithph.ai DNS
  provider (where GHL's records live) pointing at Vercel, then verification in Vercel. No change to the
  apex or to GHL's records.

## 7. Limits and cost

* **Hobby is for non-commercial use only**; a business CMS belongs on **Pro** (per-member monthly fee,
  usage included, then metered). (Scheduled publishing was removed, so no cron job needs Pro.)
* Function request and response bodies: 4.5 MB (affects image upload; `/api/backup` grows with
  `cms_history`, so watch its size).
* Expected usage is tiny (a handful of editors, one public JSON read per website build and per GHL page
  view). GHL page views calling `/api/public/content` are the main volume:
  check the Netlify usage page for current request counts before choosing a plan.

## 8. Ordered plan

1. **Unblock env access**: get access to the Netlify team that owns `faithworks-cms`, then pull the
   variables into `cms/env.local.copy` (all contexts). ← blocked, see report.
2. Approve the plan tier, the Vercel owner/team and whether Preview gets its own Supabase project.
3. Code adaptations on this branch, tests green, no behaviour change on Netlify:
   a. ~~cron routes~~ not needed: scheduled publishing removed;
   b. upload limit ≤ 4 MB (or signed direct upload);
   c. `includeFiles` for the preview renderer; Node 22 pin; `cms/.vercelignore`;
   d. confirm the rewrite keeps the request path.
4. Create the Vercel project (no domain), set env vars, Preview first: `/api/health` reports
   `configured: true`, sign-in, edit a draft, upload an image, page preview, `/api/public/content`.
5. Production deploy on the `*.vercel.app` URL in parallel; compare `/api/public/content` from both
   hosts (same JSON). Netlify stays primary.
6. Cutover window: website `CMS_CONTENT_URL` → new URL;
   redeploy website; GHL `data-cms-url` updated (or custom domain live).
7. Watch for 2–4 weeks with Netlify kept as rollback (switch the URLs back). Then retire Netlify
   (separate approval).
