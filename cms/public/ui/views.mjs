// Dashboard, content lists and admin screens (tags, users, activity, recovery).
import { h, clear, api, toast, dialog, busy, errorText, statusBadge, hiddenBadge, when, who, roleLabel, icon, skeleton } from "./dom.mjs";
import { COLLECTIONS, CONTENT_COLLECTIONS, STATUSES, ROLES, isSuperAdmin } from "/shared/schema.mjs";
import { assetUrl } from "./fields.mjs";
import { historyKind, actionConfirm } from "./editor.mjs";
import { ACTIONS } from "/shared/workflow.mjs";

// Activity rows: content steps in plain words (steps of the retired workflow shown generically);
// account and settings actions (sign_in, user_save…) as recorded.
const CONTENT_ACTIONS = new Set(["create", "save", "publish", "unpublish", "archive", "restore", "delete", "undelete", "reconcile", "restore_version", "submit", "withdraw", "approve", "request_changes", "reject"]);
const actionLabel = (a) => (CONTENT_ACTIONS.has(a) ? historyKind(a) : a);
import { selectBox, toggle } from "./controls.mjs";

const pageHead = (title, sub, ...actions) => h("div", { class: "page-head" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null), actions.length ? h("div", { class: "row" }, actions) : null);
const link = (collection, id, label) => h("a", { href: `#/c/${collection}/${encodeURIComponent(id)}` }, label);

/* ---- Dashboard ---- */
export async function dashboardView(app) {
  const d = await api("GET", "/api/dashboard");
  const admin = isSuperAdmin(app.user.role);
  const alerts = [];
  if (d.repair.length) alerts.push(h("div", { class: "alert alert--error" }, h("div", {}, h("p", {}, h("strong", {}, "Publishing needs attention. "), `${d.repair.length} item(s) are live but their status was not updated: `), d.repair.map((r) => [link(r.collection, r.id, r.label), " "]))));
  const icons = { programs: "book", events: "calendar", resources: "file", testimonials: "quote" };
  const stats = CONTENT_COLLECTIONS.map((c) => {
    const n = d.counts[c] || {};
    const total = Object.entries(n).filter(([k]) => k !== "live").reduce((a, [, v]) => a + v, 0);
    return h("a", { class: "card stat", href: `#/c/${c}` }, h("h3", { class: "row" }, icon(icons[c]), COLLECTIONS[c].label), h("p", { class: "num" }, String(total)),
      h("div", { class: "row" }, n.published ? h("span", { class: "badge badge--green" }, `${n.published} published`) : null, n.hidden ? h("span", { class: "badge badge--yellow" }, `${n.hidden} hidden`) : null, n.draft ? h("span", { class: "badge badge--stone" }, `${n.draft} draft`) : null));
  });
  const itemList = (items, empty) => items.length
    ? h("ul", { class: "list" }, items.map((r) => h("li", {}, statusBadge(r.status), h("div", {}, link(r.collection, r.id, r.label), h("div", { class: "small muted" }, `${COLLECTIONS[r.collection].singular} · ${when(r.updated_at)} by ${who(r.updated_by)}`)))))
    : h("p", { class: "muted" }, empty);
  const hour = new Date().getHours();
  return h("div", {},
    pageHead(`${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${app.user.name.split(" ")[0] || ""}`.replace(/, $/, ""), `Signed in as ${roleLabel(app.user.role)}.`,
      admin && app.config.deployHook ? h("button", { class: "btn btn--light", type: "button", onclick: (e) => busy(e.currentTarget, async () => { try { const r = await api("POST", "/api/deploy", {}); toast(r.triggered ? "Website rebuild started." : r.error || r.reason, r.triggered ? "ok" : "error"); } catch (err) { toast(errorText(err), "error"); } }) }, icon("rocket"), "Rebuild website") : null),
    alerts,
    h("div", { class: "grid grid--4", style: "margin-bottom:16px" }, stats),
    h("div", { class: "card" }, h("h2", {}, admin ? "Drafts" : "Your drafts"), h("p", { class: "small muted" }, "Saved but not on the website yet. Open one and press Publish when it is ready."),
      itemList(d.mine, "No drafts. Use “New” on any content type to start.")),
    d.recent.length ? h("div", { class: "card", style: "margin-top:16px" }, h("h2", {}, admin ? "Recent activity" : "Your recent activity"),
      h("ul", { class: "list" }, d.recent.map((a) => h("li", {}, h("span", { class: "small muted", style: "min-width:120px" }, actionLabel(a.action)), h("span", {}, a.record_id && COLLECTIONS[a.collection] ? link(a.collection, a.record_id, `${COLLECTIONS[a.collection].singular} ${a.record_id}`) : a.detail), h("span", { class: "spacer" }), h("span", { class: "small muted" }, `${who(a.actor)} · ${when(a.at)}`)))),
      admin ? h("p", { style: "margin:10px 0 0" }, h("a", { class: "icon-link", href: "#/activity" }, "All activity", icon("right"))) : null) : null);
}

/* ---- Content list ---- */
export async function listView(app, { collection }) {
  const C = COLLECTIONS[collection];
  const tags = await api("GET", "/api/tags").catch(() => []);
  const q = h("input", { class: "input", type: "search", placeholder: `Search ${C.label.toLowerCase()}…`, "aria-label": "Search" });
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const status = selectBox({ label: "Filter by status", value: params.get("status") || "", onChange: () => load(), options: [{ value: "", label: "All statuses" }, ...(C.fields.some((fd) => fd.key === "visible") ? [{ value: "hidden", label: "Hidden from the website" }] : []), ...Object.entries(STATUSES).map(([k, s]) => ({ value: k, label: s.label }))] });
  const tagged = C.fields.some((fd) => fd.type === "tags");
  const tag = selectBox({ label: "Filter by tag", value: params.get("tag") || "", searchable: true, onChange: () => load(), options: [{ value: "", label: "All tags" }, ...tags.filter((t) => !t.archived).map((t) => ({ value: t.id, label: t.label }))] });
  const body = h("div", { class: "list-body" }, skeleton("table"));
  q.value = params.get("q") || "";
  let timer;
  async function load() {
    const qs = new URLSearchParams(Object.entries({ q: q.value, status: status.get(), tag: tagged ? tag.get() : "" }).filter(([, v]) => v));
    history.replaceState(null, "", `#/c/${collection}${qs.toString() ? `?${qs}` : ""}`);
    body.setAttribute("aria-busy", "true");
    try {
      const rows = await api("GET", `/api/records/${collection}?${qs}`);
      clear(body, rows.length ? h("div", { class: "table-wrap" }, h("table", { class: "table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Title"), h("th", {}, "Status"), h("th", {}, "Authors"), h("th", {}, "Last saved"), h("th", {}, h("span", { class: "sr-only" }, "Actions")))),
        h("tbody", {}, rows.map((r) => {
          const tr = h("tr", { onclick: (e) => { if (!e.target.closest("a, .menu-wrap")) location.hash = `#/c/${collection}/${encodeURIComponent(r.id)}`; } },
            h("td", { class: "title" }, h("div", { class: "row", style: "gap:10px;flex-wrap:nowrap" }, thumb(r), h("div", {}, link(collection, r.id, r.label || "(untitled)"), r.can_edit || r.status === "archived" ? null : h("span", { class: "badge badge--stone", title: "Only its authors and Super Admins can change this item" }, "View only"), subline(r), tagged && (r.tags || []).length ? h("div", {}, r.tags.map((t) => h("span", { class: "tag" }, tags.find((x) => x.id === t)?.label || t))) : null))),
            h("td", {}, h("div", { class: "row", style: "gap:6px" }, statusBadge(r.status), r.needs_repair ? h("span", { class: "badge badge--red" }, "Needs repair") : hiddenBadge(r.live))),
            h("td", { class: "small" }, r.byline || r.content_owner || h("span", { class: "muted" }, "—")),
            h("td", { class: "small muted" }, `${when(r.updated_at)} · ${who(r.updated_by)}`),
            h("td", { class: "row-actions" }, itemMenu(r)));
          return tr;
        }))))
        : h("div", { class: "card empty" }, h("h3", {}, q.value || status.get() || tag.get() ? "Nothing matches these filters" : `No ${C.label.toLowerCase()} yet`), h("p", {}, q.value || status.get() || tag.get() ? "Try clearing the search or filters." : `Create the first ${C.singular.toLowerCase()} with the New button.`)));
    } catch (e) { clear(body, h("div", { class: "alert alert--error" }, h("div", {}, errorText(e)))); }
    body.removeAttribute("aria-busy");
  }
  // The three-dot menu on each row: the actions the server allows for this item now (r.actions),
  // plus Edit and Preview. Publish, Unpublish, Archive and Delete ask first, as in the editor.
  const previewable = C.route !== null || collection === "testimonials";
  const ROW_ACTIONS = ["publish", "unpublish", "archive", "restore", "delete"];
  function itemMenu(r) {
    const href = `#/c/${collection}/${encodeURIComponent(r.id)}`;
    const items = [
      [r.can_edit ? "Edit" : "Open", () => { location.hash = href; }],
      previewable ? ["Preview", () => { location.hash = `${href}?preview`; }] : null,
      ...ROW_ACTIONS.filter((a) => (r.actions || []).includes(a)).map((a) => [ACTIONS[a].label, () => rowAction(r, a), ["unpublish", "archive", "delete"].includes(a)]),
    ].filter(Boolean);
    const toggle = h("button", { class: "btn btn--ghost btn--sm row-menu", type: "button", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": `Actions for ${r.label || "this item"}`, title: "Actions" }, icon("dots"));
    const pop = h("div", { class: "menu-pop menu-pop--fixed", hidden: true, role: "menu" }, items.map(([label, run, danger]) =>
      h("button", { type: "button", role: "menuitem", class: danger ? "danger" : "", onclick: () => { close(); run(); } }, label)));
    const outside = (e) => { if (!toggle.contains(e.target) && !pop.contains(e.target)) close(); };
    const key = (e) => { if (e.key === "Escape") { close(); toggle.focus(); } };
    function close() {
      if (pop.hidden) return;
      pop.hidden = true; toggle.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", outside, true); document.removeEventListener("keydown", key); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); document.removeEventListener("cms:menu", close);
    }
    function open() {
      document.dispatchEvent(new CustomEvent("cms:menu")); // one item menu open at a time
      pop.hidden = false; toggle.setAttribute("aria-expanded", "true");
      // Fixed to the viewport, so the table's scroll box never clips it; opens upwards near the bottom.
      const b = toggle.getBoundingClientRect(), m = pop.getBoundingClientRect();
      pop.style.left = `${Math.max(8, b.right - m.width)}px`;
      pop.style.top = `${b.bottom + 6 + m.height > innerHeight ? Math.max(8, b.top - 6 - m.height) : b.bottom + 6}px`;
      document.addEventListener("click", outside, true); document.addEventListener("keydown", key); window.addEventListener("scroll", close, true); window.addEventListener("resize", close);
      document.addEventListener("cms:menu", close, { once: true });
      pop.querySelector("button")?.focus();
    }
    toggle.addEventListener("click", () => (pop.hidden ? open() : close()));
    return h("div", { class: "menu-wrap" }, toggle, pop);
  }
  async function rowAction(r, action) {
    const confirm = actionConfirm(action, { live: r.live, version: r.version });
    if (confirm && !(await dialog(confirm)).ok) return;
    try {
      const res = await api("POST", `/api/records/${collection}/${encodeURIComponent(r.id)}/actions/${action}`, { version: r.version });
      if (res.warning) toast(res.warning, "warn", 0);
      else toast(`${ACTIONS[action].label}: done.`, "ok");
      if (res.deploy) toast(res.deploy.triggered ? "Website rebuild started. Changes appear in a few minutes." : res.deploy.error || res.deploy.reason, res.deploy.error ? "error" : "info", 8000);
      app.refreshCounts();
    } catch (e) {
      // Publishing checks every required field: the editor shows which ones need fixing.
      toast(e.status === 422 ? `${errorText(e)} Open the item to see which fields.` : errorText(e), "error");
    }
    load();
  }
  // Testimonials: the photo (or a plain Faith Pink disc) beside the name, and the role under it.
  // Events: the date. Card colours are not stored: the website picks them by position.
  function thumb(r) {
    if (collection !== "testimonials") return null;
    const swatch = "#f7e5e6";
    const url = assetUrl(r.featured_image_url, app.config);
    if (!url) return h("span", { class: "thumb", style: `background:${swatch}`, "aria-hidden": "true" });
    const im = h("img", { class: "thumb", src: url, alt: "" });
    im.addEventListener("error", () => im.replaceWith(h("span", { class: "thumb", style: `background:${swatch}`, "aria-hidden": "true" })));
    return im;
  }
  function subline(r) {
    if (collection === "testimonials") return r.role ? h("small", {}, r.role) : null;
    if (collection === "events") return h("small", {}, r.event_date || "No date yet", r.event_page || r.registration_type === "page" ? ` · page ${C.route.replace("{slug}", r.slug)}` : "");
    return r.slug ? h("small", {}, C.route ? C.route.replace("{slug}", r.slug) : r.slug) : null;
  }
  q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  load();
  return h("div", {}, pageHead(C.label, C.description, h("a", { class: "btn", href: `#/c/${collection}/new` }, icon("plus"), `New ${C.singular.toLowerCase()}`)),
    h("div", { class: "filters" }, q, status.el, tagged ? tag.el : null), body);
}

/* ---- Tags ---- */
export async function tagsView(app) {
  const body = h("div", {});
  async function load() {
    const tags = await api("GET", "/api/tags");
    clear(body, h("div", { class: "table-wrap" }, h("table", { class: "table" }, h("thead", {}, h("tr", {}, h("th", {}, "Tag"), h("th", {}, "ID"), h("th", {}, "Description"), h("th", {}, ""))),
      h("tbody", {}, tags.map((t) => h("tr", { style: "cursor:default" }, h("td", {}, h("span", { class: "tag" }, t.label), t.archived ? h("span", { class: "badge badge--stone" }, "Archived") : null), h("td", { class: "mono small" }, t.id), h("td", { class: "small" }, t.description || ""),
        h("td", {}, h("div", { class: "row" },
          h("button", { class: "btn btn--light btn--sm", type: "button", onclick: () => edit(t) }, "Rename"),
          h("button", { class: "btn btn--ghost btn--sm", type: "button", onclick: (e) => busy(e.currentTarget, () => save({ ...t, archived: !t.archived })) }, t.archived ? "Restore" : "Archive")))))))));
  }
  async function save(t) { try { await api(t.id ? "PUT" : "POST", t.id ? `/api/tags/${encodeURIComponent(t.id)}` : "/api/tags", t); toast("Tag saved.", "ok"); load(); } catch (e) { toast(errorText(e), "error"); } }
  async function edit(t) { const r = await dialog({ title: t ? "Rename tag" : "New tag", note: { label: "Tag name", required: true }, confirm: "Save" }); if (r.ok) save({ ...(t || {}), label: r.value }); }
  await load();
  return h("div", {}, pageHead("Tags", "Reusable labels for filtering content. Tags are separate from workflow status. Archived tags stay on existing items but cannot be added.", h("button", { class: "btn", type: "button", onclick: () => edit(null) }, icon("plus"), "New tag")), body);
}

/* ---- Users (Super Admin) ---- */
export async function usersView(app) {
  const body = h("div", {});
  async function load() {
    const users = await api("GET", "/api/users");
    const review = users.filter((u) => u.needs_review);
    clear(body,
      review.length ? h("div", { class: "alert alert--warn", style: "margin-bottom:16px" }, h("div", {}, h("p", {}, h("strong", {}, `${review.length} account(s) need a role. `),
        "They were saved with a role this CMS does not have, so they cannot sign in until you choose Super Admin or Author for them."))) : null,
      h("div", { class: "table-wrap" }, h("table", { class: "table" }, h("thead", {}, h("tr", {}, h("th", {}, "Person"), h("th", {}, "Role"), h("th", {}, "Access"), h("th", {}, ""))),
        h("tbody", {}, users.map((u) => h("tr", { style: "cursor:default" },
          h("td", {}, h("b", {}, u.name || u.email), h("div", { class: "small muted" }, u.email)),
          h("td", {}, roleLabel(u.role), u.pinned ? h("div", { class: "small muted" }, "Set in deployment settings") : null,
            u.needs_review ? h("div", {}, h("span", { class: "badge badge--yellow", style: "white-space:normal", title: "Choose a current role for this account" }, `Review: was ${u.stored_role}`)) : null),
          h("td", {}, u.active ? h("span", { class: "badge badge--green" }, "Active") : h("span", { class: "badge badge--stone" }, "No access")),
          h("td", {}, u.pinned || u.email === app.user.email ? null : h("button", { class: "btn btn--light btn--sm", type: "button", onclick: () => edit(u) }, "Change"))))))),
      h("div", { class: "card", style: "margin-top:16px" }, h("h2", {}, "Roles"), h("dl", { class: "kv" }, Object.values(ROLES).map((r) => [h("dt", {}, r.label), h("dd", {}, r.help)])),
        h("p", { class: "small muted", style: "margin-top:12px" }, "People sign in with their Google account; the CMS never stores passwords. Removing access takes effect within a minute.")));
  }
  async function edit(u) {
    const email = h("input", { class: "input", type: "email", value: u?.email || "", disabled: !!u, required: true, id: "u-email" });
    const name = h("input", { class: "input", type: "text", value: u?.name || "", id: "u-name" });
    const role = selectBox({ id: "u-role", value: u?.role || "author", options: Object.entries(ROLES).map(([k, r]) => ({ value: k, label: r.label, note: r.help })) });
    const active = toggle({ checked: u ? u.active : true, label: "Can sign in" });
    const r = await dialog({ title: u ? `Change access for ${u.email}` : "Add a person", confirm: "Save", content: h("div", {},
      h("div", { class: "field" }, h("label", { for: "u-email" }, "Google account email"), email),
      h("div", { class: "field" }, h("label", { for: "u-name" }, "Name"), name),
      h("div", { class: "field" }, h("label", { for: "u-role" }, "Role"), role.el),
      h("div", { class: "field" }, active.el)) });
    if (!r.ok) return;
    if (role.get() === "super_admin" && u?.role !== "super_admin" && !(await dialog({ title: "Make this person a Super Admin?", body: "Super Admins can manage users and roles, site settings, tags, recovery and backup, and edit, publish or delete any content.", confirm: "Make Super Admin" })).ok) return;
    try { await api("POST", "/api/users", { email: email.value, name: name.value, role: role.get(), active: active.get(), version: u?.version }); toast("Saved.", "ok"); load(); } catch (e) { toast(errorText(e), "error"); }
  }
  await load();
  return h("div", {}, pageHead("Users and roles", "Who can sign in to the CMS, and what they can do.", h("button", { class: "btn", type: "button", onclick: () => edit(null) }, icon("plus"), "Add a person")), body);
}

/* ---- Activity (Super Admin) ---- */
export async function activityView() {
  const rows = await api("GET", "/api/audit");
  return h("div", {}, pageHead("Activity log", "Who did what, and when. Kept in the CMS audit log."),
    h("div", { class: "table-wrap" }, h("table", { class: "table" }, h("thead", {}, h("tr", {}, h("th", {}, "When"), h("th", {}, "Who"), h("th", {}, "Action"), h("th", {}, "Item"), h("th", {}, "Details"))),
      h("tbody", {}, rows.map((a) => h("tr", { style: "cursor:default" }, h("td", { class: "small" }, new Date(a.at).toLocaleString()), h("td", { class: "small" }, a.actor, h("div", { class: "muted" }, roleLabel(a.role))), h("td", { class: "small" }, actionLabel(a.action)),
        h("td", { class: "small" }, a.record_id && COLLECTIONS[a.collection] ? link(a.collection, a.record_id, `${COLLECTIONS[a.collection].singular} · ${a.record_id}`) : a.record_id || ""), h("td", { class: "small" }, a.version ? `v${a.version} ` : "", a.detail)))))));
}

/* ---- Recovery (Super Admin) ---- */
export async function recoveryView(app) {
  const r = await api("GET", "/api/recovery");
  const download = h("button", { class: "btn", type: "button", onclick: (e) => busy(e.currentTarget, async () => {
    try {
      const res = await fetch("/api/backup", { credentials: "same-origin" });
      if (!res.ok) throw new Error((await res.json()).error?.message || "Backup failed.");
      const blob = await res.blob();
      const a = h("a", { href: URL.createObjectURL(blob), download: `faithworks-cms-backup-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a); a.click(); a.remove();
      toast("Backup downloaded. Store it somewhere safe (it contains every record).", "ok");
    } catch (err) { toast(errorText(err), "error"); }
  }) }, "Download a full backup (JSON)");
  const section = (title, items, render, empty) => h("div", { class: "card" }, h("h2", {}, title), items.length ? h("ul", { class: "list" }, items.map(render)) : h("p", { class: "muted" }, empty));
  return h("div", {}, pageHead("Recovery and backup", `${r.live} item(s) are live on the website.`, download),
    h("div", { class: "alert alert--info" }, h("div", {}, h("p", {}, "Every item keeps a full version history (open an item → History). Deleted items stay recoverable here. For a complete restore of the spreadsheet, follow the backup and restore steps in the CMS guide (cms/README.md)."))),
    section("Publishing that did not finish", r.repair, (x) => h("li", {}, h("span", { class: "badge badge--red" }, "Needs repair"), link(x.collection, x.id, x.label), h("span", { class: "small muted" }, `live v${x.live_version}`)), "Nothing to repair."),
    section("Deleted items", r.deleted, (x) => h("li", {}, link(x.collection, x.id, x.label), h("span", { class: "small muted" }, `${COLLECTIONS[x.collection].singular} · deleted ${when(x.deleted_at)} by ${who(x.deleted_by)}`), h("span", { class: "spacer" }),
      h("button", { class: "btn btn--light btn--sm", type: "button", onclick: (e) => busy(e.currentTarget, async () => { try { await api("POST", `/api/records/${x.collection}/${encodeURIComponent(x.id)}/actions/undelete`, { version: x.version }); toast("Restored.", "ok"); app.reload(); } catch (err) { toast(errorText(err), "error"); } }) }, "Restore")), "No deleted items."),
    r.orphans.length ? section("Live copies without a record", r.orphans, (x) => h("li", {}, h("span", { class: "mono small" }, x.key), h("span", { class: "small muted" }, `slug ${x.slug} · v${x.version}`)), "") : null);
}
