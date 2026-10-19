// Idempotent seeding of Google Sheets from a fixture. Rows are matched by their stable `id`:
// a seed row already in the sheet is left exactly as it is (also when it has been edited in the
// CMS since), and only missing rows are appended, in ONE request per tab. After a failed append
// the tab is re-read before trying again, so a retry can never add a row twice. Safe to rerun
// after a partial failure. Never clears, rewrites or deletes existing rows.
import { ALL_TABS } from "../shared/schema.mjs";
import { checkHeader, decodeRow, encodeRow } from "../server/store/codec.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const transient = (e) => e?.status === 429 || e?.status === 503;

export async function seedSheets(api, source, { skipTabs = [], dryRun = false, attempts = 5, waitMs = 15_000, sleep = wait, log = console } = {}) {
  const tabs = ALL_TABS.filter((t) => !skipTabs.includes(t) && (source[t] || []).length);

  async function plan(list) {
    const values = await api.batchGet(list.map((t) => api.sheetRange(t)));
    return Object.fromEntries(list.map((tab, i) => {
      const header = (values[i][0] || []).map((h) => String(h).trim());
      checkHeader(tab, header);
      const found = new Map(); // id -> rows with that id
      for (const raw of values[i].slice(1)) {
        const rec = decodeRow(tab, header, raw || []);
        if (rec.id) found.set(rec.id, [...(found.get(rec.id) || []), rec]);
      }
      const seed = source[tab];
      const dup = seed.filter((r) => (found.get(r.id) || []).length > 1).map((r) => r.id);
      if (dup.length) throw new Error(`“${tab}” has more than one row for id ${dup.join(", ")}. Delete the extra row(s) by hand, then rerun.`);
      return [tab, {
        header,
        present: seed.filter((r) => found.has(r.id)),
        edited: seed.filter((r) => found.has(r.id) && found.get(r.id)[0].write_id !== r.write_id),
        missing: seed.filter((r) => !found.has(r.id)),
      }];
    }));
  }

  const state = await plan(tabs);
  for (const tab of tabs) {
    const { present, missing, edited } = state[tab];
    log.log(`  ${tab}: ${present.length} already present${edited.length ? ` (${edited.length} edited since, kept)` : ""}, ${missing.length} missing${missing.length ? `: ${missing.map((r) => r.id).join(", ")}` : ""}`);
  }
  if (dryRun) return state;

  for (const tab of tabs) {
    for (let attempt = 1; state[tab].missing.length; attempt++) {
      const { header, missing } = state[tab];
      try {
        await api.append(api.sheetRange(tab, "A1"), missing.map((r) => encodeRow(tab, header, r)));
        log.log(`  ${tab}: added ${missing.length} row(s)`);
        break;
      } catch (e) {
        if (!transient(e) || attempt >= attempts) throw e;
        const ms = waitMs * 2 ** (attempt - 1);
        log.log(`  ${tab}: ${e.message} Waiting ${Math.round(ms / 1000)}s, then checking what arrived…`);
        await sleep(ms);
        Object.assign(state, await plan([tab])); // the append may have landed (e.g. a timeout)
      }
    }
  }

  const after = await plan(tabs); // throws if anything was duplicated
  const left = tabs.filter((t) => after[t].missing.length);
  if (left.length) throw new Error(`Google Sheets did not confirm every row (still missing in: ${left.join(", ")}). Rerun the seed; it only adds what is missing.`);
  return after;
}
