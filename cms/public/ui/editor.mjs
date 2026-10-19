// Record editor: Details (essential metadata), the page editor (HTML / Visual), History,
// publishing actions and the full-page preview. Success is only shown after the server confirms.
//
// Details and the page are kept consistent through explicit markers (shared/page-doc.mjs):
// Details values are written into marked elements of the page, and the marked title and
// summary write back to Details when they are edited in the page.
import { h, clear, api, toast, dialog, busy, errorText, statusBadge, liveBadge, when, who, icon, ApiError } from "./dom.mjs";
import { renderField, computedField } from "./fields.mjs";
import { createHtmlEditor } from "./html-editor.mjs";
import { COLLECTIONS, STATUSES, blankRecord, isSuperAdmin, eventHasPage, statusOf } from "/shared/schema.mjs";
import { ACTIONS } from "/shared/workflow.mjs";
import { BINDINGS, bindingValues, upgradeRecord, readingTime, eventDuration, bylineOf, DOC_VERSION } from "/shared/page-doc.mjs";
import { starterTemplate } from "/shared/starters.mjs";

// History rows name the step that saved each version. Steps of the retired workflow (older
// versions) are shown generically.
const KINDS = { create: "Created", save: "Saved", publish: "Published", unpublish: "Unpublished", archive: "Archived", restore: "Restored to draft", delete: "Deleted", undelete: "Restored", reconcile: "Finished publishing", restore_version: "Earlier version restored" };
export const historyKind = (k) => KINDS[k] || "Earlier workflow step";

export async function editorView(app, { collection, id }) {
  const C = COLLECTIONS[collection];
  const isNew = !id;
  const hasPage = C.fields.some((fd) => fd.type === "html");
  const TABS = [["details", "Details"], ...(hasPage ? [["page", C.page || "Page"]] : []), ["history", "History"]];
  const root = h("div", {}, h("p", { class: "loading" }, "Loading…"));
  let view = null, fields = new Map(), computed = {}, htmlEd = null, baseline = "", dirty = false, tab = "details", bindTimer, lastHtml = "";
  const ctx = { user: app.user, config: app.config, collection, tags: [], authors: [], onChange: (key) => fieldChanged(key), getTitle: () => fields.get("title")?.get() };

  const [tags, authors] = await Promise.all([
    api("GET", "/api/tags").catch(() => []),
    collection === "settings" ? Promise.resolve([]) : api("GET", "/api/authors").catch(() => []),
  ]);
  ctx.tags = tags; ctx.authors = authors;
  const authorNames = Object.fromEntries(authors.map((a) => [a.email, a.name]));

  if (isNew) {
    const start = hasPage ? starterTemplate(collection) : { html: "", css: "" };
    view = { record: { ...blankRecord(collection), status: "draft", version: 0, authors: collection === "settings" ? undefined : [app.user.email], body_html: start.html, body_css: start.css }, live: null, actions: [], can_edit: true, isNew: true };
  } else {
    view = await api("GET", `/api/records/${collection}/${encodeURIComponent(id)}`);
  }
  // Records saved before page documents: arrange them as one (same content, nothing saved yet).
  const upgrade = (v) => { if (hasPage) v.record = upgradeRecord(collection, v.record); return v; };
  upgrade(view);

  /* ---- Values ---- */
  function details() {
    const data = {};
    for (const [k, f] of fields) data[k] = f.get();
    return data;
  }
  // The record as it stands in the editor, for previews of Details values inside the page.
  function current() {
    const rec = { ...view.record, ...details(), body_html: lastHtml };
    rec.byline = bylineOf(rec, authorNames);
    return rec;
  }
  function collect() {
    const data = details();
    if (htmlEd) {
      const v = htmlEd.getValue();
      data.body_html = v.html; data.body_css = v.css;
      if (C.fields.some((fd) => fd.key === "page_layout")) data.page_layout = v.layout;
      lastHtml = v.html;
    }
    if (C.fields.some((fd) => fd.key === "doc_version")) data.doc_version = DOC_VERSION;
    for (const fd of C.fields) if (fd.hidden && !fd.legacy && !fd.computed && !(fd.key in data)) data[fd.key] = view.record[fd.key] ?? null;
    return data;
  }
  const snapshot = () => JSON.stringify(collect());
  function markDirty() {
    queueMicrotask(() => {
      const now = htmlEd?.hasVisualChanges() ? "visual" : snapshot();
      dirty = now === "visual" || now !== baseline;
      root.querySelectorAll("[data-dirty]").forEach((n) => { n.hidden = !dirty; });
      const save = root.querySelector("[data-save]");
      if (save) save.disabled = !dirty && !isNew;
    });
  }
  function fieldChanged(key) {
    markDirty();
    updateVisibility();
    updateComputed();
    if (key === "title") {
      const t = fields.get("title")?.get();
      const h1 = root.querySelector(".editor-head h1"); if (h1 && t) h1.textContent = t;
      // New items: the address follows the title (typed in Details or in the page) until edited
      if (isNew && !ctx.slugTouched && fields.get("slug")) { fields.get("slug").set(slugFrom(t)); ctx.updateSlugPreview?.(); }
    }
    clearTimeout(bindTimer);
    bindTimer = setTimeout(() => htmlEd?.refreshBindings(), 120); // Details → page
  }
  // Fields that apply only in some cases (e.g. a destination URL for downloads, not articles)
  function updateVisibility() {
    const rec = { ...view.record, ...details() };
    for (const fd of C.fields) {
      if (!fd.showIf) continue;
      const f = fields.get(fd.key) || computed[fd.key];
      if (f) f.el.hidden = !fd.showIf(rec);
    }
    root.querySelectorAll("fieldset.card").forEach((card) => { card.hidden = ![...card.querySelectorAll(":scope > .field")].some((x) => !x.hidden); });
    // Events: the Event page tab is there only when the event has its own page
    if (collection === "events") {
      const on = eventHasPage(rec);
      const btn = root.querySelector('[data-tab="page"]');
      if (btn) btn.hidden = !on;
      if (!on && tab === "page") showTab("details");
    }
  }
  function updateComputed() {
    const rec = current();
    if (computed.read_time) computed.read_time.set(readingTime(rec.body_html), "Calculated once the article has text");
    if (computed.duration) computed.duration.set(eventDuration(rec), "Add a start and end (date and time) to calculate it");
    if (computed.byline) computed.byline.set(rec.byline, "No authors selected");
  }

  /* ---- Layout ---- */
  function render() {
    const rec = view.record;
    const readOnly = !view.can_edit;
    ctx.readOnly = readOnly;
    ctx.liveSlug = view.live?.slug || "";
    fields = new Map(); computed = {};
    htmlEd = null;
    lastHtml = rec.body_html || "";

    const panels = Object.fromEntries(TABS.map(([k]) => [k, h("div", { role: "tabpanel", id: `tab-${k}`, "aria-labelledby": `tabbtn-${k}`, hidden: k !== tab })]));
    const groups = new Map();
    const groupCard = (g) => {
      if (!groups.has(g)) {
        const card = h("fieldset", { class: "card" }, h("legend", { class: "section-title" }, C.groups?.[g] || g));
        groups.set(g, card);
        panels.details.append(card);
      }
      return groups.get(g);
    };
    for (const fd of C.fields) {
      if (fd.type === "html") {
        htmlEd = createHtmlEditor({
          html: rec.body_html || "", css: rec.body_css || "", layout: rec.page_layout || "site", collection, config: app.config, readOnly, onChange: () => { markDirty(); lastHtml = htmlEd?.peekHtml() ?? lastHtml; updateComputed(); },
          values: () => {
            // An empty title or summary leaves the page text alone (e.g. the template’s example
            // heading on a new page); every other Details value is always written in.
            const v = bindingValues(collection, current(), { authorNames });
            for (const [k, b] of Object.entries(BINDINGS)) if (b.twoWay && !String(v.text[k] || "").trim()) delete v.text[k];
            return v;
          },
          record: current,
          headInfo: () => { const d = details(); return { title: d.seo_title || `${d.title || d.display_name || ""} · Faith Works`, description: d.meta_description || d.summary || "" }; },
          onBoundEdit: (key, text) => { const f = fields.get(BINDINGS[key]?.field); if (f && f.get() !== text) { f.set(text); fieldChanged(BINDINGS[key].field); } },
          onHeadEdit: ({ title, description }) => {
            const d = details();
            if (title !== null && fields.get("seo_title") && title !== (d.seo_title || `${d.title} · Faith Works`)) { fields.get("seo_title").set(title === `${d.title} · Faith Works` ? "" : title); markDirty(); }
            if (description !== null && fields.get("meta_description") && description !== (d.meta_description || d.summary || "")) { fields.get("meta_description").set(description === d.summary ? "" : description); markDirty(); }
          },
          onImportMeta: ({ title, description }) => {
            const seo = fields.get("seo_title"), meta = fields.get("meta_description");
            if (title && seo && !seo.get()) seo.set(title);
            if (description && meta && !meta.get()) meta.set(description);
            markDirty();
          },
          onGoToField: (key) => { showTab("details"); const f = fields.get(key); f?.el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => f?.focus(), 250); },
          onSetDetail: (key, value) => { const f = fields.get(key); if (f) { f.set(value); fieldChanged(key); } },
          starter: () => starterTemplate(collection),
        });
        panels.page.append(htmlEd.el);
        continue;
      }
      if (fd.hidden || fd.type === "css" || fd.type === "json") continue;
      if (fd.computed) {
        const c = computedField(fd.label, fd.help);
        computed[fd.key] = c;
        groupCard(fd.group || "main").append(c.el);
        continue;
      }
      const f = renderField(fd, rec[fd.key], ctx);
      fields.set(fd.key, f);
      groupCard(fd.group || "main").append(f.el);
      if (collection === "events" && fd.key === "end_time") {
        computed.duration = computedField("Duration", "Calculated from the start and end. It updates when they change.");
        groupCard("when").append(computed.duration.el);
      }
      if (fd.key === "authors") {
        computed.byline = computedField("Byline shown on the website", "Names only; email addresses are never published.");
        groupCard("publishing").append(computed.byline.el);
      }
    }
    const tabButtons = TABS.filter(([k]) => (k === "history" ? !isNew : true)).map(([k, label]) =>
      h("button", { type: "button", role: "tab", id: `tabbtn-${k}`, "aria-selected": String(k === tab), "aria-controls": `tab-${k}`, dataset: { tab: k }, onclick: () => showTab(k) }, label, h("span", { class: "err", hidden: true }, " •")));
    if (!tabButtons.some((b) => b.dataset.tab === tab)) tab = "details";
    if (!isNew) panels.history.append(h("p", { class: "loading" }, "Loading history…"));

    clear(root,
      head(rec, readOnly),
      banners(rec),
      h("div", { class: "editor-grid" },
        h("div", {}, h("div", { class: "tabs", role: "tablist", "aria-label": "Editor sections" }, tabButtons), Object.values(panels)),
        side(rec)));
    root.querySelector(".editor-grid").classList.toggle("is-wide", tab === "page");
    if (!isNew) loadHistory(panels.history);
    updateVisibility();
    updateComputed();
    baseline = snapshot();
    dirty = false;
    markDirty();
  }
  const slugFrom = (t) => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

  function showTab(k) {
    tab = k;
    root.querySelectorAll("[role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === k)));
    root.querySelectorAll("[role=tabpanel]").forEach((p) => { p.hidden = p.id !== `tab-${k}`; });
    root.querySelector(".editor-grid")?.classList.toggle("is-wide", k === "page"); // the page editor gets the full width
    if (k === "page") htmlEd?.show();
  }

  function head(rec, readOnly) {
    const label = rec[C.labelField] || rec.title || (isNew ? `New ${C.singular.toLowerCase()}` : rec.id);
    const save = h("button", { class: "btn", type: "button", "data-save": "", disabled: !isNew, onclick: (e) => busy(e.currentTarget, () => save_()) }, isNew ? "Create draft" : "Save draft");
    const buttons = [];
    if (C.route !== null || collection === "testimonials") buttons.push(h("button", { class: "btn btn--light", type: "button", "data-preview": "", onclick: (e) => openPreview(e.currentTarget) }, icon("eye"), "Preview"));
    if (!readOnly) buttons.push(save);
    // Super Admins, and Authors on their own items, publish in one step (save, then publish).
    // Also on published items: editing one and pressing Publish saves and publishes the change.
    const canPublish = !isNew && (view.actions.includes("publish") || (view.can_edit && rec.status === "published"));
    if (canPublish) buttons.push(h("button", { class: "btn btn--yellow", type: "button", onclick: (e) => busy(e.currentTarget, () => publishNow()) }, "Publish"));
    if (view.actions.includes("reconcile")) buttons.push(h("button", { class: "btn btn--light", type: "button", onclick: (e) => busy(e.currentTarget, () => act("reconcile")) }, "Finish publishing"));
    const more = view.actions.filter((a) => !["publish", "reconcile"].includes(a));
    if (more.length) {
      const pop = h("div", { class: "menu-pop", hidden: true, role: "menu" }, more.map((a) => h("button", { type: "button", role: "menuitem", class: ["delete", "archive", "unpublish"].includes(a) ? "danger" : "", onclick: () => { pop.hidden = true; act(a); } }, a === "undelete" ? "Restore deleted item" : ACTIONS[a].label)));
      const toggle = h("button", { class: "btn btn--light", type: "button", "aria-haspopup": "menu", onclick: () => { pop.hidden = !pop.hidden; } }, "More…");
      document.addEventListener("click", (e) => { if (!toggle.contains(e.target) && !pop.contains(e.target)) pop.hidden = true; });
      buttons.push(h("div", { class: "menu-wrap" }, toggle, pop));
    }
    return h("div", { class: "editor-head" },
      h("div", { class: "titlebox" },
        h("a", { class: "back", href: collection === "settings" ? "#/" : `#/c/${collection}` }, icon("left"), collection === "settings" ? "Dashboard" : C.label),
        h("h1", {}, label),
        h("div", { class: "meta" }, isNew ? h("span", {}, "Not saved yet") : [statusBadge(rec.status), liveBadge(view.live), h("span", {}, `Version ${rec.version}`), h("span", {}, `· saved ${when(rec.updated_at)} by ${who(rec.updated_by)}`)],
          h("span", { "data-dirty": "", hidden: true, class: "row", style: "gap:6px" }, h("span", { class: "dirty-dot" }), "Unsaved changes"))),
      h("div", { class: "row" }, buttons));
  }

  function banners(rec) {
    const out = [];
    if (view.needs_repair) out.push(h("div", { class: "alert alert--error" }, h("div", {}, h("p", {}, h("strong", {}, "Publishing did not finish. "), "The website already shows the new version, but this item's status was not updated. Use “Finish publishing”."))));
    if (rec.deleted_at) out.push(h("div", { class: "alert alert--error" }, h("div", {}, h("p", {}, h("strong", {}, "Deleted "), `${when(rec.deleted_at)} by ${who(rec.deleted_by)}. It is not on the website.`))));
    if (rec.upgraded && !isNew) out.push(h("div", { class: "alert alert--info" }, h("div", {}, h("p", {}, h("strong", {}, "Converted to the page editor. "), "Same content; nothing changes until you save and publish."))));
    if (view.live && view.draft_differs) out.push(h("div", { class: "alert alert--info" }, h("div", {}, h("p", {}, h("strong", {}, "This item is live. "), `The website shows version ${view.live.version}. Changes here are a new draft; publish them to replace the live version.`))));
    if (view.live?.hidden) out.push(h("div", { class: "alert alert--warn" }, h("div", {}, h("p", {}, h("strong", {}, "Hidden. "), "The published version has “Show on the website” turned off, so it is not on the website. Turn it on and press Publish to show it again."))));
    if (!view.can_edit && !rec.deleted_at) out.push(h("div", { class: "alert alert--info" }, h("div", {}, h("p", {}, rec.status === "archived" ? (view.actions.includes("restore") ? "Archived items cannot be edited. Use More… → Restore to draft to edit it again." : "Archived items cannot be edited. Its authors or a Super Admin can restore it to draft.") : "You can view this item but not edit it. Only its authors and Super Admins can change it."))));
    return out;
  }

  function side(rec) {
    const s = STATUSES[statusOf(rec.status)];
    const live = view.live;
    const siteUrl = (path) => `${app.config.siteOrigin || app.config.publicSiteUrl}${path}`;
    return h("aside", { class: "side" },
      h("div", { class: "card" },
        h("h3", {}, "Status"),
        h("p", {}, statusBadge(rec.status)),
        h("p", { class: "small muted" }, live?.hidden && rec.status === "published" ? "Published, with “Show on the website” turned off." : s?.help || ""),
        live && !live.hidden ? h("p", { class: "small" }, "Live on the website: version ", h("b", {}, String(live.version)), live.url ? [" · ", h("a", { class: "icon-link", href: siteUrl(live.url), target: "_blank", rel: "noopener" }, "View", icon("external"))] : null)
          : h("p", { class: "small muted" }, isNew ? "" : live ? `Published (version ${live.version}), but hidden from the website.` : "Not on the website."),
        isNew ? null : h("dl", { class: "kv" },
          h("dt", {}, "Created"), h("dd", {}, `${when(rec.created_at)} · ${who(rec.created_by)}`),
          h("dt", {}, "Last saved"), h("dd", {}, `${when(rec.updated_at)} · ${who(rec.updated_by)}`),
          live ? [h("dt", {}, "Published"), h("dd", {}, `${when(live.published_at)} · ${who(live.published_by)}`)] : null)),
      h("div", { class: "card" },
        h("h3", {}, "How publishing works"),
        h("ol", { class: "small muted", style: "padding-left:18px;margin:0" },
          h("li", {}, "Save your draft as often as you like. Every save is kept in History."),
          h("li", {}, "Press Publish to put it on the website. The website rebuilds within a few minutes."),
          ["events", "testimonials"].includes(collection) ? h("li", {}, "To take it off the website but keep it here, turn off “Show on the website” and press Publish.") : null,
          isSuperAdmin(app.user.role) ? null : h("li", {}, "You can publish, unpublish and archive the items you created or are listed on as an author. Other items are view only."))));
  }

  /* ---- Saving ---- */
  function showErrors(errors) {
    let firstTab = null;
    root.querySelectorAll("[role=tab] .err").forEach((n) => { n.hidden = true; });
    for (const [k, f] of fields) f.error(errors[k] || "");
    for (const k of Object.keys(errors)) {
      const f = fields.get(k);
      const panel = f?.el.closest("[role=tabpanel]") || (k.startsWith("body_") ? root.querySelector("#tab-page") : null);
      const t = panel?.id.replace("tab-", "");
      if (t) { root.querySelector(`[data-tab="${t}"] .err`)?.removeAttribute("hidden"); firstTab ||= t; }
    }
    if (firstTab) { showTab(firstTab); const first = Object.keys(errors).map((k) => fields.get(k)).find(Boolean); first?.focus(); }
    if (errors.body_html) toast(`Page: ${errors.body_html}`, "error");
  }
  function typingProblems() {
    const bad = [...fields.values()].filter((f) => f.hasTypingError());
    if (!bad.length) return false;
    showTab("details"); bad[0].focus();
    toast("A date or time could not be read. Use the calendar or a format like 16 Oct 2026 and 9:30 AM.", "error");
    return true;
  }

  async function save_({ quiet = false, confirmSlugChange = false } = {}) {
    if (typingProblems()) return null;
    const data = collect();
    try {
      if (isNew) {
        const created = await api("POST", `/api/records/${collection}`, { data });
        dirty = false;
        toast(`${C.singular} created as a draft.`, "ok");
        location.hash = `#/c/${collection}/${encodeURIComponent(created.record.id)}`;
        return created;
      }
      const res = await api("PUT", `/api/records/${collection}/${encodeURIComponent(view.record.id)}`, { version: view.record.version, data, confirmSlugChange });
      if (res.unchanged) { if (!quiet) toast("No changes to save.", "info"); dirty = false; markDirty(); return res; }
      view = upgrade(res);
      render();
      if (!quiet) toast(res.live && res.draft_differs ? "Draft saved. The website still shows the published version." : "Draft saved.", "ok");
      return res;
    } catch (e) {
      return handleError(e, () => save_({ quiet, confirmSlugChange: true }));
    }
  }

  async function handleError(e, retrySlug) {
    if (e instanceof ApiError && e.status === 422 && e.errors) { showErrors(e.errors); toast(e.message, "error"); return null; }
    if (e instanceof ApiError && e.code === "slug_change_confirm") {
      const r = await dialog({ title: "Change the page address?", body: e.message, confirm: "Change address" });
      return r.ok ? retrySlug() : null;
    }
    if (e instanceof ApiError && (e.code === "conflict" || e.code === "unconfirmed")) {
      const r = await dialog({ title: "Someone else changed this item", body: `${e.message} If you reload, copy any text you want to keep first.`, confirm: "Reload now", cancel: "Keep my screen" });
      if (r.ok) { dirty = false; app.reload(); }
      return null;
    }
    toast(errorText(e), "error");
    return null;
  }

  /* ---- Publishing ---- */
  // Save, then publish. Both steps are checked by the server and recorded in History and the
  // activity log.
  async function publishNow() {
    const r = await dialog({ title: "Publish to the website?", confirm: "Publish",
      body: view.live ? `This replaces the live version ${view.live.version}. The website rebuilds within a few minutes.` : "It appears on the website after the next rebuild (usually a few minutes)." });
    if (!r.ok) return;
    if (dirty || htmlEd?.hasVisualChanges()) { const saved = await save_({ quiet: true }); if (!saved) return; }
    if (view.record.status === "published") { toast("This version is already on the website. Change something first, then publish.", "info"); return; }
    const step = async (action) => {
      try {
        view = upgrade(await api("POST", `/api/records/${collection}/${encodeURIComponent(view.record.id)}/actions/${action}`, { version: view.record.version }));
        return true;
      } catch (e) { render(); handleError(e, () => {}); return false; }
    };
    if (!(await step("publish"))) return;
    render();
    toast(view.warning || "Published.", view.warning ? "warn" : "ok", view.warning ? 0 : 5000);
    if (view.deploy) toast(view.deploy.triggered ? "Website rebuild started. Changes appear in a few minutes." : view.deploy.error || view.deploy.reason, view.deploy.error ? "error" : "info", 8000);
    app.refreshCounts();
  }
  async function act(action) {
    const rec = view.record;
    if (dirty && !["unpublish", "archive", "delete", "reconcile", "undelete"].includes(action)) {
      const saved = await save_({ quiet: true });
      if (!saved) return;
    } else if (dirty) {
      const r = await dialog({ title: "Unsaved changes", body: "You have unsaved changes. Discard them and continue?", confirm: "Discard and continue", danger: true });
      if (!r.ok) return;
    }
    const label = action === "reconcile" ? "Finish publishing" : ACTIONS[action]?.label || action;
    const confirms = {
      publish: { title: "Publish to the website?", body: view.live ? `Version ${view.record.version} will replace the live version ${view.live.version}. The website rebuilds within a few minutes.` : "This item will appear on the website after the next rebuild (usually a few minutes).", confirm: "Publish" },
      unpublish: { title: "Take this off the website?", body: "It is removed at the next website rebuild. The content stays here as a Draft.", confirm: "Unpublish", danger: true },
      archive: { title: "Archive this item?", body: "Archived items are kept for the record and removed from the website.", confirm: "Archive", danger: true },
      delete: { title: "Delete this item?", body: "It disappears from the dashboard and the website. A Super Admin can restore it from Recovery.", confirm: "Delete", danger: true },
    };
    if (confirms[action]) {
      const r = await dialog(confirms[action]);
      if (!r.ok) return;
    }
    try {
      const res = await api("POST", `/api/records/${collection}/${encodeURIComponent(rec.id)}/actions/${action}`, { version: view.record.version });
      view = upgrade(res);
      render();
      if (res.warning) toast(res.warning, "warn", 0);
      else toast(`${label}: done.`, "ok");
      if (res.deploy) toast(res.deploy.triggered ? "Website rebuild started. Changes appear in a few minutes." : res.deploy.error || res.deploy.reason, res.deploy.error ? "error" : "info", 8000);
      app.refreshCounts();
    } catch (e) { handleError(e, () => {}); }
  }

  /* ---- Full-page preview: slides up from the bottom, never saves or publishes ---- */
  function openPreview(trigger) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = h("iframe", { title: "Page preview", sandbox: "", referrerpolicy: "no-referrer" });
    const status = h("p", { class: "pv-status", role: "status" }, "Loading the preview…");
    const notes = h("div", { class: "pv-notes" });
    const stage = h("div", { class: "pv-stage" }, frame);
    let which = "draft";
    const viewBtns = view.live ? {
      draft: h("button", { type: "button", "aria-pressed": "true", onclick: () => load("draft") }, "Your draft"),
      live: h("button", { type: "button", "aria-pressed": "false", onclick: () => load("live") }, `Live (v${view.live.version})`),
    } : null;
    const devBtns = {
      desktop: h("button", { type: "button", "aria-pressed": "true", onclick: () => device("desktop") }, icon("desktop"), h("span", { class: "sr-only" }, "Desktop width")),
      mobile: h("button", { type: "button", "aria-pressed": "false", onclick: () => device("mobile") }, icon("mobile"), h("span", { class: "sr-only" }, "Mobile width")),
    };
    const close = h("button", { type: "button", class: "pv-close", "aria-label": "Close preview", onclick: () => shut() }, h("span", { "aria-hidden": "true" }, "×"));
    const overlay = h("div", { class: "pv", role: "dialog", "aria-modal": "true", "aria-label": "Full-page preview" },
      h("div", { class: "pv-bar" },
        h("div", { class: "pv-title" }, h("b", {}, "Preview"), status),
        viewBtns ? h("div", { class: "seg", role: "group", "aria-label": "Version" }, viewBtns.draft, viewBtns.live) : null,
        h("div", { class: "seg", role: "group", "aria-label": "Preview width" }, devBtns.desktop, devBtns.mobile),
        close),
      notes, stage);
    const keydown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); shut(); }
      if (e.key === "Tab") { // keep focus inside the preview
        const items = [...overlay.querySelectorAll("button, iframe")].filter((x) => !x.disabled);
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    };
    function device(d) { stage.classList.toggle("is-mobile", d === "mobile"); devBtns.desktop.setAttribute("aria-pressed", String(d === "desktop")); devBtns.mobile.setAttribute("aria-pressed", String(d === "mobile")); }
    async function load(kind) {
      which = kind;
      if (viewBtns) { viewBtns.draft.setAttribute("aria-pressed", String(kind === "draft")); viewBtns.live.setAttribute("aria-pressed", String(kind === "live")); }
      status.textContent = "Loading the preview…";
      clear(notes);
      try {
        const res = await api("POST", "/api/preview", kind === "live" ? { collection, id: view.record.id, live: true } : { collection, id: view.record.id || null, data: collect() });
        if (which !== kind) return;
        frame.srcdoc = res.html;
        status.textContent = kind === "live" ? `The live version (v${view.live.version}) as the website shows it now.` : `Your draft${dirty || isNew ? ", including unsaved changes" : ""}. Not saved or published.`;
        if (res.report?.length) notes.append(h("div", { class: "alert alert--warn" }, h("div", {}, h("p", {}, h("strong", {}, "Removed for safety when published: "), res.report.join("; ")))));
      } catch (e) { status.textContent = errorText(e); }
    }
    function shut() {
      document.removeEventListener("keydown", keydown, true);
      overlay.classList.remove("is-open");
      const done = () => { overlay.remove(); document.documentElement.classList.remove("pv-lock"); trigger?.focus(); };
      if (reduce) done(); else { overlay.addEventListener("transitionend", done, { once: true }); setTimeout(done, 600); }
    }
    document.documentElement.classList.add("pv-lock");
    document.body.append(overlay);
    document.addEventListener("keydown", keydown, true);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("is-open")));
    close.focus({ preventScroll: true });
    load("draft");
  }

  /* ---- History ---- */
  async function loadHistory(panel) {
    try {
      const rows = await api("GET", `/api/records/${collection}/${encodeURIComponent(view.record.id)}/history`);
      clear(panel, h("div", { class: "card" }, h("h2", {}, "Version history"),
        h("p", { class: "muted small" }, "Every save and publishing step is kept, Details and page together. Anyone who can edit this item can copy an earlier version back into the draft (it then needs publishing again)."),
        rows.length ? h("ul", { class: "list history" }, rows.map((r) => h("li", {},
          h("span", { class: "mono" }, `v${r.version}`), h("span", {}, `${historyKind(r.kind)} · `, statusBadge(r.status)), h("span", { class: "muted" }, `${when(r.at)} · ${who(r.by)}`), h("span", { class: "spacer" }),
          view.can_edit && r.version !== view.record.version ? h("button", { class: "btn btn--light btn--sm", type: "button", onclick: (e) => busy(e.currentTarget, () => restoreVersion(r)) }, "Restore this version") : null)))
          : h("p", { class: "muted" }, "No history yet.")));
    } catch (e) { clear(panel, h("p", { class: "error" }, errorText(e))); }
  }
  async function restoreVersion(r) {
    const ok = await dialog({ title: `Restore version ${r.version}?`, body: "Its Details and page replace the current draft. The live website is not changed until you publish.", confirm: "Restore as draft" });
    if (!ok.ok) return;
    try {
      view = upgrade(await api("POST", `/api/records/${collection}/${encodeURIComponent(view.record.id)}/history/${r.id}/restore`, { version: view.record.version }));
      tab = "details";
      render();
      toast(`Version ${r.version} restored as a draft.`, "ok");
    } catch (e) { handleError(e, () => {}); }
  }

  // Ctrl+S / Cmd+S saves the draft (attached once; the view re-renders inside root)
  root.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && view.can_edit) { e.preventDefault(); if (dirty || isNew || htmlEd?.hasVisualChanges()) save_(); } });

  render();
  return { el: root, isDirty: () => dirty || !!htmlEd?.hasVisualChanges() };
}
