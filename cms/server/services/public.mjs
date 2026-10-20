// Public content for the website build, and the website rebuild trigger.
//
// /api/public/content returns ONLY live content (the `published` tab), without hidden events and
// testimonials: never drafts, internal fields or editors' emails (see shared/public.mjs). It is cached in memory
// for CACHE_MS; if the database is unavailable the last good snapshot is served (marked
// stale) rather than an error. The CDN does not cache it (see app.mjs).
// The public website itself is static: it only calls this endpoint while being built.
import { buildSnapshot } from "../../shared/public.mjs";
import { HttpError } from "../http.mjs";

// Short, because each server instance has its own copy and only the instance that handled a
// publish clears it: the website build that the publish starts must not read an older copy.
const CACHE_MS = 10_000;

export function createPublic({ store, cfg, log = console, fetchImpl = globalThis.fetch }) {
  let cached = null; // { at, snap }

  async function published() {
    if (cached && Date.now() - cached.at < CACHE_MS) return { snap: cached.snap, stale: false };
    try {
      const t = await store.listMany(["published", "tags"]);
      const snap = buildSnapshot({ published: t.published, tags: t.tags, view: "published", iframeHosts: cfg.iframeHosts });
      cached = { at: Date.now(), snap };
      return { snap, stale: false };
    } catch (e) {
      if (cached) { log.error(`Serving the cached public snapshot: ${e.message}`); return { snap: cached.snap, stale: true }; }
      throw new HttpError(503, "Content is temporarily unavailable.", "unavailable");
    }
  }

  // Draft content for staging builds. Protected by CMS_PREVIEW_TOKEN; never cached.
  async function preview() {
    const tabs = ["programs", "events", "resources", "testimonials", "settings", "tags"];
    const t = await store.listMany(tabs);
    return buildSnapshot({ records: t, tags: t.tags, view: "preview", iframeHosts: cfg.iframeHosts });
  }

  // Ask the website host (Netlify/Vercel build hook) to rebuild. The hook URL is a secret.
  async function triggerDeploy(reason) {
    cached = null;
    if (!cfg.deployHookUrl) return { triggered: false, reason: "No website build hook is configured; the website updates on its next build." };
    try {
      const res = await fetchImpl(cfg.deployHookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trigger: "faithworks-cms", reason }), signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { triggered: true };
    } catch (e) {
      log.error(`Website rebuild trigger failed: ${e.message}`);
      return { triggered: false, error: "The website rebuild could not be started. Use “Rebuild website” on the dashboard to try again." };
    }
  }

  return { published, preview, triggerDeploy, invalidate: () => { cached = null; } };
}
