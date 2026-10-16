// Content records: create, edit, review workflow, publishing. Every permission is checked
// here on the server; the dashboard only mirrors these rules to decide which buttons to show.
//
// Draft vs live: a record row is the WORKING COPY. What the website shows is the sanitized
// payload in the `published` tab. Editing a live item changes only the working copy (its
// status returns to Draft and needs approval again); the live copy stays until re-published.
//
// Publishing is staged so a partial failure never exposes unapproved content:
//   1. validate the approved working copy and build its public payload;
//   2. write the payload to `published` and confirm it   <- the moment it goes live;
//   3. mark the record Published and confirm it;
//   4. write history + audit, refresh the public cache, start a website rebuild.
// If step 2 fails, nothing changed. If step 3 fails, the item is live but still marked
// Approved; the dashboard flags it and "Finish publishing" (reconcile) completes it.
import { COLLECTIONS, CONTENT_COLLECTIONS, isAdmin, hasSlug, publicPath } from "../../shared/schema.mjs";
import { normalize, validate, slugify, testimonialPublishable } from "../../shared/validate.mjs";
import { ACTIONS, canEdit, canView, allowedActions, statusAfterSave } from "../../shared/workflow.mjs";
import { toPublic } from "../../shared/public.mjs";
import { readingTime, bylineOf } from "../../shared/page-doc.mjs";
import { HttpError, randomId, now } from "../http.mjs";

const SUMMARY_FIELDS = ["id", "status", "version", "slug", "updated_at", "updated_by", "created_by", "review_date", "content_owner", "authors", "byline", "tags", "deleted_at", "resource_type", "event_date", "kind", "consent_status", "display_approved"];

export function createRecords({ store, cfg, log, onPublicChange = async () => ({}) }) {
  const assertCollection = (c) => { if (!COLLECTIONS[c]) throw new HttpError(404, "Unknown content type.", "not_found"); };
  const labelOf = (c, rec) => rec[COLLECTIONS[c].labelField] || rec.title || rec.id;

  async function load(collection, id) {
    assertCollection(collection);
    const [rec, live] = await Promise.all([store.get(collection, id), store.get("published", `${collection}:${id}`)]);
    if (!rec) throw new HttpError(404, "This item was not found. It may have been deleted.", "not_found");
    return { rec, live: live && live.state === "live" ? live : null, liveRow: live };
  }

  function view(user, collection, rec, live) {
    const needsRepair = !!(live && Number(rec.published_version || 0) < Number(live.version));
    return {
      collection, record: rec, label: labelOf(collection, rec),
      live: live ? { version: live.version, slug: live.slug, published_at: live.published_at, published_by: live.published_by, url: publicPath(collection, live.slug) } : null,
      needs_repair: needsRepair,
      draft_differs: !!(live && rec.status !== "published"),
      can_edit: canEdit(user, collection, rec),
      actions: allowedActions(user, collection, rec, { live: !!live }).concat(needsRepair && isAdmin(user.role) ? ["reconcile"] : []),
      public_url: hasSlug(collection) && rec.slug ? publicPath(collection, rec.slug) : null,
    };
  }

  // Field-level permissions: keep the stored value of fields this role may not change.
  function guardFields(user, collection, incoming, current) {
    const blank = normalize(collection, {});
    for (const fd of COLLECTIONS[collection].fields) {
      const locked = (fd.adminOnly && !isAdmin(user.role)) || (fd.superOnly && user.role !== "super_admin");
      if (locked) incoming[fd.key] = current ? current[fd.key] : blank[fd.key];
    }
    return incoming;
  }

  // CMS users who can be named as authors: active people on the user list plus the pinned
  // Super Admins. email → display name.
  async function authorDirectory() {
    const users = await store.list("users");
    const out = new Map();
    for (const email of cfg.superAdmins || []) out.set(email, users.find((u) => u.id === email)?.name || email.split("@")[0]);
    for (const u of users) if (u.active && !out.has(u.id)) out.set(u.id, u.name || u.id.split("@")[0]);
    return out;
  }

  // Values the server calculates on every save: the public byline (names, never emails) and
  // an article’s reading time. Hidden and legacy fields the request did not send keep their
  // stored values, so nothing the form no longer shows is ever blanked.
  async function prepare(collection, input, data, current) {
    const fields = COLLECTIONS[collection].fields;
    if (current) for (const fd of fields) if ((fd.hidden || fd.legacy || fd.computed) && !(fd.key in (input || {}))) data[fd.key] = current[fd.key] ?? data[fd.key];
    if (fields.some((fd) => fd.key === "byline")) {
      const dir = await authorDirectory();
      data.byline = Array.isArray(data.authors) && data.authors.length ? bylineOf({ authors: data.authors }, Object.fromEntries(dir)) : data.author || ""; // older articles: their stored author name
      data._authorSet = new Set([...dir.keys(), ...(current?.authors || [])]);
    }
    if (collection === "resources") data.read_time = data.resource_type === "article" ? readingTime(data.body_html) : "";
    return data;
  }

  async function checkRefs(collection, rec) {
    const tabs = ["tags", collection];
    if (collection === "events") tabs.push("programs");
    const t = await store.listMany([...new Set(tabs)], { fresh: false });
    const tags = new Set(t.tags.filter((x) => !x.archived).map((x) => x.id));
    const refs = collection === "events" ? new Set(t.programs.filter((p) => !p.deleted_at).map((p) => p.id)) : null;
    return { tags, refs, siblings: t[collection] };
  }

  function slugProblem(collection, rec, siblings, livePayloadSlugs = []) {
    if (!hasSlug(collection) || !rec.slug) return null;
    for (const o of siblings) {
      if (o.id === rec.id || o.deleted_at) continue;
      const prev = String(o.previous_slugs || "").split(",").map((s) => s.trim());
      if (o.slug === rec.slug || prev.includes(rec.slug)) return `The address ${publicPath(collection, rec.slug)} is already used by “${labelOf(collection, o)}”. Choose another slug.`;
    }
    if (livePayloadSlugs.includes(rec.slug)) return `The address ${publicPath(collection, rec.slug)} is already live for another item.`;
    return null;
  }

  async function validateAll(collection, rec, { strict }) {
    const { tags, refs, siblings } = await checkRefs(collection, rec);
    const errors = validate(collection, rec, { strict, tags, refs, authors: rec._authorSet || null });
    const sp = slugProblem(collection, rec, siblings);
    if (sp) errors.slug = sp;
    return errors;
  }
  const fail422 = (errors, message = "Please fix the highlighted fields.") => { throw new HttpError(422, message, "invalid", { errors }); };

  function checkVersion(rec, version) {
    if (version === undefined || version === null) throw new HttpError(400, "Missing the version you are editing.", "missing_version");
    if (Number(version) !== Number(rec.version)) {
      throw new HttpError(409, `This item was changed by ${rec.updated_by || "someone"} at ${rec.updated_at} after you opened it. Reload to see the latest version, then reapply your changes.`, "conflict", { current: { version: rec.version, updated_by: rec.updated_by, updated_at: rec.updated_at, status: rec.status } });
    }
  }

  async function write(user, collection, rec, patch, kind, { requestId } = {}) {
    const next = { ...rec, ...patch, version: Number(rec.version) + 1, write_id: randomId("w", 6), updated_at: now(), updated_by: user.email };
    const saved = await store.update(collection, rec.id, next, { expectWriteId: rec.write_id });
    await log.snapshot(user, collection, saved, kind);
    await log.log(user, kind, collection, rec.id, saved.version, patch.review_note && kind !== "save" ? `Note: ${patch.review_note}` : "", requestId);
    return saved;
  }

  return {
    async authors() {
      return [...(await authorDirectory())].map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
    },

    async list(user, collection, { q = "", status = "", tag = "", includeDeleted = false } = {}) {
      assertCollection(collection);
      if (collection === "settings" && !isAdmin(user.role)) throw new HttpError(403, "Only admins can open Site settings.", "forbidden");
      const t = await store.listMany([collection, "published"], { fresh: false });
      const live = new Map(t.published.filter((p) => p.collection === collection && p.state === "live").map((p) => [p.record_id, p]));
      const needle = q.trim().toLowerCase();
      return t[collection]
        .filter((r) => (includeDeleted && user.role === "super_admin") || !r.deleted_at)
        .filter((r) => canView(user, collection, r))
        .filter((r) => !status || r.status === status || (status === "live" && live.has(r.id)))
        .filter((r) => !tag || (r.tags || []).includes(tag))
        .filter((r) => !needle || [labelOf(collection, r), r.slug, r.summary, r.byline, r.content_owner, r.quote].some((v) => String(v || "").toLowerCase().includes(needle)))
        .map((r) => {
          const l = live.get(r.id);
          return {
            ...Object.fromEntries(SUMMARY_FIELDS.map((k) => [k, r[k]])), label: labelOf(collection, r),
            live: l ? { version: l.version, slug: l.slug } : null, needs_repair: !!(l && Number(r.published_version || 0) < Number(l.version)),
            can_edit: canEdit(user, collection, r),
          };
        })
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    },

    async get(user, collection, id) {
      const { rec, live } = await load(collection, id);
      if (!canView(user, collection, rec)) throw new HttpError(403, "You do not have access to this item.", "forbidden");
      return view(user, collection, rec, live);
    },

    async create(user, collection, input = {}, { requestId } = {}) {
      assertCollection(collection);
      if (COLLECTIONS[collection].singleton) {
        if (!isAdmin(user.role)) throw new HttpError(403, "Only admins can create Site settings.", "forbidden");
        if (await store.get(collection, COLLECTIONS[collection].singleton)) throw new HttpError(409, "Site settings already exist. Edit them instead.", "exists");
      }
      const data = guardFields(user, collection, normalize(collection, input), null);
      if (hasSlug(collection) && !data.slug) data.slug = slugify(data.title);
      if (Array.isArray(data.authors) && !data.authors.length && !COLLECTIONS[collection].singleton) data.authors = [user.email];
      await prepare(collection, input, data, null);
      const errors = await validateAll(collection, { ...data, id: "" }, { strict: false });
      if (Object.keys(errors).length) fail422(errors);
      delete data._authorSet;
      const stamp = now();
      const rec = {
        ...data, id: COLLECTIONS[collection].singleton || randomId(COLLECTIONS[collection].prefix, 6),
        status: input.status === "needed" && isAdmin(user.role) ? "needed" : "draft", version: 1, write_id: randomId("w", 6),
        created_at: stamp, created_by: user.email, updated_at: stamp, updated_by: user.email,
        submitted_at: "", submitted_by: "", reviewed_at: "", reviewed_by: "", review_note: "", approved_at: "", approved_by: "", approved_version: "",
        published_at: "", published_by: "", published_version: "", published_slug: "", previous_slugs: "", deleted_at: "", deleted_by: "",
      };
      const saved = await store.insert(collection, rec);
      await log.snapshot(user, collection, saved, "create");
      await log.log(user, "create", collection, saved.id, 1, "", requestId);
      return view(user, collection, saved, null);
    },

    async save(user, collection, id, { version, data = {}, confirmSlugChange = false } = {}, { requestId } = {}) {
      const { rec, live } = await load(collection, id);
      if (!canEdit(user, collection, rec)) {
        throw new HttpError(403, rec.status === "in_review" ? "This item is under review. Withdraw it from review to edit it." : "You do not have permission to edit this item.", "forbidden");
      }
      checkVersion(rec, version);
      const incoming = guardFields(user, collection, normalize(collection, data), rec);
      await prepare(collection, data, incoming, rec);
      if (hasSlug(collection) && !incoming.slug) incoming.slug = rec.slug || slugify(incoming.title);
      const liveSlug = live?.slug;
      if (live && hasSlug(collection) && incoming.slug !== liveSlug) {
        if (!isAdmin(user.role)) throw new HttpError(403, "Only an admin can change the address of a published page.", "slug_locked");
        if (!confirmSlugChange) throw new HttpError(409, `This page is live at ${publicPath(collection, liveSlug)}. Changing the slug moves it to ${publicPath(collection, incoming.slug)}; the old address will redirect after the next publish. Confirm to continue.`, "slug_change_confirm");
      }
      const errors = await validateAll(collection, { ...incoming, id }, { strict: false });
      if (Object.keys(errors).length) fail422(errors);
      delete incoming._authorSet;
      const changed = COLLECTIONS[collection].fields.some((fd) => JSON.stringify(incoming[fd.key] ?? null) !== JSON.stringify(rec[fd.key] ?? null));
      if (!changed) return { ...view(user, collection, rec, live), unchanged: true };
      const status = rec.status === "in_review" ? "in_review" : statusAfterSave(rec.status);
      const patch = { ...incoming, status };
      if (status !== rec.status && ["approved", "published"].includes(rec.status)) Object.assign(patch, { approved_at: "", approved_by: "", approved_version: "" });
      const saved = await write(user, collection, rec, patch, "save", { requestId });
      return view(user, collection, saved, live);
    },

    async act(user, collection, id, action, { version, note = "" } = {}, { requestId } = {}) {
      if (action === "publish") return this.publish(user, collection, id, { version }, { requestId });
      if (action === "reconcile") return this.reconcile(user, collection, id, { requestId });
      if (!ACTIONS[action] && action !== "undelete") throw new HttpError(404, "Unknown action.", "not_found");
      const { rec, live, liveRow } = await load(collection, id);
      checkVersion(rec, version);
      const allowed = allowedActions(user, collection, rec, { live: !!live });
      if (!allowed.includes(action)) throw new HttpError(403, `You cannot ${ACTIONS[action]?.label.toLowerCase() || action} this item in its current state.`, "forbidden");
      const stamp = now();
      const trimmed = String(note || "").trim().slice(0, 1000);
      if (ACTIONS[action]?.note && trimmed.length < 3) throw new HttpError(422, "Add a short note explaining what needs to change.", "note_required", { errors: { note: "Required." } });

      let patch;
      let unpublished = false;
      switch (action) {
        case "submit": {
          const errors = await validateAll(collection, rec, { strict: true });
          if (Object.keys(errors).length) fail422(errors, "Complete the required fields before submitting for review.");
          patch = { status: "in_review", submitted_at: stamp, submitted_by: user.email, review_note: trimmed || rec.review_note };
          break;
        }
        case "withdraw": patch = { status: "draft" }; break;
        case "approve": {
          const errors = await validateAll(collection, rec, { strict: true });
          if (collection === "testimonials") { const p = testimonialPublishable(rec); if (p.length) errors.consent_status = p.join(" "); }
          if (Object.keys(errors).length) fail422(errors, "This item cannot be approved until the highlighted fields are complete.");
          patch = { status: "approved", approved_at: stamp, approved_by: user.email, approved_version: Number(rec.version) + 1, reviewed_at: stamp, reviewed_by: user.email, review_note: trimmed };
          break;
        }
        case "request_changes": patch = { status: "changes_requested", reviewed_at: stamp, reviewed_by: user.email, review_note: trimmed }; break;
        case "reject": patch = { status: "rejected", reviewed_at: stamp, reviewed_by: user.email, review_note: trimmed }; break;
        case "unpublish": patch = { status: rec.status === "published" ? "approved" : rec.status }; unpublished = true; break;
        case "archive": patch = { status: "archived" }; unpublished = !!live; break;
        case "restore": patch = { status: "draft" }; break;
        case "delete": patch = { deleted_at: stamp, deleted_by: user.email }; unpublished = !!live; break;
        case "undelete": patch = { deleted_at: "", deleted_by: "" }; break;
        default: throw new HttpError(404, "Unknown action.", "not_found");
      }
      // Take the live copy down first: if that fails, the record is left unchanged.
      if (unpublished && liveRow) {
        await store.update("published", liveRow.id, { ...liveRow, state: "unpublished", write_id: randomId("w", 6) }, { expectWriteId: liveRow.write_id });
      }
      const saved = await write(user, collection, rec, patch, action, { requestId });
      const result = view(user, collection, saved, unpublished ? null : live);
      if (unpublished) result.deploy = await onPublicChange(`${action} ${collection}/${id}`);
      return result;
    },

    async publish(user, collection, id, { version } = {}, { requestId } = {}) {
      if (!isAdmin(user.role)) throw new HttpError(403, "Only admins can publish.", "forbidden");
      const { rec, liveRow } = await load(collection, id);
      checkVersion(rec, version);
      if (rec.deleted_at) throw new HttpError(409, "Deleted items cannot be published.", "deleted");
      if (rec.status !== "approved") throw new HttpError(409, "Only approved content can be published. Approve this version first.", "not_approved");
      const errors = await validateAll(collection, rec, { strict: true });
      if (collection === "testimonials") { const p = testimonialPublishable(rec); if (p.length) errors.consent_status = p.join(" "); }
      if (hasSlug(collection)) {
        const pub = await store.list("published");
        const taken = pub.filter((p) => p.collection === collection && p.state === "live" && p.record_id !== id).map((p) => p.slug);
        if (taken.includes(rec.slug)) errors.slug = `The address ${publicPath(collection, rec.slug)} is already live for another item.`;
      }
      if (Object.keys(errors).length) fail422(errors, "This item cannot be published until the highlighted fields are fixed.");

      const newVersion = Number(rec.version) + 1;
      const stamp = now();
      const previous = new Set(String(rec.previous_slugs || "").split(",").map((s) => s.trim()).filter(Boolean));
      if (liveRow?.state === "live" && liveRow.slug && liveRow.slug !== rec.slug) previous.add(liveRow.slug);
      previous.delete(rec.slug);
      const previousSlugs = [...previous].join(", ");
      const payload = toPublic(collection, { ...rec, previous_slugs: previousSlugs, version: newVersion }, { iframeHosts: cfg.iframeHosts });
      payload.published_at = stamp;

      // Step 2: the live copy. Failure here changes nothing.
      const row = { id: `${collection}:${id}`, record_id: id, collection, slug: rec.slug || "", version: newVersion, state: "live", published_at: stamp, published_by: user.email, write_id: randomId("w", 6), payload };
      if (liveRow) await store.update("published", row.id, row, { expectWriteId: liveRow.write_id });
      else await store.insert("published", row);

      // Step 3: mark the working copy as published.
      let saved, warning = null;
      try {
        saved = await store.update(collection, id, {
          ...rec, status: "published", version: newVersion, write_id: randomId("w", 6), updated_at: stamp, updated_by: user.email,
          published_at: stamp, published_by: user.email, published_version: newVersion, published_slug: rec.slug || "", previous_slugs: previousSlugs,
        }, { expectWriteId: rec.write_id });
      } catch (e) {
        warning = `The item is live on the website, but its status could not be updated (${e.message}). Use “Finish publishing” to complete it.`;
        saved = rec;
      }
      await log.snapshot(user, collection, saved, "publish");
      await log.log(user, "publish", collection, id, newVersion, previousSlugs ? `Redirects from: ${previousSlugs}` : "", requestId);
      const result = view(user, collection, saved, row);
      result.deploy = await onPublicChange(`publish ${collection}/${id}`);
      if (warning) result.warning = warning;
      return result;
    },

    // Completes a publish whose second step failed (live copy newer than the record says).
    async reconcile(user, collection, id, { requestId } = {}) {
      if (!isAdmin(user.role)) throw new HttpError(403, "Only admins can repair publishing.", "forbidden");
      const { rec, live } = await load(collection, id);
      if (!live || Number(rec.published_version || 0) >= Number(live.version)) return { ...view(user, collection, rec, live), unchanged: true };
      const contentUnchanged = Number(rec.version) === Number(live.version) - 1 && rec.status === "approved";
      const patch = { published_version: live.version, published_at: live.published_at, published_by: live.published_by, published_slug: live.slug, previous_slugs: (live.payload?.previous_slugs || []).join(", ") };
      if (contentUnchanged) patch.status = "published";
      const next = { ...rec, ...patch, version: contentUnchanged ? Number(live.version) : Number(rec.version) + 1, write_id: randomId("w", 6), updated_at: now(), updated_by: user.email };
      const saved = await store.update(collection, id, next, { expectWriteId: rec.write_id });
      await log.snapshot(user, collection, saved, "reconcile");
      await log.log(user, "reconcile", collection, id, saved.version, contentUnchanged ? "Marked as published" : "Recorded live version; draft changes kept", requestId);
      return view(user, collection, saved, live);
    },

    async history(user, collection, id) {
      const { rec } = await load(collection, id);
      if (!canView(user, collection, rec)) throw new HttpError(403, "You do not have access to this item.", "forbidden");
      const rows = (await store.list("history")).filter((h) => h.record_id === id && h.collection === collection);
      return rows.sort((a, b) => String(b.at).localeCompare(String(a.at))).map((h) => ({ id: h.id, version: h.version, kind: h.kind, status: h.status, at: h.at, by: h.by }));
    },

    // Copies an earlier version's content into the working copy as a new draft (admins).
    async restoreVersion(user, collection, id, historyId, { version } = {}, { requestId } = {}) {
      if (!isAdmin(user.role)) throw new HttpError(403, "Only admins can restore earlier versions.", "forbidden");
      const h = (await store.list("history")).find((x) => x.id === historyId && x.record_id === id);
      if (!h?.data) throw new HttpError(404, "That version was not found.", "not_found");
      const { rec } = await load(collection, id);
      if (rec.deleted_at) throw new HttpError(409, "Restore the deleted item first (Recovery).", "deleted");
      if (rec.status === "archived") throw new HttpError(409, "Restore the archived item to draft first.", "archived");
      const data = Object.fromEntries(COLLECTIONS[collection].fields.map((fd) => [fd.key, h.data[fd.key]]));
      const out = await this.save(user, collection, id, { version, data, confirmSlugChange: true }, { requestId });
      await log.log(user, "restore_version", collection, id, out.record.version, `From version ${h.version} (${h.at})`, requestId);
      return out;
    },

    async dashboard(user) {
      const t = await store.listMany([...CONTENT_COLLECTIONS, "published"], { fresh: false });
      const today = now().slice(0, 10);
      const counts = {}, review = [], mine = [], overdue = [], repair = [], consent = [];
      const liveIds = new Map(t.published.filter((p) => p.state === "live").map((p) => [`${p.collection}:${p.record_id}`, p]));
      for (const c of CONTENT_COLLECTIONS) {
        counts[c] = {};
        for (const r of t[c]) {
          if (r.deleted_at) continue;
          counts[c][r.status] = (counts[c][r.status] || 0) + 1;
          const item = { collection: c, id: r.id, label: labelOf(c, r), status: r.status, updated_at: r.updated_at, updated_by: r.updated_by, review_note: r.review_note };
          if (r.status === "in_review") review.push(item);
          const mineItem = (r.authors || []).includes(user.email) || r.created_by === user.email || r.updated_by === user.email;
          if (canEdit(user, c, r) && ["draft", "changes_requested", "needed"].includes(r.status) && mineItem) mine.push(item);
          if (r.review_date && r.review_date < today && !["archived", "rejected"].includes(r.status)) overdue.push({ ...item, review_date: r.review_date });
          const l = liveIds.get(`${c}:${r.id}`);
          if (l && Number(r.published_version || 0) < Number(l.version)) repair.push(item);
          if (c === "testimonials" && !["archived", "rejected"].includes(r.status) && testimonialPublishable(r).length) consent.push(item);
        }
        counts[c].live = [...liveIds.keys()].filter((k) => k.startsWith(`${c}:`)).length;
      }
      const recent = isAdmin(user.role)
        ? (await store.list("audit_log")).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12)
        : [];
      return { counts, review, mine: mine.slice(0, 20), overdue: overdue.slice(0, 20), repair, consent: consent.length, recent };
    },
  };
}
