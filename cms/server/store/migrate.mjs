// Reads through any store (Supabase or JSON) with records from earlier CMS versions converted to
// the current model (shared/schema.mjs: migrateRecord): retired statuses read as Draft, old
// event registration options and testimonial consent fields become the new fields. Only
// reads are converted. Nothing is rewritten in the store until someone saves the item, and
// the retired values stay stored.
import { COLLECTIONS, migrateRecord } from "../../shared/schema.mjs";

function migrateRow(tab, row) {
  if (!row) return row;
  if (tab === "published" && row.payload && COLLECTIONS[row.collection]) return { ...row, payload: migrateRecord(row.collection, row.payload) };
  return COLLECTIONS[tab] ? migrateRecord(tab, row) : row;
}

export function withMigrations(store) {
  return {
    ...store,
    async list(tab, opts) { return (await store.list(tab, opts)).map((r) => migrateRow(tab, r)); },
    async listMany(tabs, opts) {
      const t = await store.listMany(tabs, opts);
      return Object.fromEntries(Object.entries(t).map(([k, rows]) => [k, rows.map((r) => migrateRow(k, r))]));
    },
    async get(tab, id) { return migrateRow(tab, await store.get(tab, id)); },
  };
}
