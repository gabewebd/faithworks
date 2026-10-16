// Users and roles, tags, audit log, recovery and backup.
import { ROLES, ALL_TABS, CONTENT_COLLECTIONS, isAdmin } from "../../shared/schema.mjs";
import { slugify } from "../../shared/validate.mjs";
import { HttpError, randomId, now } from "../http.mjs";

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function createAdmin({ store, cfg, log, auth }) {
  const requireSuper = (user) => { if (user.role !== "super_admin") throw new HttpError(403, "Only a Super Admin can do this.", "forbidden"); };
  const requireAdmin = (user) => { if (!isAdmin(user.role)) throw new HttpError(403, "Only admins can do this.", "forbidden"); };

  return {
    /* ---- Users (Super Admin) ---- */
    async listUsers(user) {
      requireSuper(user);
      const rows = await store.list("users");
      const pinned = cfg.superAdmins.map((email) => ({ id: email, email, name: rows.find((r) => r.id === email)?.name || "", role: "super_admin", active: true, pinned: true }));
      return [...pinned, ...rows.filter((r) => !cfg.superAdmins.includes(r.id)).map((r) => ({ id: r.id, email: r.email, name: r.name, role: r.role, active: r.active, version: r.version, updated_at: r.updated_at, updated_by: r.updated_by }))];
    },
    async saveUser(user, input, { requestId } = {}) {
      requireSuper(user);
      const email = String(input.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new HttpError(422, "Enter a valid email address.", "invalid", { errors: { email: "Enter a valid email address." } });
      if (!ROLES[input.role]) throw new HttpError(422, "Choose a role.", "invalid", { errors: { role: "Choose a role." } });
      if (cfg.superAdmins.includes(email)) throw new HttpError(409, "This Super Admin is set in the deployment settings (CMS_SUPER_ADMINS) and cannot be changed here.", "pinned");
      if (email === user.email) throw new HttpError(409, "You cannot change your own role or access.", "self");
      if (cfg.allowedDomains.length && !cfg.allowedDomains.includes(email.split("@")[1])) throw new HttpError(422, `Only these email domains may sign in: ${cfg.allowedDomains.join(", ")}.`, "invalid", { errors: { email: "Domain not allowed." } });
      const name = String(input.name || "").trim().slice(0, 120);
      const active = input.active !== false;
      const existing = await store.get("users", email);
      const stamp = now();
      let saved;
      if (existing) {
        if (input.version !== undefined && Number(input.version) !== Number(existing.version)) throw new HttpError(409, "This user was changed by someone else. Reload and try again.", "conflict");
        saved = await store.update("users", email, { ...existing, name, role: input.role, active, version: Number(existing.version) + 1, write_id: randomId("w", 6), updated_at: stamp, updated_by: user.email }, { expectWriteId: existing.write_id });
      } else {
        saved = await store.insert("users", { id: email, email, name, role: input.role, active, version: 1, write_id: randomId("w", 6), created_at: stamp, created_by: user.email, updated_at: stamp, updated_by: user.email });
      }
      auth.invalidateUsers();
      await log.log(user, existing ? "user_update" : "user_create", "users", email, saved.version, `role=${saved.role} active=${saved.active}`, requestId);
      return saved;
    },

    /* ---- Tags ---- */
    async listTags() {
      return (await store.list("tags")).sort((a, b) => a.label.localeCompare(b.label));
    },
    async saveTag(user, input, { requestId } = {}) {
      requireAdmin(user);
      const label = String(input.label || "").trim().slice(0, 60);
      if (!label) throw new HttpError(422, "A tag needs a name.", "invalid", { errors: { label: "Required." } });
      const description = String(input.description || "").trim().slice(0, 300);
      const stamp = now();
      if (input.id) {
        const existing = await store.get("tags", input.id);
        if (!existing) throw new HttpError(404, "Tag not found.", "not_found");
        const saved = await store.update("tags", existing.id, { ...existing, label, description, archived: input.archived === true, version: Number(existing.version) + 1, write_id: randomId("w", 6), updated_at: stamp, updated_by: user.email }, { expectWriteId: existing.write_id });
        await log.log(user, "tag_update", "tags", saved.id, saved.version, label, requestId);
        return saved;
      }
      const id = slugify(input.slug || label);
      if (!id) throw new HttpError(422, "Use letters or numbers in the tag name.", "invalid", { errors: { label: "Invalid." } });
      if (await store.get("tags", id)) throw new HttpError(409, `A tag “${id}” already exists.`, "duplicate", { errors: { label: "Already exists." } });
      const saved = await store.insert("tags", { id, label, description, archived: false, version: 1, write_id: randomId("w", 6), created_at: stamp, created_by: user.email, updated_at: stamp, updated_by: user.email });
      await log.log(user, "tag_create", "tags", id, 1, label, requestId);
      return saved;
    },

    /* ---- Audit ---- */
    async audit(user, { limit = 300, actor = "", recordId = "" } = {}) {
      requireAdmin(user);
      return (await store.list("audit_log"))
        .filter((a) => (!actor || a.actor === actor) && (!recordId || a.record_id === recordId))
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, Math.min(Number(limit) || 300, 1000));
    },

    /* ---- Recovery (Super Admin) ---- */
    async recovery(user) {
      requireSuper(user);
      const t = await store.listMany([...CONTENT_COLLECTIONS, "settings", "published"]);
      const live = new Map(t.published.filter((p) => p.state === "live").map((p) => [`${p.collection}:${p.record_id}`, p]));
      const out = { deleted: [], repair: [], orphans: [], live: live.size };
      for (const c of [...CONTENT_COLLECTIONS, "settings"]) {
        for (const r of t[c]) {
          const label = r.title || r.display_name || r.brand || r.id;
          if (r.deleted_at) out.deleted.push({ collection: c, id: r.id, label, deleted_at: r.deleted_at, deleted_by: r.deleted_by, version: r.version });
          const l = live.get(`${c}:${r.id}`);
          if (l && Number(r.published_version || 0) < Number(l.version)) out.repair.push({ collection: c, id: r.id, label, live_version: l.version, record_version: r.version });
        }
      }
      for (const [key, p] of live) if (!t[p.collection]?.some((r) => r.id === p.record_id)) out.orphans.push({ key, slug: p.slug, version: p.version });
      return out;
    },

    // Full JSON export of every tab (Super Admin). Downloaded by the browser; nothing is stored.
    async backup(user, { requestId } = {}) {
      requireSuper(user);
      const data = await store.listMany(ALL_TABS);
      await log.log(user, "backup_download", "", "", "", `${Object.values(data).reduce((n, rows) => n + rows.length, 0)} rows`, requestId);
      return { format: "faithworks-cms-backup", version: 1, exported_at: now(), store: store.kind, tabs: data };
    },
  };
}
