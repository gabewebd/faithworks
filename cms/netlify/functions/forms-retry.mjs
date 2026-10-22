// Netlify Scheduled Function: every 10 minutes, finishes form-submission alerts and Sheets copies
// that are pending, failed (up to 6 automatic attempts) or were interrupted. Submissions are
// already stored; this only retries what happens after (server/forms/submissions.mjs).
// Netlify runs scheduled functions on published production deploys only.
import { createApp } from "../../server/app.mjs";

process.env.NETLIFY ||= "true"; // see api.mjs

export default async () => {
  const { cfg, services } = createApp();
  if (cfg.errors.length || !services.forms) {
    console.error("Form delivery retry skipped: the CMS is not configured (see /api/health).");
    return new Response(null, { status: 503 });
  }
  const r = await services.forms.processPending();
  if (r.checked) console.log(`Form delivery retry: ${r.checked} submission(s), ${r.sent} delivered, ${r.failed} failed.`);
  return new Response(null, { status: 200 });
};

export const config = { schedule: "*/10 * * * *" };
