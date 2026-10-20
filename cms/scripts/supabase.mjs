// Supabase maintenance for the CMS. Uses the same server-side credentials as the CMS
// (cms/.env or the shell environment); nothing here runs in a browser. Run the SQL migrations
// in cms/supabase/migrations first (see cms/README.md).
//
//   npm run supabase:check                       access, tables and row counts
//   npm run supabase:seed [-- --dry-run]         add missing cms/fixtures/seed.json rows (development users and logs skipped)
//   npm run supabase:import -- --from-sheets     copy the CMS tabs of the Google Sheet into Supabase (the sheet is only read)
//   npm run supabase:import -- <backup.json>     load a CMS backup (dashboard "Download backup" or `npm run backup`)
//   npm run supabase:backup                      write every table to cms/backups/<timestamp>.json
//
// Imports only ADD rows whose id is missing, keeping ids, versions, timestamps, publishing state
// and history as they are. Existing rows are never changed or deleted, so every command is safe
// to rerun. Add --dry-run to an import to list what would be added without writing.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.mjs";
import { loadConfig, supabaseKeyKind } from "../server/config.mjs";
import { createSupabaseStore, SUPABASE_TABS } from "../server/store/supabase-store.mjs";
import { createSheetsApi } from "../server/store/sheets-api.mjs";
import { decodeRow as decodeSheetRow } from "../server/store/codec.mjs";
import { ALL_TABS, CONTENT_COLLECTIONS } from "../shared/schema.mjs";

const CMS = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(CMS, ".env"));
const args = process.argv.slice(2);
const cmd = args[0];
const dryRun = args.includes("--dry-run");
const fromSheets = args.includes("--from-sheets");
const file = args.slice(1).find((a) => !a.startsWith("--"));

const cfg = loadConfig({ ...process.env, CMS_STORE: "supabase" });
const dbProblems = cfg.errors.filter((e) => /SUPABASE/.test(e));
if (dbProblems.length) { console.error("Cannot reach Supabase:\n  - " + dbProblems.join("\n  - ")); process.exit(1); }
const store = createSupabaseStore({ url: cfg.supabaseUrl, serviceKey: cfg.supabaseServiceKey, maxAttempts: 6, baseDelayMs: 1000 });
// Referenced rows first, logs last.
const ORDER = ["users", "tags", ...CONTENT_COLLECTIONS, "settings", "published", "history", "audit_log"];

async function check() {
  const data = await store.listMany(SUPABASE_TABS);
  console.log(`Supabase: ${cfg.supabaseUrl}`);
  console.log(`  key: ${cfg.supabaseKeyVar} (${supabaseKeyKind(cfg.supabaseServiceKey)})`);
  if (cfg.supabaseKeyVar === "SUPABASE_SERVICE_ROLE_KEY") console.warn("  NOTE: SUPABASE_SERVICE_ROLE_KEY is the legacy name. Set SUPABASE_SECRET_KEY (sb_secret_…) instead.");
  for (const tab of SUPABASE_TABS) console.log(`  cms_${tab}: ${data[tab].length} row(s)`);
  if (!data.settings.length) console.warn("  WARNING: no Site settings row. Run `npm run supabase:seed` or import the content.");
  console.log("Access and tables OK.");
}

// The CMS tabs of the spreadsheet, read only. Columns are matched by header name; a column the
// sheet does not have yet (a newer field) is simply empty, so an outdated sheet still imports.
async function readSheets() {
  const sc = loadConfig({ ...process.env, CMS_STORE: "sheets" });
  const problems = sc.errors.filter((e) => /GOOGLE_SHEETS|service-account|GOOGLE_SERVICE/.test(e));
  if (problems.length) throw new Error("Cannot read Google Sheets:\n  - " + problems.join("\n  - "));
  const api = createSheetsApi({ spreadsheetId: sc.spreadsheetId, clientEmail: sc.clientEmail, privateKey: sc.privateKey, maxAttempts: 6, baseDelayMs: 2000 });
  const values = await api.batchGet(ALL_TABS.map((t) => api.sheetRange(t)));
  return Object.fromEntries(ALL_TABS.map((tab, i) => {
    const [header = [], ...rows] = values[i];
    const h = header.map((x) => String(x).trim());
    return [tab, rows.filter((r) => (r || []).some((c) => String(c ?? "").trim())).map((r) => decodeSheetRow(tab, h, r)).filter((r) => r.id)];
  }));
}

async function importTabs(source, { skipTabs = [] } = {}) {
  const tabs = ORDER.filter((t) => !skipTabs.includes(t) && (source[t] || []).length);
  for (const tab of tabs) {
    const ids = source[tab].map((r) => r.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) throw new Error(`The source has more than one “${tab}” row for id ${[...new Set(dup)].join(", ")}. Fix the source first.`);
  }
  for (const tab of tabs) {
    const r = await store.importMissing(tab, source[tab], { dryRun });
    console.log(`  cms_${tab}: ${r.present.length} already present${r.edited.length ? ` (${r.edited.length} differ from the source, kept as they are: ${r.edited.join(", ")})` : ""}, ${r.added.length} ${dryRun ? "missing" : "added"}${r.added.length && r.added.length <= 12 ? `: ${r.added.join(", ")}` : ""}`);
  }
  if (dryRun) return;
  // Verify: every source row is in Supabase, and the rows just added match the source.
  const after = await store.listMany(tabs);
  const problems = [];
  for (const tab of tabs) {
    const got = new Map(after[tab].map((r) => [r.id, r]));
    for (const r of source[tab]) {
      if (!got.has(r.id)) problems.push(`${tab}/${r.id} is missing`);
    }
  }
  if (problems.length) throw new Error(`Supabase did not confirm every row:\n  - ${problems.slice(0, 20).join("\n  - ")}\nRerun the import; it only adds what is missing.`);
  console.log("Verified: every source row is in Supabase.");
}

function readBackup(path) {
  if (!path || !existsSync(path)) throw new Error("Usage: npm run supabase:import -- <backup.json>   (or -- --from-sheets)");
  const b = JSON.parse(readFileSync(path, "utf8"));
  if (b.format === "faithworks-cms-backup") return b.tabs;
  if (b.settings && b.programs) return b; // a fixture file (cms/fixtures/seed.json format)
  throw new Error("Not a Faith Works CMS backup or fixture file.");
}

async function backup() {
  const data = await store.listMany(SUPABASE_TABS);
  const dir = join(CMS, "backups");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `faithworks-cms-supabase-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(out, JSON.stringify({ format: "faithworks-cms-backup", version: 1, exported_at: new Date().toISOString(), store: "supabase", tabs: data }, null, 2));
  console.log(`Backup written: ${out}\nIt contains every record, including internal fields. Store it privately (it is git-ignored).`);
}

try {
  if (cmd === "check") await check();
  else if (cmd === "seed") {
    console.log(`${dryRun ? "Dry run (nothing is written): comparing with" : "Seeding from"} cms/fixtures/seed.json (development users and logs are skipped)…`);
    await importTabs(readBackup(join(CMS, "fixtures", "seed.json")), { skipTabs: ["users", "audit_log", "history"] });
  } else if (cmd === "import") {
    const source = fromSheets ? await readSheets() : readBackup(file);
    console.log(`${dryRun ? "Dry run (nothing is written): comparing with" : "Importing from"} ${fromSheets ? "the Google Sheet (read only)" : file}…`);
    await importTabs(source);
  } else if (cmd === "backup") await backup();
  else {
    console.log("Commands: check | seed | import (--from-sheets | <file>) [--dry-run] | backup");
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(`Failed: ${e.message}`);
  process.exit(1);
}
