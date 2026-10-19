// Publishing workflow. The server enforces these rules (server/services/records.mjs);
// the dashboard uses the same table only to decide which buttons to show.
import { isSuperAdmin } from "./schema.mjs";

// who: "owner" = the item's owners and Super Admins; "admin" = Super Admins only.
// Publishing is one step: there is no review or approval role.
export const ACTIONS = {
  publish: { label: "Publish", from: ["draft"], to: "published", who: "owner", confirm: true },
  unpublish: { label: "Unpublish", from: null, to: "draft", who: "owner", live: true, confirm: true },
  archive: { label: "Archive", from: ["draft", "published"], to: "archived", who: "owner", confirm: true },
  restore: { label: "Restore to draft", from: ["archived"], to: "draft", who: "owner" },
  delete: { label: "Delete", from: null, to: null, who: "admin", confirm: true },
};

// Two roles. Super Admins create, edit and publish any content and manage the CMS itself:
// users and roles, site settings, tags, deleting and restoring items, recovery and backup.
// Authors create content and edit, publish, unpublish and archive the items they own. Every
// signed-in user may read content items (for links and references); only owners change them.

// An item's owners: whoever created it and the people listed as its authors. created_by is
// set by the server only, and Authors cannot remove other people from `authors`
// (server/services/records.mjs), so ownership cannot be taken over by editing an item.
export function isOwner(user, rec) {
  return rec.created_by === user.email || (Array.isArray(rec.authors) && rec.authors.includes(user.email));
}

// May this user change this item (save, publish, unpublish, archive, finish publishing)?
export function canManage(user, collection, rec) {
  if (collection === "settings") return isSuperAdmin(user.role);
  return isSuperAdmin(user.role) || isOwner(user, rec);
}

export function canEdit(user, collection, rec) {
  if (rec.deleted_at || rec.status === "archived") return false;
  return canManage(user, collection, rec);
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
  for (const [name, a] of Object.entries(ACTIONS)) {
    if (a.who === "admin" && !admin) continue;
    if (a.who === "owner" && !manage) continue;
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
