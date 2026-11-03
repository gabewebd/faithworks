// Runs the scheduled-publishing job once, by hand, with the same code as the Netlify Scheduled
// Function (netlify/functions/publish-scheduled.mjs). Uses cms/.env (Supabase unless CMS_STORE says
// otherwise). Useful to see what is scheduled, or to catch up if the hosted job was not running.
//
//   npm run schedule:check            list what is scheduled and what is due now (changes nothing)
//   npm run schedule:run              publish everything that is due now, then rebuild the website
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.mjs";
import { createApp } from "../server/app.mjs";
import { fmtSchedule, SCHEDULE_TZ_LABEL } from "../shared/schedule.mjs";

const CMS = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(CMS, ".env"));
process.env.CMS_STORE ||= "supabase";
const run = process.argv.includes("--run");

const { cfg, store, services } = createApp();
if (cfg.errors.length) { console.error("The CMS is not configured:\n  - " + cfg.errors.join("\n  - ")); process.exit(1); }

const rows = await store.query("resources", { eq: { status: "scheduled" }, order: "id.asc" });
console.log(`Store: ${cfg.store}. Now: ${new Date().toISOString()} (${fmtSchedule(new Date().toISOString())}, ${SCHEDULE_TZ_LABEL}).`);
console.log(rows.length ? "Scheduled resources:" : "No resources are scheduled.");
for (const r of rows.sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))) {
  console.log(`  ${r.id}  ${fmtSchedule(r.scheduled_at)} Manila  (${r.scheduled_at})  ${Date.parse(r.scheduled_at) <= Date.now() ? "DUE" : "waiting"}  ${r.title}`);
}
const result = await services.records.publishDue({ dryRun: !run });
if (!run) { console.log(`Due now: ${result.due.length}. Nothing was changed (use --run to publish what is due).`); process.exit(0); }
console.log(JSON.stringify({ published: result.published, failed: result.failed, retry: result.retry, deploy: result.deploy }, null, 2));
