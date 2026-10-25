// Publishing workflow. The server enforces these rules (server/services/records.mjs);
// the dashboard uses the same table only to decide which buttons to show.
import { isSuperAdmin, normalizeRole } from "./schema.mjs";

// who: "editor" = every CMS user (Authors and Super Admins), whoever created the item;
// "owner" = the item's owners and Super Admins; "admin" = Super Admins only.
// Publishing is one step: there is no review or approval role.
export const ACTIONS = {
  publish: { label: "Publish", from: ["draft"], to: "published", who: "editor", confirm: true },
  unpublish: { label: "Unpublish", from: null, to: "draft", who: "owner", live: true, confirm: true },
  archive: { label: "Archive", from: ["draft", "published"], to: "archived", who: "owner", confirm: true },
  restore: { label: "Restore to draft", from: ["archived"], to: "draft", who: "owner" },
  delete: { label: "Delete", from: null, to: null, who: "admin", confirm: true },
};

// Two roles. Super Admins create, edit and publish any content and manage the CMS itself:
// users and roles, site settings, tags, deleting and restoring items, recovery and backup.
// Authors create content and edit and publish any content item, whoever created it; unpublishing,
// archiving and restoring stay with the item's owners (and Super Admins). Every change records
// who made it (updated_by, published_by, the audit log and version history).

// An item's owners: whoever created it and the people listed as its authors. created_by is
// set by the server only, and Authors cannot remove other people from `authors`
// (server/services/records.mjs). Ownership is kept for attribution and for taking an item off
// the website; it does not limit who may edit or publish.
export function isOwner(user, rec) {
  return rec.created_by === user.email || (Array.isArray(rec.authors) && rec.authors.includes(user.email));
}

// May this user edit and publish items of this collection? Any current CMS role for content;
// Site settings are Super Admins only. (Users without a current role never get a session.)
export function canEditContent(user, collection) {
  if (collection === "settings") return isSuperAdmin(user.role);
  return !!normalizeRole(user.role);
}

// May this user take this item off the website or change its lifecycle (unpublish, archive, restore)?
export function canManage(user, collection, rec) {
  if (collection === "settings") return isSuperAdmin(user.role);
  return isSuperAdmin(user.role) || isOwner(user, rec);
}

export function canEdit(user, collection, rec) {
  if (rec.deleted_at || rec.status === "archived") return false;
  return canEditContent(user, collection);
}

export function canView(user, collection, rec) {
  if (collection === "settings") return isSuperAdmin(user.role);
  if (rec.deleted_at) return isSuperAdmin(user.role);
  return true;
}

// Which actions this user may take on this record right now (live = has a published copy).
export function allowedActions(user, collection, rec, { live = false } = {}) {
  const out = [];
  if (rec.deleted_at) return isSuperAdmin(user.role) ? ["undelete"] : [];
  const admin = isSuperAdmin(user.role);
  const manage = canManage(user, collection, rec);
  const edit = canEditContent(user, collection);
  for (const [name, a] of Object.entries(ACTIONS)) {
    if (a.who === "admin" && !admin) continue;
    if (a.who === "owner" && !manage) continue;
    if (a.who === "editor" && !edit) continue;
    if (a.live && !live) continue;
    if (a.from && !a.from.includes(rec.status)) continue;
    if (collection === "settings" && ["archive", "delete", "unpublish", "restore"].includes(name)) continue;
    out.push(name);
  }
  return out;
}

// Status after a save. Editing published content makes a new draft; the live copy keeps
// serving until the draft is published.
export function statusAfterSave(status) {
  return status === "archived" ? "archived" : "draft";
}
