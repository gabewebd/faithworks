// Netlify Scheduled Function: rebuilds the public website once a day, just after midnight in
// Manila (16:05 UTC). The website decides upcoming vs past events while it is built, so without
// this a finished event would stay under "Upcoming" until the next publish. It calls the same
// secret build hook as publishing (PUBLIC_SITE_DEPLOY_HOOK_URL) and does nothing without it.
// Netlify runs scheduled functions on published production deploys only.
import { createApp } from "../../server/app.mjs";

process.env.NETLIFY ||= "true"; // see api.mjs

export default async () => {
  const { cfg, services } = createApp();
  if (cfg.errors.length) {
    console.error(`Daily website rebuild skipped: the CMS is not configured (${cfg.errors.length} problem(s), see /api/health).`);
    return new Response(null, { status: 503 });
  }
  const result = await services.pub.triggerDeploy("daily rebuild (event dates)");
  console.log(result.triggered ? "Daily website rebuild started." : `Daily website rebuild not started: ${result.error || result.reason}`);
  return new Response(null, { status: result.triggered ? 202 : 200 });
};

export const config = { schedule: "5 16 * * *" };
