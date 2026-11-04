# Newsletter generator → GoHighLevel RSS

The CMS writes the newsletter and publishes it as an RSS feed. **GoHighLevel does everything else**:
contacts, tags and audience, the email template, scheduling, sending and unsubscribes. The CMS never
sends email and stores no contact or campaign data.

## How it works

1. **CMS → Newsletter**: choose published resources (drafts and private fields are never listed).
2. **Generate newsletter**: one Claude call writes the subject, preview text, introduction, a summary
   per resource, a button label and a closing. Picking the same selection again reuses the open draft
   (no second AI call). Copy can be edited before approval (no AI call).
3. **Approve** → the issue becomes the feed at `https://<cms-host>/rss.xml` (replacing the previous one).
   **Reject** → discarded; the feed is unchanged. Only one draft is open at a time.
4. GHL's RSS Schedule campaign reads the feed and sends the email to your tagged audience.

Scheduled drafts: Vercel Cron calls `/api/cron/newsletter` daily (`vercel.json`). It makes a **draft only**
when no draft is waiting, the last issue is at least `NEWSLETTER_INTERVAL_DAYS` (default 3) old, and
there are published resources that were not in an approved issue yet (up to 5, newest first). Nothing
reaches the feed until someone approves it. Daily cron is allowed on Vercel Hobby and Pro.

Data: one table, `cms_newsletters` (`supabase/migrations/20261105000000_newsletters.sql`, **apply it in
Supabase before deploying**). It is not part of `/api/backup` or `npm run supabase:*` yet.

## Environment variables (Vercel CMS project; names only)

| Variable | Needed | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Secret. Server only. |
| `ANTHROPIC_MODEL` | no | Default `claude-opus-5-5`. |
| `NEWSLETTER_RESOURCE_URL` | recommended | Public article link, `{slug}` replaced. Default `PUBLIC_SITE_URL/resources?{slug}` (the GHL Resources page form). |
| `NEWSLETTER_ASSET_ORIGIN` | yes for images | Origin for site-relative covers (`/assets/...`): the website asset CDN. Without it, items have no image. |
| `NEWSLETTER_FEED_LINK` | no | Channel `<link>` (GHL `{{rss_feed.url}}`, use as the button link). Default `PUBLIC_SITE_URL/resources`. |
| `NEWSLETTER_INTERVAL_DAYS` | no | Default 3. |
| `CRON_SECRET` | for cron | Secret, ≥ 32 chars. Vercel sends it to the cron route automatically. |
| `GHL_NEWSLETTER_WEBHOOK_URL` | no | GHL Inbound Webhook trigger URL, called on Approve (see below). Secret-ish. |
| `CMS_BASE_URL` | already required | Builds the absolute feed address. |

## Feed → GHL email builder mapping

From HighLevel's help articles on the email builder RSS blocks and "RSS email body showing HTML tags":

| Feed | GHL merge field | Use in the template |
| --- | --- | --- |
| `<channel><title>` | `{{rss_feed.title}}` | Heading (and subject, if GHL accepts it there — **unverified**) |
| `<channel><description>` | `{{rss_feed.description}}` | Introduction |
| `<channel><link>` | `{{rss_feed.url}}` | "See all resources" button |
| `<item><title>` / `<link>` | `{{rss_item.title}}` / `{{rss_item.url}}` | Resource heading and link |
| `<item><description>` | `{{rss_item.content}}` | Summary (plain text, no triple braces needed) |
| `<content:encoded>` | `{{rss_item.content_full}}` (presumed) | Image + summary + "Read more" as HTML (`{{{…}}}`) |
| `<enclosure>`, `<media:content>`, `<media:thumbnail>` | `{{rss_item.imageUrl}}` | Image URL — **which tag GHL reads is unverified**, so all three are present |
| `<pubDate>` | `{{rss_item.date}}` | Approval time (so GHL treats the items as new) |

Layout in GHL: RSS Header block (title + description) followed by an RSS Items block (Custom) looping
over the items. That gives **one email: introduction followed by every selected resource**.

**Not in the feed GHL can read:** preview text, button label and closing. They are shown in the CMS for
copying into the campaign's preview-text field and the template. RSS has no standard place for them.

## Still to verify in GHL (test sends to an internal address only)

1. Does the RSS Schedule subject line accept `{{rss_feed.title}}`? If not, set a fixed subject or paste the
   generated one each time.
2. Which element feeds `{{rss_item.imageUrl}}`? Check the test email; drop the unused tags afterwards.
3. How GHL decides an item is "new" (guid vs pubDate) and whether it sends when the feed changes but the
   schedule interval has not passed. Each approved issue has new guids (`<issue id>:<resource id>`) and a new
   pubDate, so a new issue should always count as new.
4. `.webp` covers may not show in some email clients (Outlook). Prefer PNG/JPG covers for emailed resources.

## Webhook (optional)

On Approve, if `GHL_NEWSLETTER_WEBHOOK_URL` is set, the CMS POSTs flat JSON (`subject`, `preview_text`,
`feed_url`, `item_count`, `item_1_title`, `item_1_url`, …) — GHL custom values cannot hold arrays.
A GHL Inbound Webhook trigger starts a **workflow**, which runs per contact (a contact email or phone in the
payload is typically required to create or match one) and can send one email to that contact. It does **not**
create or send a broadcast email campaign; no documented action does that. Use it only as an internal
"newsletter approved" alert (for example, an email to the admin) while the RSS Schedule campaign does the
sending.
