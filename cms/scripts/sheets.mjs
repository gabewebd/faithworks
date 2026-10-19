// Google Sheets maintenance for the CMS. Uses the same server-side credentials as the CMS
// (cms/.env or the shell environment); nothing here runs in a browser.
//
//   npm run sheets:check            access, tabs and column headers; row counts
//   npm run sheets:setup            create missing tabs and header columns (never reorders or deletes)
//   npm run sheets:seed             add any missing cms/fixtures/seed.json rows (matched by id; safe to rerun)
//   npm run sheets:seed -- --dry-run  read-only: list which seed rows are present or missing
//   npm run backup                  write every tab to cms/backups/<timestamp>.json
//   npm run restore -- <file.json>  load a backup into an EMPTY spreadsheet (see README: Recovery)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.mjs";
import { loadConfig } from "../server/config.mjs";
import { createSheetsApi } from "../server/store/sheets-api.mjs";
import { createSheetsStore } from "../server/store/sheets-store.mjs";
import { seedSheets } from "./seed-sheets.mjs";
import { columnsFor, ALL_TABS, CONTENT_COLLECTIONS } from "../shared/schema.mjs";
import { columnLetter } from "../server/store/codec.mjs";

const CMS = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(CMS, ".env"));
const cfg = loadConfig({ ...process.env, CMS_STORE: "sheets" });
const [cmd, arg] = process.argv.slice(2);
const sheetProblems = cfg.errors.filter((e) => /GOOGLE_SHEETS|service-account|GOOGLE_SERVICE/.test(e));
if (sheetProblems.length) { console.error("Cannot reach Google Sheets:\n  - " + sheetProblems.join("\n  - ")); process.exit(1); }

// Longer backoff than the CMS server uses: Sheets quotas are per minute (about 60 reads and 60
// writes per user), so a script that hits one must wait tens of seconds, not milliseconds.
const api = createSheetsApi({ spreadsheetId: cfg.spreadsheetId, clientEmail: cfg.clientEmail, privateKey: cfg.privateKey, maxAttempts: 6, baseDelayMs: 2000 });
const store = createSheetsStore(api, { cacheMs: 0 });

async function sheetInfo() {
  const meta = await api.metadata();
  return { title: meta.properties?.title, sheets: new Map((meta.sheets || []).map((s) => [s.properties.title, s.properties])) };
}

async function setup() {
  const { title, sheets } = await sheetInfo();
  console.log(`Spreadsheet: ${title}`);
  const requests = [];
  for (const tab of ALL_TABS) {
    const need = columnsFor(tab).length + 10;
    const props = sheets.get(tab);
    if (!props) requests.push({ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1, columnCount: need, rowCount: 1000 } } } });
    else if ((props.gridProperties?.columnCount || 0) < need) requests.push({ appendDimension: { sheetId: props.sheetId, dimension: "COLUMNS", length: need - props.gridProperties.columnCount } });
  }
  if (requests.length) { await api.batchUpdate(requests); console.log(`Created or widened ${requests.length} tab(s).`); }
  const headers = await api.batchGet(ALL_TABS.map((tab) => api.sheetRange(tab, "1:1")));
  for (const [i, tab] of ALL_TABS.entries()) {
    const header = (headers[i][0] || []).map((h) => String(h).trim());
    const missing = columnsFor(tab).filter((c) => !header.includes(c));
    if (!missing.length) { console.log(`  ${tab}: OK (${header.length} columns)`); continue; }
    const start = header.length;
    await api.update(api.sheetRange(tab, `${columnLetter(start)}1:${columnLetter(start + missing.length - 1)}1`), [missing]);
    console.log(`  ${tab}: added ${missing.length} column(s)${start ? " at the end" : ""}`);
  }
  console.log("Done. Do not rename, reorder or sort these columns and rows by hand; see cms/README.md.");
}

async function check() {
  const { title } = await sheetInfo();
  console.log(`Spreadsheet: ${title}`);
  const data = await store.listMany(ALL_TABS);
  for (const tab of ALL_TABS) console.log(`  ${tab}: ${data[tab].length} row(s)`);
  const ids = new Set();
  for (const tab of CONTENT_COLLECTIONS) for (const r of data[tab]) { if (ids.has(r.id)) console.warn(`  WARNING duplicate id ${r.id}`); ids.add(r.id); }
  if (!data.settings.length) console.warn("  WARNING: no Site settings row. Run `npm run sheets:seed` or create them in the CMS.");
  console.log("Access and column headers OK.");
}

async function load(source, { label, skipTabs = [] }) {
  const current = await store.listMany(ALL_TABS);
  const busy = ALL_TABS.filter((t) => !skipTabs.includes(t) && current[t].length && (source[t] || []).length);
  if (busy.length) { console.error(`Refusing to ${label}: these tabs already contain data: ${busy.join(", ")}. Use an empty spreadsheet.`); process.exit(1); }
  for (const tab of ALL_TABS) {
    if (skipTabs.includes(tab)) continue;
    const rows = source[tab] || [];
    for (const r of rows) await (tab === "audit_log" || tab === "history" ? store.appendLog(tab, r) : store.insert(tab, r));
    if (rows.length) console.log(`  ${tab}: ${rows.length} row(s)`);
  }
}

async function backup() {
  const data = await store.listMany(ALL_TABS);
  const dir = join(CMS, "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `faithworks-cms-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ format: "faithworks-cms-backup", version: 1, exported_at: new Date().toISOString(), store: "sheets", tabs: data }, null, 2));
  console.log(`Backup written: ${file}\nIt contains every record, including internal fields. Store it privately (it is git-ignored).`);
}

try {
  if (cmd === "setup") await setup();
  else if (cmd === "check") await check();
  else if (cmd === "seed") {
    const dryRun = arg === "--dry-run";
    if (!dryRun) await setup();
    const seed = JSON.parse(readFileSync(join(CMS, "fixtures", "seed.json"), "utf8"));
    console.log(`${dryRun ? "Dry run (nothing is written): comparing with" : "Seeding from"} cms/fixtures/seed.json (development users and logs are skipped)…`);
    await seedSheets(api, seed, { dryRun, skipTabs: ["users", "audit_log", "history"] });
    console.log(dryRun ? "Dry run done. `npm run sheets:seed` adds only the missing rows." : "Seeded. Add real users in the CMS (Users and roles) after the first Super Admin signs in.");
  } else if (cmd === "backup") await backup();
  else if (cmd === "restore") {
    if (!arg || !existsSync(arg)) { console.error("Usage: npm run restore -- <backup.json>"); process.exit(1); }
    const b = JSON.parse(readFileSync(arg, "utf8"));
    if (b.format !== "faithworks-cms-backup") { console.error("Not a Faith Works CMS backup file."); process.exit(1); }
    await setup();
    console.log(`Restoring backup from ${b.exported_at}…`);
    await load(b.tabs, { label: "restore" });
    console.log("Restored. Point GOOGLE_SHEETS_SPREADSHEET_ID at this spreadsheet and redeploy.");
  } else {
    console.log("Commands: check | setup | seed | backup | restore <file>");
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(`Failed: ${e.message}`);
  process.exit(1);
}
