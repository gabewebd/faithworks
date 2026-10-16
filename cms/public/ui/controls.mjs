// Form controls in the CMS design system: dropdowns (optionally searchable), searchable
// multi-selects (tags, authors), a date picker and a time picker. They replace the browser's
// native widgets so every control looks and behaves the same, with full keyboard support:
//   dropdown/multi-select: Enter/Space/↓ opens, ↑↓ move, Enter picks, Esc closes, type to search
//   date picker: type a date or open the calendar; arrows move by day/week, PageUp/PageDown by month
// Each returns { el, get(), set(v), focus(), disable(bool), invalid(bool) }.
import { h, clear, icon } from "./dom.mjs";

let seq = 0;
const uid = (p) => `${p}${++seq}`;
const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

// One open popover at a time; clicks outside close it.
let openPop = null;
function trackOpen(close) { if (openPop && openPop !== close) openPop(); openPop = close; }
document.addEventListener("pointerdown", (e) => { if (openPop && !e.target.closest?.(".ctl")) openPop(); }, true);

function listbox(id) { return h("ul", { class: "ctl-list", role: "listbox", id, tabindex: "-1" }); }
function moveActive(list, dir) {
  const items = [...list.querySelectorAll("[role=option]:not([aria-disabled=true])")];
  if (!items.length) return null;
  let i = items.findIndex((x) => x.classList.contains("is-active"));
  i = dir === "first" ? 0 : dir === "last" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, (i < 0 ? (dir > 0 ? -1 : items.length) : i) + dir));
  items.forEach((x) => x.classList.remove("is-active"));
  items[i].classList.add("is-active");
  items[i].scrollIntoView({ block: "nearest" });
  return items[i];
}

/* ---- Dropdown --------------------------------------------------------------- */
export function selectBox({ id = uid("sel"), options = [], value = "", placeholder = "Choose…", searchable = options.length > 10, disabled = false, onChange = () => {}, describedBy, label }) {
  let opts = options, current = value ?? "";
  const listId = uid("lb");
  const text = h("span", { class: "ctl-value" });
  const btn = h("button", { type: "button", class: "input ctl-btn", id, "aria-haspopup": "listbox", "aria-expanded": "false", "aria-controls": listId, disabled, "aria-describedby": describedBy || null, "aria-label": label || null }, text, h("span", { class: "ctl-chev", "aria-hidden": "true" }));
  const search = searchable ? h("input", { class: "input ctl-search", type: "search", placeholder: "Type to search…", "aria-label": "Search options", "aria-controls": listId, autocomplete: "off" }) : null;
  const list = listbox(listId);
  const pop = h("div", { class: "ctl-pop", hidden: true }, search, list);
  const el = h("div", { class: "ctl ctl--select" }, btn, pop);

  const labelOf = (v) => opts.find((o) => o.value === v)?.label;
  function paint() {
    const l = labelOf(current);
    text.textContent = l ?? (current ? current : placeholder);
    text.classList.toggle("is-placeholder", l === undefined && !current);
  }
  function fill(q = "") {
    const n = norm(q);
    const shown = opts.filter((o) => !n || norm(o.label).includes(n) || norm(o.value).includes(n));
    clear(list, shown.length ? shown.map((o) => h("li", {
      role: "option", id: `${listId}-${o.value || "none"}`.replace(/[^\w-]/g, "_"), "aria-selected": String(o.value === current), class: o.value === current ? "is-active" : "",
      dataset: { value: o.value }, onmousedown: (e) => e.preventDefault(), onclick: () => pick(o.value),
    }, o.label, o.note ? h("small", {}, o.note) : null)) : h("li", { class: "ctl-empty", "aria-disabled": "true", role: "option" }, "No matches"));
  }
  function open() {
    if (btn.disabled || !pop.hidden) return;
    trackOpen(close);
    fill(); pop.hidden = false; btn.setAttribute("aria-expanded", "true"); el.classList.add("is-open");
    (list.querySelector(".is-active") || list.firstElementChild)?.scrollIntoView({ block: "nearest" });
    if (search) { search.value = ""; search.focus(); } else list.focus();
  }
  function close(focusBtn = false) {
    if (pop.hidden) return;
    pop.hidden = true; btn.setAttribute("aria-expanded", "false"); el.classList.remove("is-open");
    if (openPop === close) openPop = null;
    if (focusBtn) btn.focus();
  }
  function pick(v) { const changed = v !== current; current = v; paint(); close(true); if (changed) onChange(v); }
  function keys(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(list, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(list, -1); }
    else if (e.key === "Home") { e.preventDefault(); moveActive(list, "first"); }
    else if (e.key === "End") { e.preventDefault(); moveActive(list, "last"); }
    else if (e.key === "Enter" || (e.key === " " && !search)) { e.preventDefault(); const a = list.querySelector(".is-active[data-value]"); if (a) pick(a.dataset.value); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") close();
    else if (!search && e.key.length === 1) { // typeahead
      const hit = [...list.querySelectorAll("[data-value]")].find((x) => norm(x.textContent).startsWith(norm(e.key)));
      if (hit) { list.querySelectorAll(".is-active").forEach((x) => x.classList.remove("is-active")); hit.classList.add("is-active"); hit.scrollIntoView({ block: "nearest" }); }
    }
  }
  btn.addEventListener("click", () => (pop.hidden ? open() : close()));
  btn.addEventListener("keydown", (e) => { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); } });
  list.addEventListener("keydown", keys);
  search?.addEventListener("keydown", keys);
  search?.addEventListener("input", () => { fill(search.value); moveActive(list, "first"); });
  paint();
  return {
    el, get: () => current, set: (v) => { current = v ?? ""; paint(); }, focus: () => btn.focus(),
    disable: (d) => { btn.disabled = !!d; }, invalid: (b) => btn.setAttribute("aria-invalid", b ? "true" : "false"),
    setOptions: (o) => { opts = o; paint(); }, control: btn,
  };
}

/* ---- Multi-select with chips ------------------------------------------------- */
// addNew: { label, onAdd() → option | null } shows a "+ New…" item at the end of the list.
export function multiSelect({ id = uid("ms"), options = [], values = [], placeholder = "Search…", disabled = false, onChange = () => {}, onCreate = null, createLabel = (q) => `Create “${q}”`, addNew = null, describedBy, label }) {
  let opts = options, current = [...(values || [])];
  const listId = uid("lb");
  const chips = h("span", { class: "ctl-chips" });
  const input = h("input", { class: "ctl-input", id, type: "text", placeholder, autocomplete: "off", role: "combobox", "aria-expanded": "false", "aria-controls": listId, "aria-autocomplete": "list", disabled, "aria-describedby": describedBy || null, "aria-label": label || null });
  const box = h("div", { class: "input ctl-box", onclick: (e) => { if (e.target === box || e.target === chips) input.focus(); } }, chips, input);
  const list = listbox(listId);
  list.setAttribute("aria-multiselectable", "true");
  const pop = h("div", { class: "ctl-pop", hidden: true }, list);
  const el = h("div", { class: "ctl ctl--multi" }, box, pop);
  const labelOf = (v) => opts.find((o) => o.value === v)?.label || v;

  function paint() {
    clear(chips, current.map((v) => h("span", { class: "chip-sel" }, h("span", {}, labelOf(v)),
      disabled ? null : h("button", { type: "button", "aria-label": `Remove ${labelOf(v)}`, onclick: (e) => { e.stopPropagation(); toggle(v); input.focus(); } }, "×"))));
    input.placeholder = current.length ? "" : placeholder;
  }
  function fill() {
    const q = input.value.trim(), n = norm(q);
    const shown = opts.filter((o) => !o.hidden && (!n || norm(o.label).includes(n) || norm(o.note).includes(n) || norm(o.value).includes(n)));
    const items = shown.map((o) => h("li", {
      role: "option", "aria-selected": String(current.includes(o.value)), dataset: { value: o.value },
      onmousedown: (e) => e.preventDefault(), onclick: () => { toggle(o.value); input.value = ""; fill(); },
    }, h("span", { class: "ctl-check", "aria-hidden": "true" }), h("span", {}, o.label, o.note ? h("small", {}, o.note) : null)));
    if (addNew && !q) items.push(h("li", { role: "option", class: "ctl-create", dataset: { addnew: "1" }, onmousedown: (e) => e.preventDefault(), onclick: () => runAdd() }, icon("plus"), addNew.label));
    if (onCreate && q && !opts.some((o) => norm(o.label) === n)) items.push(h("li", { role: "option", class: "ctl-create", dataset: { create: q }, onmousedown: (e) => e.preventDefault(), onclick: () => create(q) }, icon("plus"), createLabel(q)));
    clear(list, items.length ? items : h("li", { class: "ctl-empty", role: "option", "aria-disabled": "true" }, "No matches"));
    moveActive(list, "first");
  }
  async function runAdd() {
    close();
    const made = await addNew.onAdd();
    if (made) { opts = [...opts, made]; if (!current.includes(made.value)) toggle(made.value); }
    input.focus();
  }
  async function create(q) {
    const made = await onCreate(q);
    if (made) { opts = [...opts, made]; if (!current.includes(made.value)) toggle(made.value); input.value = ""; fill(); }
  }
  function toggle(v) { current = current.includes(v) ? current.filter((x) => x !== v) : [...current, v]; paint(); onChange([...current]); fill(); }
  function open() { if (input.disabled || !pop.hidden) return; trackOpen(close); pop.hidden = false; input.setAttribute("aria-expanded", "true"); el.classList.add("is-open"); fill(); }
  function close() { if (pop.hidden) return; pop.hidden = true; input.setAttribute("aria-expanded", "false"); el.classList.remove("is-open"); input.value = ""; if (openPop === close) openPop = null; }
  input.addEventListener("focus", open);
  input.addEventListener("input", () => { open(); fill(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); open(); moveActive(list, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(list, -1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const a = list.querySelector(".is-active");
      if (a?.dataset.value) { toggle(a.dataset.value); input.value = ""; fill(); } else if (a?.dataset.create) create(a.dataset.create); else if (a?.dataset.addnew) runAdd();
    } else if (e.key === "Backspace" && !input.value && current.length) toggle(current[current.length - 1]);
    else if (e.key === "Escape") { if (!pop.hidden) { e.preventDefault(); close(); } }
    else if (e.key === "Tab") close();
  });
  paint();
  return {
    el, get: () => [...current], set: (v) => { current = [...(v || [])]; paint(); }, focus: () => input.focus(),
    disable: (d) => { input.disabled = !!d; el.classList.toggle("is-disabled", !!d); paint(); }, invalid: (b) => box.setAttribute("aria-invalid", b ? "true" : "false"),
    setOptions: (o) => { opts = o; paint(); }, control: input,
  };
}

/* ---- Date picker -------------------------------------------------------------- */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
export function formatDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return v || "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${v}T12:00:00Z`));
}
// Accepts 2026-10-16, 16/10/2026, 16 Oct 2026, Oct 16 2026.
export function parseDate(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return valid(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return valid(+m[3], +m[2] - 1, +m[1]);
  const words = t.replace(/,/g, " ").replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+/i, "").split(/\s+/);
  const mi = (w) => MONTHS.findIndex((x) => x.toLowerCase().startsWith(String(w).toLowerCase().slice(0, 3)));
  if (words.length === 3) {
    if (/^\d+$/.test(words[0]) && mi(words[1]) >= 0) return valid(+words[2], mi(words[1]), +words[0]);
    if (mi(words[0]) >= 0 && /^\d+$/.test(words[1])) return valid(+words[2], mi(words[0]), +words[1]);
  }
  return null;
  function valid(y, mo, d) { const dt = new Date(Date.UTC(y, mo, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo && dt.getUTCDate() === d && y > 1900 ? iso(y, mo, d) : null; }
}

export function datePicker({ id = uid("date"), value = "", disabled = false, onChange = () => {}, describedBy }) {
  let current = value || "", view = null, focusDay = null;
  const input = h("input", { class: "input ctl-dateinput", id, type: "text", inputmode: "text", autocomplete: "off", placeholder: "e.g. 16 Oct 2026", disabled, "aria-describedby": describedBy || null });
  const btn = h("button", { type: "button", class: "ctl-calbtn", "aria-label": "Choose a date from the calendar", "aria-haspopup": "dialog", "aria-expanded": "false", disabled }, icon("calendar"));
  const title = h("p", { class: "cal-title", "aria-live": "polite" });
  const grid = h("div", { class: "cal-grid", role: "grid" });
  const pop = h("div", { class: "ctl-pop cal", role: "dialog", "aria-modal": "false", "aria-label": "Calendar", hidden: true },
    h("div", { class: "cal-head" },
      h("button", { type: "button", class: "cal-nav", "aria-label": "Previous month", onclick: () => shift(-1) }, "‹"), title,
      h("button", { type: "button", class: "cal-nav", "aria-label": "Next month", onclick: () => shift(1) }, "›")),
    grid,
    h("div", { class: "cal-foot" },
      h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => pick(todayIso()) }, "Today"),
      h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => pick("") }, "Clear")));
  const el = h("div", { class: "ctl ctl--date" }, h("div", { class: "ctl-datewrap" }, input, btn), pop);
  const paint = () => { input.value = formatDate(current); };

  function draw() {
    const [y, m] = view;
    title.textContent = `${MONTHS[m]} ${y}`;
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0 = Sunday
    const offset = (first + 6) % 7; // weeks start on Monday
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(h("span", { class: "cal-pad", role: "gridcell" }));
    const today = todayIso();
    for (let d = 1; d <= days; d++) {
      const v = iso(y, m, d);
      cells.push(h("button", {
        type: "button", role: "gridcell", class: `cal-day${v === current ? " is-sel" : ""}${v === today ? " is-today" : ""}`, tabindex: v === focusDay ? "0" : "-1",
        "aria-selected": v === current ? "true" : null, "aria-label": formatDate(v), dataset: { v }, onclick: () => pick(v),
      }, String(d)));
    }
    const rows = [h("div", { class: "cal-row cal-dow", role: "row" }, ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((x) => h("span", { role: "columnheader" }, x)))];
    for (let i = 0; i < cells.length; i += 7) rows.push(h("div", { class: "cal-row", role: "row" }, cells.slice(i, i + 7)));
    clear(grid, rows);
  }
  function shift(n) { let [y, m] = view; m += n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; view = [y, m]; const d = Math.min(Number(focusDay.slice(8)), new Date(Date.UTC(y, m + 1, 0)).getUTCDate()); focusDay = iso(y, m, d); draw(); }
  function open() {
    if (input.disabled || !pop.hidden) return;
    trackOpen(close);
    focusDay = current || todayIso();
    view = [Number(focusDay.slice(0, 4)), Number(focusDay.slice(5, 7)) - 1];
    draw(); pop.hidden = false; btn.setAttribute("aria-expanded", "true"); el.classList.add("is-open");
    grid.querySelector("[tabindex='0']")?.focus();
  }
  function close(refocus = false) { if (pop.hidden) return; pop.hidden = true; btn.setAttribute("aria-expanded", "false"); el.classList.remove("is-open"); if (openPop === close) openPop = null; if (refocus) btn.focus(); }
  function pick(v) { const changed = v !== current; current = v; paint(); setError(false); close(true); if (changed) onChange(v); }
  function setError(b) { input.setAttribute("aria-invalid", b ? "true" : "false"); }
  grid.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      const d = new Date(`${focusDay}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + step);
      focusDay = d.toISOString().slice(0, 10);
      const y = d.getUTCFullYear(), m = d.getUTCMonth();
      if (y !== view[0] || m !== view[1]) view = [y, m];
      draw(); grid.querySelector("[tabindex='0']")?.focus();
    } else if (e.key === "PageUp" || e.key === "PageDown") { e.preventDefault(); shift(e.key === "PageUp" ? -1 : 1); grid.querySelector("[tabindex='0']")?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
  });
  pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); close(true); } });
  btn.addEventListener("click", () => (pop.hidden ? open() : close()));
  input.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" && e.altKey) { e.preventDefault(); open(); } });
  input.addEventListener("change", () => {
    const v = parseDate(input.value);
    if (v === null) { setError(true); return; }
    setError(false);
    const changed = v !== current; current = v; paint();
    if (changed) onChange(v);
  });
  paint();
  return {
    el, get: () => current, set: (v) => { current = v || ""; paint(); }, focus: () => input.focus(),
    disable: (d) => { input.disabled = btn.disabled = !!d; }, invalid: setError, control: input,
    hasTypingError: () => input.getAttribute("aria-invalid") === "true" && parseDate(input.value) === null,
  };
}

/* ---- Time picker ---------------------------------------------------------------- */
export function formatTime(v) {
  const m = /^(\d{2}):(\d{2})$/.exec(v || "");
  if (!m) return v || "";
  const hh = Number(m[1]);
  return `${hh % 12 || 12}:${m[2]} ${hh >= 12 ? "PM" : "AM"}`;
}
// Accepts 9:30, 0930, 9.30pm, 9 pm, 21:30.
export function parseTime(s) {
  const t = String(s || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return "";
  const m = t.match(/^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm|a|p)?$/);
  if (!m) return null;
  let hh = Number(m[1]); const mm = Number(m[2] || 0); const ap = m[3]?.[0];
  if (mm > 59) return null;
  if (ap) { if (hh < 1 || hh > 12) return null; hh = (hh % 12) + (ap === "p" ? 12 : 0); }
  if (hh > 23) return null;
  return `${pad(hh)}:${pad(mm)}`;
}
export function timePicker({ id = uid("time"), value = "", disabled = false, onChange = () => {}, describedBy }) {
  let current = value || "";
  const listId = uid("lb");
  const input = h("input", { class: "input", id, type: "text", autocomplete: "off", placeholder: "e.g. 9:30 AM", role: "combobox", "aria-expanded": "false", "aria-controls": listId, "aria-autocomplete": "list", disabled, "aria-describedby": describedBy || null });
  const list = listbox(listId);
  const pop = h("div", { class: "ctl-pop ctl-pop--narrow", hidden: true }, list);
  const el = h("div", { class: "ctl ctl--time" }, input, pop);
  const slots = []; for (let i = 0; i < 48; i++) slots.push(`${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
  const paint = () => { input.value = formatTime(current); };
  function fill() {
    clear(list, slots.map((v) => h("li", { role: "option", "aria-selected": String(v === current), class: v === current ? "is-active" : "", dataset: { value: v }, onmousedown: (e) => e.preventDefault(), onclick: () => pick(v) }, formatTime(v))));
    const target = list.querySelector(".is-active") || list.querySelector(`[data-value="${current ? current.slice(0, 3) + (Number(current.slice(3)) < 30 ? "00" : "30") : "09:00"}"]`);
    target?.scrollIntoView({ block: "center" });
  }
  function open() { if (input.disabled || !pop.hidden) return; trackOpen(close); fill(); pop.hidden = false; input.setAttribute("aria-expanded", "true"); el.classList.add("is-open"); }
  function close() { if (pop.hidden) return; pop.hidden = true; input.setAttribute("aria-expanded", "false"); el.classList.remove("is-open"); if (openPop === close) openPop = null; }
  function pick(v) { const changed = v !== current; current = v; paint(); input.setAttribute("aria-invalid", "false"); close(); if (changed) onChange(v); }
  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); open(); moveActive(list, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(list, -1); }
    else if (e.key === "Enter" && !pop.hidden) { const a = list.querySelector(".is-active"); if (a && !input.value.trim()) { e.preventDefault(); pick(a.dataset.value); } }
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") close();
  });
  input.addEventListener("change", () => {
    const v = parseTime(input.value);
    if (v === null) { input.setAttribute("aria-invalid", "true"); return; }
    pick(v);
  });
  paint();
  return {
    el, get: () => current, set: (v) => { current = v || ""; paint(); }, focus: () => input.focus(),
    disable: (d) => { input.disabled = !!d; }, invalid: (b) => input.setAttribute("aria-invalid", b ? "true" : "false"), control: input,
    hasTypingError: () => input.getAttribute("aria-invalid") === "true" && parseTime(input.value) === null,
  };
}

/* ---- Toggle switch (a styled checkbox, so it stays a real form control) ---------- */
export function toggle({ id = uid("tg"), checked = false, disabled = false, onChange = () => {}, label, describedBy }) {
  const input = h("input", { type: "checkbox", role: "switch", class: "switch__input", id, checked, disabled, "aria-describedby": describedBy || null });
  input.addEventListener("change", () => onChange(input.checked));
  const el = h("label", { class: "switch", for: id }, input, h("span", { class: "switch__track", "aria-hidden": "true" }), label ? h("span", { class: "switch__label" }, label) : null);
  return { el, get: () => input.checked, set: (v) => { input.checked = !!v; }, focus: () => input.focus(), disable: (d) => { input.disabled = !!d; }, control: input };
}
