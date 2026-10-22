// Copy of each submission in its own Google Sheets tab (FORMS_SHEETS_MIRROR=true), for people who
// work from the spreadsheet. A copy only: the CMS reads submissions from Supabase and never from
// this tab, so the CMS keeps working when Google is unavailable.
//
// Safety for the existing spreadsheet: only the one tab named by FORMS_SHEETS_TAB
// (form_submissions) is ever written. If the tab does not exist it is created with the header
// row below. If it exists, its own header row is used as-is: columns are matched by name, a column
// someone added is left empty, nothing is reordered, renamed or overwritten, and rows are only
// ever appended. Every value is written RAW, so text starting with "=" is not a formula.
//
// Duplicates: before appending, the tab's submission_id column is read; a submission already in
// it counts as copied. Appends are never retried blindly (the next attempt re-reads first).
import { formLabel, FORMS, answerLabel } from "../../shared/forms.mjs";

export const MIRROR_COLUMNS = ["submission_id", "received_at", "form", "form_id", "kind", "name", "email", "offer_id", "source_page", "consent_marketing", "answers"];

function cells(sub) {
  const answers = Object.entries(sub.answers || {}).map(([k, v]) => {
    const label = FORMS[sub.form_id]?.fields.find((f) => f.name === k)?.label || k;
    return `${label}: ${answerLabel(sub.form_id, k, v)}`;
  }).join("\n");
  return {
    submission_id: sub.id, received_at: sub.received_at, form: formLabel(sub.form_id), form_id: sub.form_id, kind: sub.kind,
    name: sub.name, email: sub.email, offer_id: sub.context?.offer_id || "", source_page: sub.context?.source_page || "",
    consent_marketing: sub.context?.consent?.marketing || "", answers: answers.slice(0, 45000),
  };
}

export function createSheetsMirror({ api, tab }) {
  const range = (a1) => api.sheetRange(tab, a1);
  async function header() {
    const meta = await api.metadata();
    if (!meta.sheets?.some((s) => s.properties?.title === tab)) {
      await api.batchUpdate([{ addSheet: { properties: { title: tab } } }]);
      await api.update(range("A1"), [MIRROR_COLUMNS]);
      return MIRROR_COLUMNS;
    }
    const [row = []] = await api.get(range("1:1"));
    if (!row.length) { await api.update(range("A1"), [MIRROR_COLUMNS]); return MIRROR_COLUMNS; }
    return row.map((x) => String(x).trim());
  }
  return {
    enabled: true,
    async write(sub) {
      try {
        const cols = await header();
        const idCol = cols.indexOf("submission_id");
        if (idCol < 0) return { ok: false, error: `The "${tab}" tab has no submission_id column. Add it back to row 1; nothing was written.` };
        const letter = colLetter(idCol);
        const ids = (await api.get(range(`${letter}2:${letter}`))).map((r) => String(r[0] ?? ""));
        if (ids.includes(sub.id)) return { ok: true, already: true };
        const v = cells(sub);
        await api.append(range("A1"), [cols.map((c) => (c in v ? String(v[c] ?? "") : ""))]);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: `Google Sheets: ${String(e.message || "error").slice(0, 200)}` };
      }
    },
  };
}

function colLetter(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
