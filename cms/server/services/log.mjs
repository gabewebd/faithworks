// Audit log and version history. Both are append-only tabs.
// Audit: who did what, when (no content, no secrets, no personal data beyond the actor's email).
// History: a full copy of the record after every save and workflow action, so any version can
// be restored (accidental edits, deletions, or a failed multi-step operation).
import { randomId, now } from "../http.mjs";

export function createLog({ store, log = console }) {
  async function audit(user, action, collection, recordId, version, detail = "", requestId = "") {
    try {
      await store.appendLog("audit_log", {
        id: randomId("aud"), at: now(), actor: user?.email || "", role: user?.role || "", action, collection: collection || "",
        record_id: recordId || "", version: version ?? "", detail: String(detail || "").slice(0, 500), request_id: requestId,
      });
      return true;
    } catch (e) {
      log.error(`Audit log write failed (${action} ${collection}/${recordId}): ${e.message}`);
      return false;
    }
  }

  async function snapshot(user, collection, rec, kind) {
    try {
      await store.appendLog("history", {
        id: randomId("his"), record_id: rec.id, collection, version: rec.version, kind, status: rec.status,
        at: now(), by: user?.email || "", write_id: rec.write_id, data: rec,
      });
      return true;
    } catch (e) {
      log.error(`History write failed (${kind} ${collection}/${rec.id} v${rec.version}): ${e.message}`);
      return false;
    }
  }

  return { log: audit, snapshot };
}
