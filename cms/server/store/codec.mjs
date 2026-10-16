// Record <-> spreadsheet row. Columns are matched by HEADER NAME, never by position, so a
// column moved or added by hand does not corrupt data. Every value is written as a plain
// string (valueInputOption=RAW), so nothing is ever evaluated as a formula.
// Long values (page HTML, JSON snapshots) span overflow columns key, key__2, key__3…
// because one Google Sheets cell holds at most 50,000 characters.
import { COLLECTIONS, SYSTEM_TABS, columnsFor, longCells } from "../../shared/schema.mjs";
import { HttpError } from "../http.mjs";

export const CHUNK = 45000;

const SYSTEM_TYPES = {
  version: "number", approved_version: "number", published_version: "number",
  payload: "json", data: "json", active: "boolean", archived: "boolean",
};
function typeOf(tab, key) {
  const fd = COLLECTIONS[tab]?.fields.find((x) => x.key === key);
  return fd ? fd.type : SYSTEM_TYPES[key] || "text";
}

export function encodeValue(type, v) {
  if (v === null || v === undefined) return "";
  switch (type) {
    case "list": return Array.isArray(v) ? v.join("\n") : String(v);
    case "tags": case "authors": return Array.isArray(v) ? v.join(", ") : String(v);
    case "pairs": case "json": return (Array.isArray(v) && !v.length) || v === "" ? "" : JSON.stringify(v);
    case "boolean": return v === true ? "TRUE" : "FALSE";
    case "number": return v === "" ? "" : String(v);
    default: return String(v);
  }
}

export function decodeValue(type, s) {
  const v = s === undefined || s === null ? "" : String(s);
  switch (type) {
    case "list": return v ? v.split("\n").map((x) => x.trim()).filter(Boolean) : [];
    case "tags": case "authors": return v ? v.split(",").map((x) => x.trim()).filter(Boolean) : [];
    case "pairs": try { return v ? JSON.parse(v) : []; } catch { return []; }
    case "json": try { return v ? JSON.parse(v) : null; } catch { return null; }
    case "boolean": return v.toUpperCase() === "TRUE";
    case "number": return v === "" || Number.isNaN(Number(v)) ? null : Number(v);
    default: return v;
  }
}

// Base field key of a column ("body_html__3" → "body_html", part 3)
function splitColumn(col) {
  const m = col.match(/^(.*)__(\d+)$/);
  return m ? [m[1], Number(m[2])] : [col, 1];
}

export function checkHeader(tab, header) {
  const missing = columnsFor(tab).filter((c) => !header.includes(c));
  if (missing.length) throw new HttpError(500, `The spreadsheet tab “${tab}” is missing columns: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}. Run the sheet setup script (npm run sheets:setup).`, "sheet_schema");
  const dup = header.filter((c, i) => c && header.indexOf(c) !== i);
  if (dup.length) throw new HttpError(500, `The spreadsheet tab “${tab}” has duplicate column headers: ${dup.join(", ")}.`, "sheet_schema");
}

// Row values (array aligned to header) → record
export function decodeRow(tab, header, row) {
  const known = new Set(columnsFor(tab).map((c) => splitColumn(c)[0]));
  const parts = {};
  header.forEach((col, i) => {
    if (!col) return;
    const [key, n] = splitColumn(col);
    if (!known.has(key)) return; // columns added by hand are preserved on write, never read into records
    (parts[key] ||= [])[n - 1] = row[i] ?? "";
  });
  const rec = {};
  for (const [key, chunks] of Object.entries(parts)) rec[key] = decodeValue(typeOf(tab, key), chunks.map((c) => c ?? "").join(""));
  return rec;
}

// Record → row values aligned to header. `existing` keeps columns the CMS does not own
// (e.g. a notes column someone added by hand).
export function encodeRow(tab, header, rec, existing = []) {
  const encoded = {};
  for (const col of header) {
    if (!col) continue;
    const [key] = splitColumn(col);
    if (key in encoded || !(key in rec)) continue;
    const s = encodeValue(typeOf(tab, key), rec[key]);
    const cells = longCells(tab, key);
    if (s.length > CHUNK * cells) {
      throw new HttpError(413, `“${key}” is too long to store (${s.length.toLocaleString()} characters; the limit is ${(CHUNK * cells).toLocaleString()}).`, "too_long");
    }
    encoded[key] = Array.from({ length: cells }, (_, i) => s.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  return header.map((col, i) => {
    if (!col) return existing[i] ?? "";
    const [key, n] = splitColumn(col);
    return key in encoded ? encoded[key][n - 1] ?? "" : existing[i] ?? "";
  });
}

export function columnLetter(index) { // 0 → A, 25 → Z, 26 → AA
  let s = "", n = index + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export const KNOWN_TABS = [...Object.keys(COLLECTIONS), ...Object.keys(SYSTEM_TABS)];
