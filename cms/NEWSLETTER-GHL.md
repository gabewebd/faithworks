# Newsletter: automatic RSS feed → GoHighLevel writes, approves and sends

**Plan revised 2026-11-05.** No AI service runs in the CMS or Vercel (no Anthropic/Claude API). There is no
manual selection screen, no checkboxes and no "Send to GHL" button. The CMS publishes one automatic feed;
GHL does all copy, template, review, approval, audience, scheduling, sending and unsubscribes.

```
Supabase → eligibility filter → /rss.xml (cached) → GHL RSS email → admin review + approval in GHL
```

## 1. Feed contents (automatic)

Built on request from Supabase; no stored issues, no drafts, no approval state in the CMS.

**Resources:** every resource that is published and public. Excluded: drafts, unpublished, private/hidden,
anything not reachable on the public site.

**Events:** published events whose start time is in the future. Excluded: past, draft, unpublished, private,
cancelled. (Confirm the exact status/visibility column names in the events table before coding.)

Optional cap: newest `NEWSLETTER_MAX_RESOURCES` resources (default 10) and all upcoming events up to
`NEWSLETTER_MAX_EVENTS` (default 10), so the feed stays a sensible email length.

Only public fields leave the CMS. No editor/author ids, notes, internal flags, contact or registration data.
All links and images are absolute: article links from `NEWSLETTER_RESOURCE_URL`
(default `PUBLIC_SITE_URL/resources?{slug}`), site-relative images prefixed with `NEWSLETTER_ASSET_ORIGIN`.
No hardcoded domains.

## 2. Item format

| RSS element | Resource | Event |
| --- | --- | --- |
| `<guid isPermaLink="false">` | `resource:<id>` (stable forever) | `event:<id>` (stable forever) |
| `<title>` | Title | Title |
| `<link>` | Public article URL | Registration URL (fallback: public event page) |
| `<description>` | Summary (plain text) | "Sat 14 Dec, 7:00 pm · Location — " + short description (plain text) |
| `<content:encoded>` | Image + summary + "Read more" (HTML) | Image + date/time + location + description + "Register" (HTML) |
| `<category>` | `Resource` + its category | `Event` |
| `<pubDate>` | Publication date | Event's publish/created date (not start date) |
| `<enclosure>` / `<media:content>` / `<media:thumbnail>` | Cover image | Event image |
| `ev:startdate`, `ev:enddate`, `ev:location` (RSS event module) | — | Machine-readable date/time and location |

Stable GUIDs mean an item is never sent twice as "new"; editing a resource does not create a duplicate.
Events also carry the date/location inside `<description>`, because GHL is unlikely to read the event module.

## 3. Freshness without cost

- No cron and no scheduled job. `/rss.xml` queries Supabase only when requested.
- Response sent with `Cache-Control: public, s-maxage=900, stale-while-revalidate=3600`: Vercel's CDN serves
  repeats for 15 min; at most a few DB queries per hour however often GHL polls.
- Optional later: purge/revalidate the cached feed when a resource or event is saved in the CMS. Not needed
  for v1 — a 15-minute delay is fine for a newsletter.
- Two small indexed queries (published + public; published + start > now), selected columns only.

## 4. URL

The only existing feed address is `/rss.xml` on the CMS host (branch only, never deployed). Keep it.
The server routes `/rss.xml` itself (Next rewrites keep the original path).

## 5. GHL: verify before implementation (internal test address only)

Nothing below is assumed. Each check gets a recorded result in this file before code starts.
From HighLevel help articles: the email builder has an **RSS Header** block and an **RSS Items** block that
loops items with merge fields `{{rss_item.title}}`, `{{rss_item.url}}`, `{{rss_item.content}}`,
`{{rss_item.imageUrl}}`, `{{rss_item.date}}`; campaigns can use an **RSS Schedule** that sends when new items appear.

1. **Feed accepted** — paste `/rss.xml` (preview URL) into the RSS block; does it load? Any size/item limits?
2. **Fields read** — which of guid, category, content:encoded, enclosure/media tags, pubDate actually show up?
3. **Mixed sections** — can one RSS Items block be filtered by `<category>`, or can a single email hold two RSS
   blocks pointing at different feeds? This decides whether "Latest Resources" and "Upcoming Events" can be
   separate sections.
4. **New-item logic** — does the RSS Schedule use guid or pubDate? Does it send only new items or the whole feed?
   (Events published long ago but still upcoming may be treated as old.)
5. **Approval** — can an RSS Schedule campaign be held for review instead of auto-sending?
6. **AI copy** — is Content AI (or a workflow AI action) available on this account, and can it write the subject,
   preview and intro for an RSS campaign, or only inside the editor by hand?

## 6. Recommended setup by result

- **Best case (check 3 passes):** one email, RSS Header + "Latest Resources" RSS block (category `Resource`) +
  "Upcoming Events" RSS block (category `Event`, or a second feed).
  If GHL needs separate feeds, add `/rss/resources.xml` and `/rss/events.xml` alongside `/rss.xml` (same code,
  filtered) — cheap to add.
- **Simplest fallback (no filtering, one block):** one mixed RSS Items loop. Order events first, then resources;
  every item's text starts with its type ("Event · Sat 14 Dec …" / "Resource · Guide"), so the single list still
  reads clearly.
- **If the RSS Schedule can't be held for approval or always sends the full feed:** don't use RSS Schedule. The
  admin makes a normal campaign from the newsletter template each issue; the RSS blocks pull the current feed;
  the admin writes/refines copy with Content AI in the editor, reviews, then schedules. This is the most
  likely-to-work path and needs nothing extra from the CMS.

## 7. Code changes on `feature/nextjs-newsletter` (after the checks; none made yet)

Remove: `@anthropic-ai/sdk`, generation module/prompts, Newsletter selection/generate/approve UI and endpoints,
`/api/cron/newsletter` + `vercel.json` cron, `cms_newsletters` table and migration `20261105000000`, optional webhook.
Env vars dropped: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `NEWSLETTER_INTERVAL_DAYS`, `GHL_NEWSLETTER_WEBHOOK_URL`,
`CRON_SECRET` (if unused elsewhere).

Change: `/rss.xml` builds from live Supabase data per sections 1–3, with tests for eligibility (drafts, private,
past events excluded), absolute URLs, stable GUIDs and categories.

Keep: Next.js wrap, existing routes, auth, dashboard design.

Env vars (Vercel CMS project, names only, all optional except the asset origin for images):
`NEWSLETTER_ASSET_ORIGIN` (needed for site-relative images), `NEWSLETTER_RESOURCE_URL` (default
`PUBLIC_SITE_URL/resources?{slug}`), `NEWSLETTER_EVENT_PAGE_URL` (default `PUBLIC_SITE_URL/events/{slug}/`),
`NEWSLETTER_EVENTS_URL` (link for events with no registration or page; default `PUBLIC_SITE_URL/workshops`),
`NEWSLETTER_FEED_LINK`, `NEWSLETTER_FEED_TITLE`, `NEWSLETTER_MAX_RESOURCES`, `NEWSLETTER_MAX_EVENTS` (default 10 each),
plus existing `PUBLIC_SITE_URL`, `CMS_BASE_URL`.

**Status (2026-11-05):** test feed implemented in `server/services/feed.mjs` (tests: `test/feed.test.mjs`); the AI
generator, selection UI, cron and table were removed. GHL checks in section 5 still to run against the preview.

## Known risks

- `.webp` covers may not render in Outlook; prefer PNG/JPG for emailed items.
- GHL may ignore the event module, categories or `content:encoded`; the plain-text description carries the
  essentials so items still make sense.
