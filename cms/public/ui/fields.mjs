// Form widgets generated from the shared schema (shared/schema.mjs). Each widget returns
// { el, key, get(), set(v), error(msg), focus() } and calls ctx.onChange(key) on every edit.
// Dropdowns, multi-selects, dates and times use the CMS controls (controls.mjs), not the
// browser's native widgets.
import { h, clear, api, toast, dialog, errorText } from "./dom.mjs";
import { selectBox, multiSelect, datePicker, timePicker, toggle } from "./controls.mjs";
import { checkUrl, SLUG_RE, slugify } from "/shared/validate.mjs";
import { publicPath, isAdmin } from "/shared/schema.mjs";

let uid = 0;
const nextId = () => `f${++uid}`;
const isLocal = () => ["localhost", "127.0.0.1"].includes(location.hostname);
export function assetUrl(url, cfg) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return isLocal() ? url : cfg.publicSiteUrl + url;
  return "";
}

// Short fields sit two per row in the Details cards; long ones use the full width.
const HALF_TYPES = new Set(["select", "ref", "date", "time", "number", "email", "boolean"]);
const isHalf = (fd) => fd.half === true || HALF_TYPES.has(fd.type) || (fd.type === "text" && fd.max && fd.max <= 120 && !["title", "display_name"].includes(fd.key));

export function renderField(fd, value, ctx) {
  const id = nextId();
  const locked = ctx.readOnly || (fd.adminOnly && !isAdmin(ctx.user.role)) || (fd.superOnly && ctx.user.role !== "super_admin");
  const lockNote = fd.superOnly ? "Super Admin only" : fd.adminOnly ? "admins only" : "";
  const errEl = h("p", { class: "error", id: `${id}-err`, hidden: true });
  const helpEl = fd.help ? h("p", { class: "help", id: `${id}-help` }, fd.help) : null;
  const describedBy = [fd.help ? `${id}-help` : "", `${id}-err`].filter(Boolean).join(" ");
  const label = h("label", { for: id }, fd.label, fd.required ? h("span", { class: "req", title: "Required before review" }, " *") : null, locked && lockNote && !ctx.readOnly ? h("span", { class: "locked" }, `(${lockNote})`) : null);
  const changed = () => ctx.onChange?.(fd.key);
  let control, get, set, focusEl, extra = null, widget = null;
  const fieldErr = (msg) => { errEl.hidden = !msg; errEl.textContent = msg || ""; (widget ? widget.invalid(!!msg) : control?.setAttribute?.("aria-invalid", msg ? "true" : "false")); };

  const input = (type, attrs = {}) => h("input", { class: "input", id, type, disabled: locked, "aria-describedby": describedBy, ...attrs });
  const fromWidget = (w) => { widget = w; control = w.el; get = w.get; set = w.set; focusEl = w.control; };

  switch (fd.type) {
    case "textarea":
      control = h("textarea", { class: "input", id, rows: fd.rows || 4, disabled: locked, "aria-describedby": describedBy, maxlength: fd.max || null });
      get = () => control.value; set = (v) => { control.value = v ?? ""; };
      break;
    case "list":
      control = h("textarea", { class: "input", id, rows: Math.max(3, (value || []).length + 1), disabled: locked, "aria-describedby": describedBy });
      get = () => control.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); set = (v) => { control.value = (v || []).join("\n"); };
      break;
    case "boolean": {
      const t = toggle({ id, checked: !!value, disabled: locked, onChange: changed, describedBy, label: [fd.label, locked && lockNote && !ctx.readOnly ? h("span", { class: "locked" }, `(${lockNote})`) : null] });
      return finish(h("div", { class: "field field--half", dataset: { key: fd.key } }, t.el, helpEl, errEl), { get: t.get, set: t.set, focus: t.focus });
    }
    case "number":
      control = input("number", { min: 0, step: 1, inputmode: "numeric" });
      get = () => (control.value === "" ? null : Number(control.value)); set = (v) => { control.value = v ?? ""; };
      break;
    case "date": fromWidget(datePicker({ id, value, disabled: locked, onChange: changed, describedBy })); break;
    case "time": fromWidget(timePicker({ id, value, disabled: locked, onChange: changed, describedBy })); break;
    case "email": control = input("email", { autocomplete: "off" }); get = () => control.value.trim(); set = (v) => { control.value = v || ""; }; break;
    case "select": {
      const options = fd.options.some((o) => o.value === "") || fd.required ? fd.options : [{ value: "", label: "Not set" }, ...fd.options];
      fromWidget(selectBox({ id, options, value, searchable: fd.searchable, disabled: locked, onChange: changed, describedBy }));
      break;
    }
    case "ref":
      fromWidget(selectBox({ id, value, searchable: true, disabled: locked, onChange: changed, describedBy, placeholder: "None",
        options: [{ value: "", label: "None" }, ...(ctx.refs?.[fd.ref] || []).map((o) => ({ value: o.id, label: o.label, note: o.live ? "" : "not live" }))] }));
      break;
    case "tags": {
      const tagOptions = () => (ctx.tags || []).map((t) => ({ value: t.id, label: t.label, hidden: !!t.archived }));
      const create = isAdmin(ctx.user.role) ? async (label) => {
        try {
          const t = await api("POST", "/api/tags", { label });
          ctx.tags.push(t);
          toast(`Tag “${t.label}” created.`, "ok");
          return { value: t.id, label: t.label };
        } catch (e) { toast(errorText(e), "error"); return null; }
      } : null;
      const addNew = create ? { label: "New tag…", onAdd: async () => { const r = await dialog({ title: "New tag", note: { label: "Tag name", required: true, placeholder: "e.g. Leadership" }, confirm: "Create tag" }); return r.ok ? create(r.value) : null; } } : null;
      fromWidget(multiSelect({ id, options: tagOptions(), values: value || [], disabled: locked, onChange: changed, describedBy, placeholder: (ctx.tags || []).length ? "Search or add tags…" : "No tags yet", onCreate: create, createLabel: (q) => `Create the tag “${q}”`, addNew }));
      break;
    }
    case "authors": {
      const people = (ctx.authors || []).map((a) => ({ value: a.email, label: a.name || a.email, note: a.email }));
      for (const v of value || []) if (!people.some((p) => p.value === v)) people.push({ value: v, label: v, note: "no longer a CMS user" });
      fromWidget(multiSelect({ id, options: people, values: value || [], disabled: locked, onChange: changed, describedBy, placeholder: "Search people…" }));
      break;
    }
    case "url": {
      control = input("text", { spellcheck: "false", inputmode: "url", placeholder: "https://… or /path/" });
      get = () => control.value.trim(); set = (v) => { control.value = v || ""; };
      if (fd.image) {
        const img = h("img", { class: "img-preview", alt: "", hidden: true });
        const show = () => { const u = assetUrl(get(), ctx.config); img.hidden = !u; if (u) img.src = u; };
        img.addEventListener("error", () => { img.hidden = true; });
        control.addEventListener("change", show);
        extra = img;
        queueMicrotask(show);
        set = (v) => { control.value = v || ""; show(); };
      }
      control.addEventListener("blur", () => { const p = get() && checkUrl(get()); fieldErr(p || ""); });
      break;
    }
    case "slug": {
      control = input("text", { spellcheck: "false", autocomplete: "off" });
      const preview = h("p", { class: "url-preview" });
      const gen = h("button", { type: "button", class: "btn btn--ghost btn--sm", disabled: locked, onclick: () => { set(slugify(ctx.getTitle?.() || "")); changed(); update(); } }, "Create from title");
      const update = () => {
        const s = get();
        const path = publicPath(ctx.collection, s || "your-slug");
        clear(preview, "Address: ", h("b", {}, `${ctx.config.siteOrigin || ctx.config.publicSiteUrl}${path}`));
        if (ctx.liveSlug && s !== ctx.liveSlug) preview.append(h("span", { class: "error", style: "display:block" }, `Live page is at ${publicPath(ctx.collection, ctx.liveSlug)}. Changing this moves the page; the old address will redirect.`));
        if (s && !SLUG_RE.test(s)) fieldErr("Use lowercase letters, numbers and single hyphens.");
        else fieldErr("");
      };
      get = () => control.value.trim(); set = (v) => { control.value = v || ""; };
      control.addEventListener("input", () => { ctx.slugTouched = true; update(); });
      extra = h("div", { class: "row" }, preview, gen);
      ctx.updateSlugPreview = update;
      queueMicrotask(update);
      break;
    }
    case "pairs": {
      const rows = h("div", { class: "pairs", id });
      const subs = fd.subfields;
      const addRow = (data = {}) => {
        const inputs = subs.map((sf) => sf.type === "textarea"
          ? h("textarea", { class: "input", rows: 2, placeholder: sf.label, "aria-label": sf.label, disabled: locked, value: data[sf.key] || "" })
          : h("input", { class: "input", type: "text", placeholder: sf.label, "aria-label": sf.label, disabled: locked, value: data[sf.key] || "" }));
        const row = h("div", { class: `pair${subs.length === 3 ? " pair--3" : ""}` }, inputs,
          h("button", { type: "button", class: "btn btn--ghost btn--sm", "aria-label": "Remove row", disabled: locked, onclick: () => { row.remove(); changed(); } }, "Remove"));
        row._inputs = inputs;
        inputs.forEach((i) => i.addEventListener("input", changed));
        rows.append(row);
        return row;
      };
      const add = h("button", { type: "button", class: "btn btn--light btn--sm", disabled: locked, onclick: () => { addRow().querySelector("input,textarea")?.focus(); changed(); } }, "+ Add row");
      get = () => [...rows.children].map((r) => Object.fromEntries(subs.map((sf, i) => [sf.key, r._inputs[i].value.trim()]))).filter((r) => Object.values(r).some(Boolean));
      set = (v) => { clear(rows); (v || []).forEach((r) => addRow(r)); };
      control = rows;
      extra = add;
      focusEl = rows;
      break;
    }
    default:
      control = input("text", { maxlength: fd.max || null });
      get = () => control.value.trim(); set = (v) => { control.value = v ?? ""; };
  }
  if (!widget) {
    control.addEventListener("input", changed);
    control.addEventListener("change", changed);
    set(value);
  }
  const wrap = h("div", { class: `field${isHalf(fd) ? " field--half" : ""}`, dataset: { key: fd.key } }, label, control, extra, helpEl, errEl);
  return finish(wrap);

  function finish(wrapEl, over = {}) {
    return {
      el: wrapEl, key: fd.key, get: () => (over.get || get)(), set: (v) => (over.set || set)(v), error: fieldErr,
      focus: () => (over.focus ? over.focus() : (focusEl || control).focus?.()),
      hasTypingError: () => !!widget?.hasTypingError?.(),
    };
  }
}

// A value the server calculates (reading time, duration, byline): shown, never typed.
export function computedField(label, help) {
  const out = h("output", { class: "computed" });
  const el = h("div", { class: "field" }, h("span", { class: "label" }, label), out, help ? h("p", { class: "help" }, help) : null);
  return { el, set: (text, empty = "Not enough information yet") => { out.textContent = text || empty; out.classList.toggle("is-empty", !text); } };
}
