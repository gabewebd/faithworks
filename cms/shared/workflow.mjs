// Review and publishing workflow. The server enforces these rules (server/services/records.mjs);
// the dashboard uses the same table only to decide which buttons to show.
import { isAdmin } from "./schema.mjs";

export const ACTIONS = {
  submit: { label: "Submit for review", from: ["needed", "draft", "changes_requested", "rejected"], to: "in_review", who: "editor" },
  withdraw: { label: "Withdraw from review", from: ["in_review"], to: "draft", who: "editor" },
  approve: { label: "Approve", from: ["draft", "in_review", "changes_requested"], to: "approved", who: "admin" },
  request_changes: { label: "Request changes", from: ["in_review"], to: "changes_requested", who: "admin", note: true },
  reject: { label: "Reject", from: ["in_review"], to: "rejected", who: "admin", note: true },
  publish: { label: "Publish", from: ["approved"], to: "published", who: "admin", confirm: true },
  unpublish: { label: "Unpublish", from: null, to: null, who: "admin", live: true, confirm: true },
  archive: { label: "Archive", from: ["needed", "draft", "in_review", "changes_requested", "approved", "published", "rejected"], to: "archived", who: "admin", confirm: true },
  restore: { label: "Restore to draft", from: ["archived"], to: "draft", who: "admin" },
  delete: { label: "Delete", from: null, to: null, who: "super", confirm: true },
};

// Statuses an Author may save edits in. Every signed-in CMS user may edit any content item
// (there is no per-item editor list); the authors on an item only say who wrote it. Saving
// approved or published content always creates a new draft that needs approval again, and
// only admins approve and publish, so editing never bypasses review.
export const AUTHOR_EDITABLE = ["needed", "draft", "changes_requested", "rejected", "approved", "published"];

export function canEdit(user, collection, rec) {
  if (rec.deleted_at) return false;
  if (collection === "settings") return isAdmin(user.role);
  if (isAdmin(user.role)) return rec.status !== "archived";
  return AUTHOR_EDITABLE.includes(rec.status);
}

export function canView(user, collection, rec) {
  if (collection === "settings") return isAdmin(user.role);
  if (rec.deleted_at) return user.role === "super_admin";
  return true;
}

// Which actions this user may take on this record right now (live = has a published copy).
export function allowedActions(user, collection, rec, { live = false } = {}) {
  const out = [];
  if (rec.deleted_at) return user.role === "super_admin" ? ["undelete"] : [];
  for (const [name, a] of Object.entries(ACTIONS)) {
    if (a.who === "admin" && !isAdmin(user.role)) continue;
    if (a.who === "super" && user.role !== "super_admin") continue;
    if (a.live && !live) continue;
    if (a.from && !a.from.includes(rec.status)) continue;
    if (collection === "settings" && ["archive", "delete", "unpublish", "restore", "reject"].includes(name)) continue;
    out.push(name);
  }
  return out;
}

// Status after a save. Edits to approved or published content need approval again;
// the live copy keeps serving until the new version is published.
export function statusAfterSave(status) {
  if (status === "approved" || status === "published" || status === "rejected" || status === "needed") return "draft";
  return status;
}
