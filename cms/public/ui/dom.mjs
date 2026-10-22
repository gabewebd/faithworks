// DOM helpers, API client, dialogs and toasts for the dashboard.
// Everything is built with DOM APIs and textContent: CMS data is never inserted as HTML in
// the dashboard, so content cannot run script here. Page HTML is only ever rendered inside
// sandboxed iframes (see html-editor.mjs).
import { STATUSES, ROLES, statusOf } from "/shared/schema.mjs";

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value") el.value = v;
    else if (k === "checked" || k === "disabled" || k === "selected" || k === "hidden") el[k] = !!v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el, ...children) => { el.replaceChildren(); append(el, children); return el; };

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z", book: "M3 5h5a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H3zM21 5h-5a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h6z", calendar: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  file: "M6 3h8l4 4v14H6zM14 3v4h4", quote: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4zM8.5 8.5h2v2a2 2 0 0 1-2 2M13.5 8.5h2v2a2 2 0 0 1-2 2", tag: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01", settings: "M3 7h10M19 7h2M3 17h2M11 17h10M16 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  users: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a3 3 0 1 0 0-6M22 20c0-3-2-5.5-5-6", log: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z", plus: "M12 5v14M5 12h14", undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  desktop: "M3 5h18v11H3zM8 20h8M12 16v4", mobile: "M8 3h8v18H8zM11 18h2", eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4", pointer: "M5 3l14 7-6 2-2 6z", trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3", copy: "M8 8h12v12H8zM4 16V4h12",
  up: "M12 19V5M5 12l7-7 7 7", left: "M19 12H5M12 19l-7-7 7-7", right: "M5 12h14M12 5l7 7-7 7", external: "M7 17 17 7M8 7h9v9", down: "M12 5v14M5 12l7 7 7-7", parent: "M12 19V7M6 11l6-6 6 6", menu: "M4 7h16M4 12h16M4 17h16", inbox: "M4 13h4l2 3h4l2-3h4M4 13l2.5-8h11L20 13v6H4z", rocket: "M5 15c-1 1-2 4-2 6 2 0 5-1 6-2M14 4c4 0 6 2 6 6l-7 7-6-6zM15 9h.01",
};
export function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "18"); svg.setAttribute("height", "18"); svg.setAttribute("class", "ic");
  svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.8"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", ICONS[name] || ""); svg.append(p);
  return svg;
}

/* ---- Loading placeholders ---- */
// Shaped like the screen that is coming (same cards, grids and spacing), so nothing jumps when the
// real content replaces it. They fade in after a short delay, so a fast load shows no flash.
const bar = (cls, w) => h("span", { class: `sk${cls ? ` sk--${cls}` : ""}`, style: w ? `width:${w}` : null });
const skRows = (n) => Array.from({ length: n }, (_, i) => h("div", { class: "sk-row" }, bar("pill"), bar("", `${[46, 34, 52, 28, 40, 36][i % 6]}%`), h("span", { class: "spacer" }), bar("", "88px")));
const skHead = () => h("div", { class: "page-head" }, h("div", { class: "sk-stack" }, bar("title", "260px"), bar("", "min(380px, 70vw)")));
export function skeleton(kind = "page", label = "Loading") {
  let body;
  if (kind === "dashboard") body = [skHead(),
    h("div", { class: "grid grid--4", style: "margin-bottom:16px" }, Array.from({ length: 4 }, () => h("div", { class: "card sk-stack" }, bar("", "55%"), bar("num", "56px"), bar("pill", "72px")))),
    h("div", { class: "card" }, bar("h2", "120px"), skRows(4))];
  else if (kind === "list") body = [skHead(), h("div", { class: "filters" }, bar("search"), bar("input", "190px"), bar("input", "190px")), h("div", { class: "table-wrap sk-table" }, skRows(6))];
  else if (kind === "table") body = h("div", { class: "table-wrap sk-table" }, skRows(6));
  else if (kind === "editor") body = [
    h("div", { class: "editor-head" }, h("div", { class: "titlebox sk-stack" }, bar("", "90px"), bar("title", "min(320px, 60vw)")), bar("btn"), bar("btn")),
    h("div", { class: "editor-grid" },
      h("div", {}, h("div", { class: "tabs" }, bar("tab"), bar("tab"), bar("tab")),
        h("div", { class: "card" }, bar("h2", "140px"), Array.from({ length: 4 }, (_, i) => h("div", { class: "field sk-stack" }, bar("", `${[90, 120, 70, 110][i]}px`), bar(i === 3 ? "area" : "input"))))),
      h("aside", { class: "side" }, h("div", { class: "card sk-stack" }, bar("", "60px"), bar("pill", "80px"), bar("", "90%"), bar("", "70%"))))];
  else if (kind === "rows") body = h("div", { class: "card" }, bar("h2", "140px"), skRows(3));
  else body = [skHead(), h("div", { class: "card" }, skRows(5))];
  return h("div", { class: `sk-wrap sk-wrap--${kind}`, role: "status", "aria-busy": "true" }, h("span", { class: "sr-only" }, `${label}…`), body);
}

/* ---- API ---- */
export class ApiError extends Error {
  constructor(status, error = {}) {
    super(error.message || `Request failed (${status}).`);
    this.status = status; this.code = error.code; this.errors = error.errors || {}; this.current = error.current; this.requestId = error.request_id; this.problems = error.problems;
  }
}
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method, credentials: "same-origin",
      headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(method !== "GET" ? { "x-cms-csrf": "1" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { message: "The CMS could not be reached. Check your internet connection. Nothing was saved." });
  }
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error || {});
    if (res.status === 401 && !path.startsWith("/api/auth")) onUnauthorized();
    throw err;
  }
  return data;
}

/* ---- Feedback ---- */
export function toast(message, kind = "info", ms = 5000) {
  const box = document.getElementById("toasts");
  const close = h("button", { type: "button", "aria-label": "Dismiss" }, "×");
  const t = h("div", { class: `toast toast--${kind}`, role: kind === "error" ? "alert" : "status" }, h("span", {}, message), close);
  close.addEventListener("click", () => t.remove());
  box.append(t);
  if (ms) setTimeout(() => t.remove(), kind === "error" ? Math.max(ms, 9000) : ms);
  return t;
}
export function errorText(e) {
  if (!(e instanceof ApiError)) return e?.message || String(e);
  return e.requestId && e.status >= 500 ? `${e.message} (reference ${e.requestId})` : e.message;
}

// Modal dialog. Resolves { ok, value } (value: text of the optional note field).
export function dialog({ title, body, confirm = "Confirm", cancel = "Cancel", danger = false, note = null, wide = false, content = null }) {
  return new Promise((resolve) => {
    const textarea = note ? h("textarea", { class: "input", id: "dlg-note", rows: 3, placeholder: note.placeholder || "" }) : null;
    const err = h("p", { class: "error", hidden: true });
    const okBtn = h("button", { class: `btn ${danger ? "btn--danger" : ""}`, type: "submit", value: "ok" }, confirm);
    const d = h("dialog", { class: wide ? "wide" : "" },
      h("form", { method: "dialog", class: "dlg" },
        h("h2", {}, title),
        body ? (typeof body === "string" ? h("p", { class: "muted" }, body) : body) : null,
        content,
        note ? h("div", { class: "field" }, h("label", { for: "dlg-note" }, note.label, note.required ? h("span", { class: "req" }, " *") : null), textarea, err) : null,
        h("div", { class: "row" }, cancel ? h("button", { class: "btn btn--light", type: "button", value: "cancel", onclick: () => d.close("cancel") }, cancel) : null, confirm ? okBtn : null)));
    d.querySelector("form").addEventListener("submit", (ev) => {
      if (note?.required && textarea.value.trim().length < 3) { ev.preventDefault(); err.hidden = false; err.textContent = "Please add a short note."; textarea.focus(); return; }
      d.returnValue = "ok";
    });
    d.addEventListener("close", () => { resolve({ ok: d.returnValue === "ok", value: textarea?.value.trim() || "" }); d.remove(); });
    document.body.append(d);
    d.showModal();
    (textarea || okBtn).focus();
  });
}

export async function busy(btn, fn) {
  if (btn) { btn.classList.add("is-busy"); btn.disabled = true; }
  try { return await fn(); } finally { if (btn) { btn.classList.remove("is-busy"); btn.disabled = false; } }
}

/* ---- Formatting ---- */
// Statuses from the earlier review workflow (old History rows) show as Draft, as they are read.
export function statusBadge(status) {
  const s = STATUSES[statusOf(status)];
  return h("span", { class: `badge badge--${s.tone}`, title: s.help || "" }, s.label);
}
export const liveBadge = (live) => (!live ? null : live.hidden
  ? h("span", { class: "badge badge--yellow", title: `Version ${live.version} is published but “Show on the website” is off` }, "Hidden")
  : h("span", { class: "badge badge--live", title: `Version ${live.version} is on the website` }, `Live · v${live.version}`));
export const roleLabel = (r) => ROLES[r]?.label || r;
export function when(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400 && d.getDate() === new Date().getDate()) return `today ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}
export const who = (email) => (email ? (String(email).startsWith("system:") ? "Import" : String(email).split("@")[0]) : "—");
