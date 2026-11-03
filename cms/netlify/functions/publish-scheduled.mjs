// Netlify Scheduled Function: publishes Scheduled resources whose time has come, every 5 minutes.
// Runs on Netlify's servers, so it does not depend on anyone having the CMS open. Each run reads
// only the rows with status "scheduled" (usually none), publishes the due ones through the same
// code as the Publish button (server/services/records.mjs → publishDue), and starts one website
// rebuild (PUBLIC_SITE_DEPLOY_HOOK_URL) when something went live. Times are compared as UTC
// instants; editors choose them in Manila time (shared/schedule.mjs).
// Netlify runs scheduled functions on published production deploys only. A run that is missed
// (e.g. during a deploy) is caught up by the next one: anything overdue is published then.
import { createApp } from "../../server/app.mjs";

process.env.NETLIFY ||= "true"; // see api.mjs

export default async () => {
  const { cfg, services } = createApp();
  if (cfg.errors.length) {
    console.error(`Scheduled publishing skipped: the CMS is not configured (${cfg.errors.length} problem(s), see /api/health).`);
    return new Response(null, { status: 503 });
  }
  try {
    const r = await services.records.publishDue();
    const line = (xs) => xs.map((x) => `${x.collection}/${x.id} (${x.scheduled_at}${x.reason ? `: ${x.reason}` : ""})`).join("; ");
    if (r.published.length) console.log(`Scheduled publishing: published ${line(r.published)}. Website rebuild: ${r.deploy?.triggered ? "started" : r.deploy?.error || r.deploy?.reason || "not started"}.`);
    if (r.failed.length) console.error(`Scheduled publishing: could not publish ${line(r.failed)}. They are Drafts again; see the CMS dashboard.`);
    if (r.retry.length) console.warn(`Scheduled publishing: will retry ${line(r.retry)}.`);
    if (!r.due.length) console.log(`Scheduled publishing: nothing due (${r.checked} scheduled).`);
    return new Response(null, { status: 200 });
  } catch (e) {
    console.error(`Scheduled publishing failed: ${e.message}`);
    return new Response(null, { status: 500 });
  }
};

export const config = { schedule: "*/5 * * * *" };
