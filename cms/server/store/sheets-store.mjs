// Google Sheets content store (production).
//
// Rows are found by their immutable `id` column on every write, never by a remembered row
// number, because rows can be sorted or moved by hand. Each update rewrites one whole row
// (atomic for that row) and then reads it back to confirm the `write_id` landed: success is
// only reported after Google confirms the data. Appends are not blindly retried: after a
// failed or timed-out append the store re-reads the tab and only appends again if the row
// is really missing, so a retry cannot create duplicate records.
//
// Sheets has no transactions across tabs. Callers (services/records.mjs) order multi-step
// operations so that a partial failure never exposes unapproved content, and can be repaired.
import { checkHeader, decodeRow, encodeRow, columnLetter } from "./codec.mjs";
import { HttpError } from "../http.mjs";

export function createSheetsStore(api, { cacheMs = 4000 } = {}) {
  const cache = new Map(); // tab -> { at, table } : short-lived, for dashboard reads only
  const headers = new Map(); // tab -> { at, header } : for append-only logs

  function parse(tab, values) {
    const header = (values[0] || []).map((h) => String(h).trim());
    checkHeader(tab, header);
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const raw = values[i] || [];
      if (!raw.some((c) => String(c ?? "").trim())) continue; // blank row
      const record = decodeRow(tab, header, raw);
      if (!record.id) continue;
      rows.push({ rowNumber: i + 1, record, raw });
    }
    return { header, rows };
  }

  async function readTables(tabs, { fresh = true } = {}) {
    const out = {};
    const need = tabs.filter((t) => fresh || !(cache.has(t) && Date.now() - cache.get(t).at < cacheMs));
    if (need.length) {
      const values = await api.batchGet(need.map((t) => api.sheetRange(t)));
      need.forEach((t, i) => cache.set(t, { at: Date.now(), table: parse(t, values[i]) }));
    }
    for (const t of tabs) out[t] = cache.get(t).table;
    return out;
  }
  const invalidate = (tab) => cache.delete(tab);

  function findRow(tab, table, id) {
    const hits = table.rows.filter((r) => r.record.id === id);
    if (hits.length > 1) throw new HttpError(500, `Two rows in “${tab}” share the id ${id}. Fix the spreadsheet (keep one row) before editing this item.`, "duplicate_rows");
    return hits[0] || null;
  }

  return {
    kind: "sheets",
    async list(tab, opts) { return (await readTables([tab], opts))[tab].rows.map((r) => r.record); },
    async listMany(tabs, opts) {
      const t = await readTables(tabs, opts);
      return Object.fromEntries(tabs.map((k) => [k, t[k].rows.map((r) => r.record)]));
    },
    async get(tab, id) {
      const table = (await readTables([tab]))[tab];
      return findRow(tab, table, id)?.record || null;
    },

    async insert(tab, record) {
      const table = (await readTables([tab]))[tab];
      if (findRow(tab, table, record.id)) throw new HttpError(409, `An item with id ${record.id} already exists.`, "duplicate_id");
      const row = encodeRow(tab, table.header, record);
      invalidate(tab);
      try {
        await api.append(api.sheetRange(tab, "A1"), [row]);
      } catch (e) {
        // The append may or may not have landed (timeout, dropped connection). Check before retrying.
        const again = (await readTables([tab]))[tab];
        if (findRow(tab, again, record.id)?.record.write_id === record.write_id) return record;
        if (e.status === 400 || e.status === 413) throw e;
        await api.append(api.sheetRange(tab, "A1"), [row]);
      }
      const check = findRow(tab, (await readTables([tab]))[tab], record.id);
      if (!check || check.record.write_id !== record.write_id) throw new HttpError(503, "Google Sheets did not confirm the new row. Reload to check whether it was saved.", "unconfirmed");
      invalidate(tab);
      return check.record;
    },

    // Overwrites the record's row. `expectWriteId`, when given, must match the row's current
    // write_id (optimistic concurrency; checked on a fresh read just before writing).
    async update(tab, id, record, { expectWriteId } = {}) {
      const table = (await readTables([tab]))[tab];
      const hit = findRow(tab, table, id);
      if (!hit) throw new HttpError(404, "This item no longer exists in the spreadsheet.", "not_found");
      if (expectWriteId !== undefined && hit.record.write_id !== expectWriteId) {
        throw new HttpError(409, "Someone else saved this item a moment ago. Reload to see their changes.", "conflict", { current: hit.record });
      }
      const row = encodeRow(tab, table.header, { ...record, id }, hit.raw);
      const range = api.sheetRange(tab, `A${hit.rowNumber}:${columnLetter(table.header.length - 1)}${hit.rowNumber}`);
      invalidate(tab);
      await api.update(range, [row]);
      // One read confirms the write: our write_id is on the row, and the id appears exactly once
      // in the id column (if rows were re-sorted by hand between our read and write, the write
      // could have landed on another item's row; that item's last version is in `history`).
      const idCol = columnLetter(table.header.indexOf("id"));
      const [back = [], ids = []] = await api.batchGet([range, api.sheetRange(tab, `${idCol}:${idCol}`)]);
      const confirmed = decodeRow(tab, table.header, back[0] || []);
      if (confirmed.id !== id || confirmed.write_id !== record.write_id) {
        throw new HttpError(409, "The spreadsheet changed while saving (another save or a manual edit). Reload and check this item; its version history has the previous content.", "unconfirmed");
      }
      if (ids.filter((r) => r[0] === id).length !== 1) {
        throw new HttpError(500, `Rows in “${tab}” moved while saving, and the id ${id} now appears more than once. Do not sort the CMS tabs by hand. Restore the affected items from their version history.`, "rows_moved");
      }
      return confirmed;
    },

    // Append-only logs (audit_log, history): ids are random, so no duplicate check up front.
    // After a failure the tab is read once to see whether the row arrived before retrying.
    async appendLog(tab, record) {
      let header = headers.get(tab)?.at > Date.now() - 600_000 ? headers.get(tab).header : null;
      if (!header) {
        header = (await api.get(api.sheetRange(tab, "1:1")))[0]?.map((h) => String(h).trim()) || [];
        checkHeader(tab, header);
        headers.set(tab, { at: Date.now(), header });
      }
      const row = encodeRow(tab, header, record);
      try {
        await api.append(api.sheetRange(tab, "A1"), [row]);
      } catch (e) {
        const table = (await readTables([tab]))[tab];
        if (table.rows.some((r) => r.record.id === record.id)) return record;
        if (e.status === 413) throw e;
        await api.append(api.sheetRange(tab, "A1"), [row]);
      }
      invalidate(tab);
      return record;
    },
  };
}
