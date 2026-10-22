// JSON file store: a development and test adapter with the same interface as the Sheets
// store. It is NOT the production content store. Writes are serialized in-process and the
// file is replaced atomically (write to a temp file, then rename).
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
import { HttpError } from "../http.mjs";
import { ALL_TABS } from "../../shared/schema.mjs";

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

export function createJsonStore({ path, seedPath }) {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    if (seedPath && existsSync(seedPath)) copyFileSync(seedPath, path);
    else writeFileSync(path, JSON.stringify(Object.fromEntries(ALL_TABS.map((t) => [t, []])), null, 2));
  }
  let queue = Promise.resolve();
  const load = () => {
    const data = JSON.parse(readFileSync(path, "utf8"));
    for (const t of [...ALL_TABS, "form_submissions"]) data[t] ||= [];
    return data;
  };
  const save = (data) => {
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, path);
  };
  const exclusive = (fn) => {
    const run = queue.then(() => fn(load()));
    queue = run.catch(() => {});
    return run;
  };

  return {
    kind: "json",
    path,
    async list(tab) { return clone(load()[tab]); },
    async listMany(tabs) { const d = load(); return Object.fromEntries(tabs.map((t) => [t, clone(d[t])])); },
    async get(tab, id) { return clone(load()[tab].find((r) => r.id === id) || null); },
    // Same filters as the Supabase store's query(). Values compare as ISO strings or text.
    async query(tab, { eq = {}, in: within = {}, gte = {}, lt = {}, order = "id.asc", limit = 1000 } = {}) {
      const [col, dir] = order.split(".");
      const rows = load()[tab].filter((r) => Object.entries(eq).every(([k, v]) => String(r[k] ?? "") === String(v))
        && Object.entries(within).every(([k, v]) => v.includes(r[k]))
        && Object.entries(gte).every(([k, v]) => String(r[k] ?? "") >= String(v))
        && Object.entries(lt).every(([k, v]) => String(r[k] ?? "") < String(v)));
      rows.sort((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")) * (dir === "desc" ? -1 : 1));
      return clone(rows.slice(0, limit));
    },
    insert: (tab, record) => exclusive((d) => {
      if (d[tab].some((r) => r.id === record.id)) throw new HttpError(409, `An item with id ${record.id} already exists.`, "duplicate_id");
      d[tab].push(clone(record));
      save(d);
      return clone(record);
    }),
    update: (tab, id, record, { expectWriteId } = {}) => exclusive((d) => {
      const i = d[tab].findIndex((r) => r.id === id);
      if (i < 0) throw new HttpError(404, "This item no longer exists.", "not_found");
      if (expectWriteId !== undefined && d[tab][i].write_id !== expectWriteId) {
        throw new HttpError(409, "Someone else saved this item a moment ago. Reload to see their changes.", "conflict", { current: clone(d[tab][i]) });
      }
      d[tab][i] = { ...d[tab][i], ...clone(record), id };
      save(d);
      return clone(d[tab][i]);
    }),
    appendLog: (tab, record) => exclusive((d) => { d[tab].push(clone(record)); save(d); return clone(record); }),
  };
}
