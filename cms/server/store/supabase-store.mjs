// Supabase content store (production). Server-side only.
//
// Talks to Supabase's Data API (PostgREST) over HTTPS with the service-role key; no SDK is
// needed. Tables are created by cms/supabase/migrations/ (one per CMS tab, prefixed "cms_").
// Workflow and bookkeeping fields are typed columns; a content record's own fields are stored
// in its `fields` jsonb column and merged back into one flat record on read, so the services
// see the same records as with the other stores.
//
// Optimistic concurrency is enforced by the database: an update with `expectWriteId` only
// matches the row while its write_id is unchanged, so two saves can never overwrite each other.
// Reads and updates retry transient failures (429, 5xx, network). Inserts and log appends are
// retried only after checking that the first attempt did not land, so a retry cannot duplicate.
// Database failures are reported as errors; nothing falls back to another store.
import { COLLECTIONS, SYSTEM_FIELDS, hasSlug } from "../../shared/schema.mjs";
import { HttpError } from "../http.mjs";

const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);
const PAGE = 1000; // Supabase's default max rows per request
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TS = ["created_at", "updated_at", "published_at", "deleted_at", "at"];
const INT = ["version", "published_version"];
const BOOL = ["active", "archived"];
const JSON_COLS = ["payload", "data"];

// Typed columns of every table (cms/supabase/migrations). Content tables also have `fields`.
const COLUMNS = {
  published: ["id", "record_id", "collection", "slug", "version", "state", "published_at", "published_by", "write_id", "payload"],
  history: ["id", "record_id", "collection", "version", "kind", "status", "at", "by", "write_id", "data"],
  audit_log: ["id", "at", "actor", "role", "action", "collection", "record_id", "version", "detail", "request_id"],
  users: ["id", "email", "name", "role", "active", "version", "write_id", "created_at", "created_by", "updated_at", "updated_by"],
  tags: ["id", "label", "description", "archived", "version", "write_id", "created_at", "created_by", "updated_at", "updated_by"],
};
for (const c of Object.keys(COLLECTIONS)) COLUMNS[c] = [...SYSTEM_FIELDS, ...(hasSlug(c) ? ["slug"] : [])];
export const SUPABASE_TABS = Object.keys(COLUMNS);
export const tableOf = (tab) => {
  if (!COLUMNS[tab]) throw new HttpError(500, `Unknown CMS table: ${tab}`, "unknown_table");
  return `cms_${tab}`;
};

function encodeCol(col, v) {
  if (TS.includes(col)) return v === "" || v == null ? null : new Date(v).toISOString();
  if (INT.includes(col)) return v === "" || v == null || Number.isNaN(Number(v)) ? null : Math.trunc(Number(v));
  if (BOOL.includes(col)) return v === true || String(v).toUpperCase() === "TRUE";
  if (JSON_COLS.includes(col)) return v ?? null;
  return v == null ? "" : String(v);
}
function decodeCol(col, v) {
  if (TS.includes(col)) return v == null ? "" : new Date(v).toISOString();
  if (INT.includes(col)) return v ?? null;
  if (BOOL.includes(col)) return v === true;
  if (JSON_COLS.includes(col)) return v ?? null;
  return v ?? "";
}

// Record → row. Keys that are not columns go into `fields` (content tables) or are dropped.
export function encodeRecord(tab, rec) {
  const cols = COLUMNS[tab];
  const row = {};
  const fields = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v === undefined) continue;
    if (cols.includes(k)) row[k] = encodeCol(k, v);
    else fields[k] = v;
  }
  if (COLLECTIONS[tab]) row.fields = fields;
  return row;
}
export function decodeRow(tab, row) {
  const rec = { ...(COLLECTIONS[tab] && row.fields && typeof row.fields === "object" ? row.fields : {}) };
  for (const col of COLUMNS[tab]) if (col in row) rec[col] = decodeCol(col, row[col]);
  return rec;
}

export function createSupabaseStore({ url, serviceKey, fetchImpl = globalThis.fetch, timeoutMs = 8000, maxAttempts = 4, baseDelayMs = 300, log = console }) {
  const base = `${String(url).replace(/\/$/, "")}/rest/v1`;
  // Legacy service_role keys are JWTs and also go in Authorization; new secret keys (sb_secret_…) only in apikey.
  const auth = { apikey: serviceKey, ...(serviceKey.startsWith("eyJ") ? { authorization: `Bearer ${serviceKey}` } : {}) };
  const backoff = (attempt) => baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * baseDelayMs);
  const eq = (v) => `eq.${encodeURIComponent(v)}`;

  async function call(method, path, { body, prefer, retry = false } = {}) {
    let lastErr;
    const attempts = retry ? maxAttempts : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let res;
      try {
        res = await fetchImpl(`${base}/${path}`, {
          method,
          headers: { ...auth, accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(prefer ? { prefer } : {}) },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        lastErr = new HttpError(503, "The CMS database (Supabase) could not be reached. Please try again.", "db_unavailable");
        lastErr.cause = e;
        lastErr.transport = true;
        if (attempt < attempts) { await sleep(backoff(attempt)); continue; }
        throw lastErr;
      }
      const text = await res.text().catch(() => "");
      if (res.ok) return text ? JSON.parse(text) : null;
      let err = {};
      try { err = JSON.parse(text); } catch { /* not JSON */ }
      if (TRANSIENT.has(res.status)) {
        lastErr = new HttpError(503, `The CMS database (Supabase) is temporarily unavailable (HTTP ${res.status}). Please try again.`, "db_unavailable");
        if (attempt < attempts) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 10_000) : backoff(attempt));
          continue;
        }
        throw lastErr;
      }
      log.error?.(`Supabase ${method} ${path.replace(/\?.*/, "")} → ${res.status} ${err.code || ""}: ${(err.message || text).slice(0, 300)}`);
      if (err.code === "23505") throw Object.assign(new HttpError(409, "An item with this id already exists.", "duplicate_id"), { duplicate: true });
      if (res.status === 401 || res.status === 403 || err.code === "42501") throw new HttpError(502, "The CMS cannot access its database. Check SUPABASE_SECRET_KEY (it must be a secret key, sb_secret_…) and that the migrations have run.", "db_forbidden");
      if (err.code === "PGRST205" || err.code === "42P01") throw new HttpError(502, "A CMS table is missing in Supabase. Run the migrations in cms/supabase/migrations (see cms/README.md).", "db_schema");
      throw new HttpError(502, `The CMS database rejected the request (HTTP ${res.status}).`, "db_error");
    }
    throw lastErr;
  }

  async function list(tab) {
    const out = [];
    for (let offset = 0; ; offset += PAGE) {
      const rows = await call("GET", `${tableOf(tab)}?select=*&order=id.asc&limit=${PAGE}&offset=${offset}`, { retry: true });
      out.push(...rows.map((r) => decodeRow(tab, r)));
      if (rows.length < PAGE) return out;
    }
  }
  async function get(tab, id) {
    const rows = await call("GET", `${tableOf(tab)}?select=*&id=${eq(id)}&limit=1`, { retry: true });
    return rows[0] ? decodeRow(tab, rows[0]) : null;
  }

  // One row, POSTed once. After a transport failure (the insert may or may not have landed) the
  // row is looked up first: `landed(row)` decides whether it is ours; otherwise it is sent again.
  async function insertRow(tab, record, landed) {
    const send = () => call("POST", tableOf(tab), { body: [encodeRecord(tab, record)], prefer: "return=representation" });
    let rows;
    try {
      rows = await send();
    } catch (e) {
      if (!e.transport) throw e;
      const found = await get(tab, record.id);
      if (found && landed(found)) return found;
      if (found) throw new HttpError(409, `An item with id ${record.id} already exists.`, "duplicate_id");
      rows = await send();
    }
    return decodeRow(tab, rows[0]);
  }

  return {
    kind: "supabase",
    list,
    async listMany(tabs) {
      const lists = await Promise.all(tabs.map((t) => list(t)));
      return Object.fromEntries(tabs.map((t, i) => [t, lists[i]]));
    },
    get,

    async insert(tab, record) {
      try {
        return await insertRow(tab, record, (found) => found.write_id === String(record.write_id ?? ""));
      } catch (e) {
        if (e.duplicate) throw new HttpError(409, `An item with id ${record.id} already exists.`, "duplicate_id");
        throw e;
      }
    },

    // Replaces the record's row (callers pass the whole record). `expectWriteId`, when given,
    // must match the row's current write_id; the check and the write are one statement.
    async update(tab, id, record, { expectWriteId } = {}) {
      const filter = `id=${eq(id)}${expectWriteId !== undefined ? `&write_id=${eq(expectWriteId ?? "")}` : ""}`;
      const rows = await call("PATCH", `${tableOf(tab)}?${filter}`, { body: encodeRecord(tab, { ...record, id }), prefer: "return=representation", retry: true });
      if (rows.length === 1) return decodeRow(tab, rows[0]);
      const current = await get(tab, id);
      if (!current) throw new HttpError(404, "This item no longer exists.", "not_found");
      if (record.write_id && current.write_id === record.write_id) return current; // an earlier attempt of this same write landed
      throw new HttpError(409, "Someone else saved this item a moment ago. Reload to see their changes.", "conflict", { current });
    },

    // Append-only logs (audit_log, history). Ids are random, so a row with this id is ours.
    async appendLog(tab, record) {
      try {
        await insertRow(tab, record, () => true);
      } catch (e) {
        if (!e.duplicate && e.code !== "duplicate_id") throw e;
      }
      return record;
    },

    // Migration/seed helper: adds the records whose id is not in the table yet; never changes
    // or deletes existing rows. Returns which ids were added and which were already present.
    async importMissing(tab, records, { dryRun = false } = {}) {
      const existing = new Map((await list(tab)).map((r) => [r.id, r]));
      const missing = records.filter((r) => !existing.has(r.id));
      const present = records.filter((r) => existing.has(r.id));
      if (!dryRun) {
        for (let i = 0; i < missing.length; i += 200) {
          await call("POST", `${tableOf(tab)}?on_conflict=id`, { body: missing.slice(i, i + 200).map((r) => encodeRecord(tab, r)), prefer: "resolution=ignore-duplicates,return=minimal", retry: true });
        }
      }
      const edited = present.filter((r) => r.write_id !== undefined && existing.get(r.id).write_id !== String(r.write_id));
      return { added: missing.map((r) => r.id), present: present.map((r) => r.id), edited: edited.map((r) => r.id) };
    },
  };
}
