// Newsletter generator: picks published resources, asks Claude for the email copy, keeps ONE
// table of issues (cms_newsletters) and serves the latest APPROVED issue as an RSS 2.0 feed
// for GoHighLevel's "RSS Schedule" email campaigns. GHL sends the email; the CMS never does.
//
// Issue lifecycle: draft -> approved | rejected. Generating a new draft rejects any older open
// draft ("superseded"), so there is only ever one issue waiting for review. Approving an issue
// replaces the previous approved one in the feed. Only approved issues reach the public feed.
//
// GHL email builder fields this feed is shaped for (help.gohighlevel.com, "RSS blocks"):
//   RSS Header: {{rss_feed.title}} <- <channel><title> (subject line)
//               {{rss_feed.description}} <- <channel><description> (introduction)
//               {{rss_feed.url}} <- <channel><link> (call to action link)
//   RSS Items:  {{rss_item.title}}, {{rss_item.url}} <- <link>, {{rss_item.date}} <- <pubDate>,
//               {{rss_item.content}} <- <description>, {{rss_item.imageUrl}} (image; which tag GHL
//               reads is not documented, so the image is in <enclosure>, <media:content>,
//               <media:thumbnail> and as an <img> in <content:encoded>).
import { createHash } from "node:crypto";
import { HttpError, randomId } from "../http.mjs";

export const NEWSLETTER_TAB = "newsletters";
export const MAX_ITEMS = 8;
const DAY = 86_400_000;

const clean = (s, max) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const cdata = (s) => `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
const rfc822 = (iso) => new Date(iso || Date.now()).toUTCString();

// Newsletter settings from the environment. Domains are never hardcoded.
export function newsletterConfig(env = process.env, cfg = {}) {
  const site = (cfg.publicSiteUrl || "").replace(/\/$/, "");
  return {
    apiKey: env.ANTHROPIC_API_KEY || "",
    model: env.ANTHROPIC_MODEL || "claude-opus-5-5",
    // Where a resource is read by the public, {slug} is replaced. GHL serves articles as /resources?<slug>.
    resourceUrl: env.NEWSLETTER_RESOURCE_URL || (site ? `${site}/resources?{slug}` : ""),
    // Origin for site-relative cover images (/assets/...): the website asset CDN.
    assetOrigin: (env.NEWSLETTER_ASSET_ORIGIN || "").replace(/\/$/, ""),
    // The feed's <link> (GHL {{rss_feed.url}}), used as the "see all resources" call to action.
    feedLink: env.NEWSLETTER_FEED_LINK || (site ? `${site}/resources` : ""),
    feedSelf: (cfg.baseUrl || "").replace(/\/$/, "") + "/rss.xml",
    cronSecret: env.CRON_SECRET || "",
    intervalDays: Math.max(1, Number(env.NEWSLETTER_INTERVAL_DAYS) || 3),
    webhookUrl: env.GHL_NEWSLETTER_WEBHOOK_URL || "",
  };
}

export function createNewsletter({ store, pub, nl, log, generateCopy = defaultGenerator(nl), fetchImpl = globalThis.fetch }) {
  const editorOnly = (user) => { if (!user) throw new HttpError(401, "Please sign in again.", "unauthorized"); };
  const abs = (u) => (!u ? "" : /^https?:\/\//i.test(u) ? u : nl.assetOrigin && u.startsWith("/") ? nl.assetOrigin + u : "");

  async function issues() {
    try { return await store.query(NEWSLETTER_TAB, { order: "created_at.desc", limit: 50 }); }
    catch (e) {
      if (/cms_newsletters|unknown|does not exist|PGRST205|404/i.test(`${e.message} ${e.code}`)) throw new HttpError(503, "The newsletter table is missing. Apply supabase/migrations/20261105000000_newsletters.sql in Supabase first.", "newsletter_table_missing");
      throw e;
    }
  }
  const usedIds = (rows) => new Set(rows.filter((r) => r.status === "approved").flatMap((r) => (r.data?.items || []).map((i) => i.resource_id)));

  // Published resources only (the same public snapshot the website reads: drafts and private fields never appear).
  async function published() {
    const { snap } = await pub.published();
    return (snap.resources || []).map((r) => ({
      id: r.id, slug: r.slug, title: r.title, summary: r.summary || r.meta_description || "", type: r.resource_type || "", category: r.category || "",
      published_at: r.published_at || r.publish_date || "", image: abs(r.social_image_url || r.cover_image_url), image_alt: r.cover_image_alt || "",
      url: nl.resourceUrl ? nl.resourceUrl.replace("{slug}", encodeURIComponent(r.slug)) : "", text: clean(r.body_html, 2500),
    })).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  }

  async function overview() {
    const [rows, list] = await Promise.all([issues(), published()]);
    const used = usedIds(rows);
    return {
      configured: { ai: !!nl.apiKey, resourceUrl: !!nl.resourceUrl, assetOrigin: !!nl.assetOrigin, webhook: !!nl.webhookUrl, cron: !!nl.cronSecret },
      feed_url: nl.feedSelf, model: nl.model, interval_days: nl.intervalDays,
      resources: list.map(({ text, ...r }) => ({ ...r, already_sent: used.has(r.id) })),
      draft: rows.find((r) => r.status === "draft") || null,
      approved: rows.find((r) => r.status === "approved") || null,
      recent: rows.slice(0, 10).map((r) => ({ id: r.id, status: r.status, subject: r.data?.subject || "", created_at: r.created_at, created_by: r.created_by, approved_at: r.data?.approved_at || "" })),
    };
  }

  async function generate(user, { resourceIds } = {}, { source = "manual", requestId } = {}) {
    editorOnly(user);
    if (!nl.apiKey) throw new HttpError(503, "ANTHROPIC_API_KEY is not set, so newsletter copy cannot be generated.", "ai_not_configured");
    if (!nl.resourceUrl) throw new HttpError(503, "NEWSLETTER_RESOURCE_URL (or PUBLIC_SITE_URL) is not set, so resource links cannot be built.", "newsletter_not_configured");
    const ids = [...new Set((Array.isArray(resourceIds) ? resourceIds : []).map(String))];
    if (!ids.length) throw new HttpError(422, "Choose at least one resource.", "invalid");
    if (ids.length > MAX_ITEMS) throw new HttpError(422, `Choose at most ${MAX_ITEMS} resources.`, "invalid");
    const list = await published();
    const picked = ids.map((id) => list.find((r) => r.id === id));
    if (picked.some((r) => !r)) throw new HttpError(422, "Only published resources can go in a newsletter. Reload and choose again.", "invalid");

    // Same selection as the open draft: no second AI call.
    const rows = await issues();
    const open = rows.find((r) => r.status === "draft");
    const key = createHash("sha256").update(ids.slice().sort().join(",")).digest("hex").slice(0, 16);
    if (open && open.data?.selection_key === key) return { issue: open, reused: true };

    const copy = await generateCopy(picked);
    const items = picked.map((r) => ({
      resource_id: r.id, slug: r.slug, title: r.title, url: r.url, image: r.image, image_alt: r.image_alt, published_at: r.published_at,
      summary: clean(copy.items.find((x) => x.id === r.id)?.summary || r.summary, 400),
    }));
    const stamp = new Date().toISOString();
    const issue = {
      id: randomId("nl", 8), status: "draft", version: 1, write_id: randomId("w", 6), created_at: stamp, created_by: user.email, updated_at: stamp, updated_by: user.email,
      data: {
        source, model: nl.model, selection_key: key,
        subject: clean(copy.subject, 120), preview_text: clean(copy.preview_text, 160), intro: clean(copy.intro, 900),
        cta_label: clean(copy.cta_label, 40), closing: clean(copy.closing, 400), items,
      },
    };
    if (open) await close(open, "rejected", user, { reason: "superseded" });
    await store.insert(NEWSLETTER_TAB, issue);
    await log.log(user, "newsletter_generate", NEWSLETTER_TAB, issue.id, 1, `${items.length} resources (${source})`, requestId);
    return { issue };
  }

  async function close(issue, status, user, extra = {}) {
    const stamp = new Date().toISOString();
    return store.update(NEWSLETTER_TAB, issue.id, {
      ...issue, status, version: Number(issue.version) + 1, write_id: randomId("w", 6), updated_at: stamp, updated_by: user.email,
      data: { ...issue.data, ...(status === "approved" ? { approved_at: stamp, approved_by: user.email } : { rejected_at: stamp, rejected_by: user.email }), ...extra },
    }, { expectWriteId: issue.write_id });
  }
  async function load(id, version) {
    const issue = await store.get(NEWSLETTER_TAB, id);
    if (!issue) throw new HttpError(404, "This newsletter no longer exists.", "not_found");
    if (version !== undefined && Number(version) !== Number(issue.version)) throw new HttpError(409, "This newsletter changed in another tab. Reload and try again.", "conflict");
    return issue;
  }

  // Small copy edits before approval (no AI call). Only text fields; links and images stay as generated.
  async function edit(user, id, { version, data = {} } = {}, { requestId } = {}) {
    editorOnly(user);
    const issue = await load(id, version);
    if (issue.status !== "draft") throw new HttpError(409, "Only a draft can be edited.", "forbidden");
    const d = { ...issue.data };
    for (const [k, max] of [["subject", 120], ["preview_text", 160], ["intro", 900], ["cta_label", 40], ["closing", 400]]) if (typeof data[k] === "string") d[k] = clean(data[k], max);
    if (Array.isArray(data.items)) d.items = d.items.map((it) => { const x = data.items.find((y) => y.resource_id === it.resource_id); return x && typeof x.summary === "string" ? { ...it, summary: clean(x.summary, 400) } : it; });
    if (!d.subject) throw new HttpError(422, "The subject line cannot be empty.", "invalid");
    const stamp = new Date().toISOString();
    const saved = await store.update(NEWSLETTER_TAB, id, { ...issue, data: d, version: Number(issue.version) + 1, write_id: randomId("w", 6), updated_at: stamp, updated_by: user.email }, { expectWriteId: issue.write_id });
    await log.log(user, "newsletter_edit", NEWSLETTER_TAB, id, saved.version, "", requestId);
    return { issue: saved };
  }

  async function approve(user, id, { version } = {}, { requestId } = {}) {
    editorOnly(user);
    const issue = await load(id, version);
    if (issue.status !== "draft") throw new HttpError(409, "Only a draft can be approved.", "forbidden");
    // Links must still point at published resources.
    const live = new Set((await published()).map((r) => r.id));
    const gone = issue.data.items.filter((i) => !live.has(i.resource_id));
    if (gone.length) throw new HttpError(422, `These resources are no longer published: ${gone.map((g) => g.title).join(", ")}. Generate a new newsletter.`, "invalid");
    const saved = await close(issue, "approved", user);
    await log.log(user, "newsletter_approve", NEWSLETTER_TAB, id, saved.version, issue.data.subject, requestId);
    const webhook = await notify(saved);
    return { issue: saved, webhook };
  }

  async function reject(user, id, { version } = {}, { requestId } = {}) {
    editorOnly(user);
    const issue = await load(id, version);
    if (issue.status !== "draft") throw new HttpError(409, "Only a draft can be rejected.", "forbidden");
    const saved = await close(issue, "rejected", user);
    await log.log(user, "newsletter_reject", NEWSLETTER_TAB, id, saved.version, "", requestId);
    return { issue: saved };
  }

  // Optional: tell a GHL Inbound Webhook workflow that a new approved feed is ready. Flat keys only
  // (GHL custom values cannot hold arrays). It never sends the email itself.
  async function notify(issue) {
    if (!nl.webhookUrl) return { sent: false, reason: "not configured" };
    const body = { event: "newsletter_approved", newsletter_id: issue.id, subject: issue.data.subject, preview_text: issue.data.preview_text, feed_url: nl.feedSelf, item_count: issue.data.items.length, approved_at: issue.data.approved_at };
    issue.data.items.forEach((it, i) => { body[`item_${i + 1}_title`] = it.title; body[`item_${i + 1}_url`] = it.url; });
    try {
      const res = await fetchImpl(nl.webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
      return { sent: res.ok, status: res.status };
    } catch (e) { return { sent: false, reason: "unreachable" }; }
  }

  // Scheduled run: make a draft (never send) when the interval has passed, nothing is waiting for
  // review and there are published resources that were not in an approved issue yet.
  async function scheduled({ now = Date.now(), requestId } = {}) {
    const rows = await issues();
    if (rows.some((r) => r.status === "draft")) return { created: false, reason: "a draft is already waiting for review" };
    const last = rows[0];
    if (last && now - Date.parse(last.created_at) < nl.intervalDays * DAY - 3_600_000) return { created: false, reason: `last newsletter is less than ${nl.intervalDays} days old` };
    const used = usedIds(rows);
    const fresh = (await published()).filter((r) => !used.has(r.id)).slice(0, 5);
    if (!fresh.length) return { created: false, reason: "no new published resources" };
    const { issue } = await generate({ email: "system:cron", role: "system" }, { resourceIds: fresh.map((r) => r.id) }, { source: "cron", requestId });
    return { created: true, id: issue.id, items: fresh.length };
  }

  async function rss() {
    let rows;
    try { rows = await store.query(NEWSLETTER_TAB, { eq: { status: "approved" }, order: "updated_at.desc", limit: 1 }); } catch { rows = []; }
    return buildRss(rows[0] || null, nl);
  }

  return { overview, generate, edit, approve, reject, scheduled, rss, published };
}

export function buildRss(issue, nl) {
  const d = issue?.data;
  const pub = rfc822(d?.approved_at || issue?.updated_at);
  const items = (d?.items || []).map((it) => {
    const img = it.image ? `<p><img src="${xml(it.image)}" alt="${xml(it.image_alt || it.title)}" width="560" style="max-width:100%;height:auto"></p>` : "";
    const type = /\.png(\?|$)/i.test(it.image) ? "image/png" : /\.webp(\?|$)/i.test(it.image) ? "image/webp" : "image/jpeg";
    return `    <item>
      <title>${xml(it.title)}</title>
      <link>${xml(it.url)}</link>
      <guid isPermaLink="false">${xml(`${issue.id}:${it.resource_id}`)}</guid>
      <pubDate>${pub}</pubDate>
      <description>${xml(it.summary)}</description>
      <content:encoded>${cdata(`${img}<p>${xml(it.summary)}</p><p><a href="${xml(it.url)}">Read more</a></p>`)}</content:encoded>${it.image ? `
      <enclosure url="${xml(it.image)}" length="0" type="${type}"/>
      <media:content url="${xml(it.image)}" medium="image"/>
      <media:thumbnail url="${xml(it.image)}"/>` : ""}
    </item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xml(d?.subject || "Faith Works newsletter")}</title>
    <link>${xml(nl.feedLink || nl.feedSelf)}</link>
    <description>${xml(d?.intro || "No newsletter has been approved yet.")}</description>
    <language>en</language>
    <lastBuildDate>${pub}</lastBuildDate>
    <atom:link href="${xml(nl.feedSelf)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

// Claude writes the copy. Structured output (JSON schema) so the reply always parses.
function defaultGenerator(nl) {
  return async function generateCopy(resources) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: nl.apiKey, timeout: 50_000, maxRetries: 1 });
    const schema = {
      type: "object", additionalProperties: false, required: ["subject", "preview_text", "intro", "cta_label", "closing", "items"],
      properties: {
        subject: { type: "string", description: "Email subject line, at most 70 characters." },
        preview_text: { type: "string", description: "Inbox preview text, 60 to 110 characters, complements the subject." },
        intro: { type: "string", description: "Two to four short sentences introducing this issue. Plain text." },
        cta_label: { type: "string", description: "Button label inviting readers to browse all resources, at most 30 characters." },
        closing: { type: "string", description: "One or two warm closing sentences. Plain text." },
        items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "summary"], properties: { id: { type: "string" }, summary: { type: "string", description: "One or two sentences (max 45 words) on what the reader will get from it. Plain text." } } } },
      },
    };
    const system = "You write the email newsletter for Faith Works, which runs practical workshops, guided programs and business support that help founders, professionals and teams turn AI learning into work they can use, without becoming tech experts. Voice: warm, clear, practical, encouraging; no hype, no jargon, no emojis, no exclamation marks in the subject. Write only from the resources given; never invent facts, dates, prices or events. Plain text only.";
    const body = resources.map((r) => ({ id: r.id, title: r.title, type: r.type, category: r.category, summary: r.summary, excerpt: r.text }));
    const res = await client.beta.messages.create({
      model: nl.model, max_tokens: 4000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system, messages: [{ role: "user", content: `Write this issue's subject, preview text, introduction, call to action label, closing and one summary per resource (use each resource's id).\n\n${JSON.stringify(body)}` }],
    });
    if (res.stop_reason === "refusal") throw new HttpError(502, "The AI declined to write this newsletter. Try a different selection.", "ai_refused");
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try { return JSON.parse(text); } catch { throw new HttpError(502, "The AI reply could not be read. Please try again.", "ai_invalid"); }
  };
}
