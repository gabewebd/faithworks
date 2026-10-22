// Dashboard shell: sign-in, role-based navigation, hash router and unsaved-change guard.
// Navigation only mirrors permissions; the server enforces them on every request.
import { h, clear, api, toast, errorText, roleLabel, icon, skeleton, setUnauthorizedHandler, dialog } from "./dom.mjs";
import { COLLECTIONS, CONTENT_COLLECTIONS, isSuperAdmin } from "/shared/schema.mjs";
import { editorView } from "./editor.mjs";
import { dashboardView, listView, tagsView, usersView, activityView, recoveryView } from "./views.mjs";
import { submissionsView, submissionView } from "./submissions.mjs";

const appEl = document.getElementById("app");
const app = { user: null, config: {}, current: null, lastHash: location.hash, reload: () => route(true), refreshCounts: () => {} };

const LOGIN_ERRORS = {
  not_authorized: "Your Google account is not on the CMS user list. Ask a Super Admin to add you.",
  expired: "The sign-in took too long or was interrupted. Please try again.",
  cancelled: "Sign-in was cancelled.", unverified: "Your Google email address is not verified.",
  domain: "This email domain is not allowed to sign in.", google: "Google sign-in failed. Please try again.",
};

async function start() {
  let session;
  try { session = await api("GET", "/api/session"); } catch (e) {
    clear(appEl, h("div", { class: "login" }, h("div", { class: "card" }, h("h1", {}, "The CMS is not available"), h("p", {}, errorText(e)),
      e.problems ? h("ul", { class: "small" }, e.problems.map((p) => h("li", {}, p))) : null)));
    return;
  }
  app.config = session.config;
  if (!session.user) return login();
  app.user = session.user;
  setUnauthorizedHandler(() => { toast("Your session ended. Please sign in again.", "error"); login(); });
  try { const s = await api("GET", "/api/records/settings/site"); app.config.siteOrigin = s.record.origin; } catch { /* authors cannot read settings */ }
  window.addEventListener("hashchange", () => route());
  window.addEventListener("beforeunload", (e) => { if (app.current?.isDirty?.()) { e.preventDefault(); e.returnValue = ""; } });
  route();
}

/* ---- Sign-in ---- */
async function login() {
  const params = new URLSearchParams(location.search);
  const err = params.get("login_error");
  if (err) history.replaceState(null, "", location.pathname + location.hash);
  const card = h("div", { class: "card" },
    h("div", { class: "brand" }, h("b", {}, "Faith Works"), h("span", {}, "CMS")),
    h("h1", {}, "Sign in"),
    h("p", { class: "muted" }, "Manage programs, events, resources, testimonials and site settings for faithph.ai."),
    err ? h("div", { class: "alert alert--error" }, h("div", {}, LOGIN_ERRORS[err] || "Sign-in failed.")) : null,
    h("a", { class: "btn google", href: "/api/auth/google/start" }, googleMark(), "Continue with Google"),
    h("p", { class: "small muted", style: "margin-top:14px" }, "Only people added by a Super Admin can sign in. The CMS never stores passwords."));
  clear(appEl, h("main", { class: "login" }, card));
  if (app.config.devLogin) {
    try {
      const users = await api("GET", "/api/auth/dev-users");
      card.append(h("div", { class: "devusers" }, h("p", { class: "small" }, h("strong", {}, "Local development: "), "sign in as a test user (not available on hosted deployments)."),
        users.map((u) => h("button", { class: "btn btn--light", type: "button", onclick: async () => {
          try { await api("POST", "/api/auth/dev-login", { email: u.email }); location.hash = "#/"; location.reload(); } catch (e) { toast(errorText(e), "error"); }
        } }, h("span", {}, u.name), h("span", { class: "small muted" }, roleLabel(u.role))))));
    } catch { /* not available */ }
  }
}
function googleMark() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 48 48"); s.setAttribute("width", "18"); s.setAttribute("height", "18"); s.setAttribute("aria-hidden", "true");
  for (const [d, c] of [["M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z", "#FFC107"], ["M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z", "#FF3D00"], ["M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z", "#4CAF50"], ["M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z", "#1976D2"]]) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); p.setAttribute("fill", c); s.append(p);
  }
  return s;
}

/* ---- Shell ---- */
function shell(content, active, loading = false) {
  const admin = isSuperAdmin(app.user.role);
  const navLink = (href, ic, label, key) => h("a", { href, "aria-current": active === key ? "page" : null, onclick: () => shellEl.classList.remove("nav-open") }, icon(ic), label);
  const icons = { programs: "book", events: "calendar", resources: "file", testimonials: "quote" };
  const nav = h("nav", { class: "nav", "aria-label": "CMS" },
    navLink("#/", "home", "Dashboard", "dashboard"),
    h("p", { class: "nav-label" }, "Content"),
    CONTENT_COLLECTIONS.map((c) => navLink(`#/c/${c}`, icons[c], COLLECTIONS[c].label, c)),
    admin ? [h("p", { class: "nav-label" }, "Inbox"), navLink("#/submissions", "inbox", "Form submissions", "submissions")] : null,
    admin ? [h("p", { class: "nav-label" }, "Site"), navLink("#/c/settings/site", "settings", "Site settings", "settings"), navLink("#/tags", "tag", "Tags", "tags"), navLink("#/activity", "log", "Activity log", "activity")] : null,
    admin ? [h("p", { class: "nav-label" }, "Administration"), navLink("#/users", "users", "Users and roles", "users"), navLink("#/recovery", "shield", "Recovery and backup", "recovery")] : null);
  const logout = h("button", { type: "button", onclick: async () => { if (app.current?.isDirty?.() && !(await dialog({ title: "Sign out?", body: "You have unsaved changes that will be lost.", confirm: "Sign out", danger: true })).ok) return; await api("POST", "/api/auth/logout", {}).catch(() => {}); location.hash = ""; location.reload(); } }, "Sign out");
  const sidebar = h("aside", { class: "sidebar", id: "sidebar" }, h("div", { class: "brand" }, h("b", {}, "Faith Works"), h("span", {}, "CMS")), nav,
    h("div", { class: "me" }, h("b", {}, app.user.name), h("span", { class: "role" }, roleLabel(app.user.role)), h("div", { class: "small", style: "opacity:.7;overflow:hidden;text-overflow:ellipsis" }, app.user.email), logout));
  const topbar = h("div", { class: "topbar" }, h("button", { type: "button", "aria-controls": "sidebar", "aria-label": "Open menu", onclick: () => shellEl.classList.toggle("nav-open") }, icon("menu")), h("b", {}, "Faith Works CMS"));
  const envNote = app.config.store === "json" ? h("div", { class: "env-note" }, "Development mode: content is saved to a local JSON file, not the Supabase database.") : null;
  const shellEl = h("div", { class: `shell${loading ? " is-loading" : ""}` }, sidebar, h("div", { class: "main" }, topbar, envNote, h("main", { class: "page", id: "page", tabindex: "-1" }, content)));
  return shellEl;
}

/* ---- Router ---- */
// While a screen loads: its nav item is already highlighted and a placeholder of its shape is shown.
const pendingActive = (p) => (!p.length ? "dashboard" : p[0] === "c" ? (p[1] === "settings" ? "settings" : p[1]) : p[0]);
const skeletonKind = (p) => (!p.length ? "dashboard" : p[0] === "c" ? (p[1] === "settings" || p[2] ? "editor" : "list") : "page");
// Super Admin screens. A direct link from an Author gets "No access" here, and the API refuses
// the same requests on its own (this check only avoids showing controls that would fail).
const ADMIN_ROUTES = new Set(["tags", "users", "activity", "recovery", "submissions"]);
const noAccess = () => ({ el: h("div", { class: "alert alert--error" }, h("div", {}, h("p", {}, h("strong", {}, "No access. "), "Only Super Admins can open this page. ", h("a", { href: "#/" }, "Back to the dashboard")))) });

async function route(force = false) {
  const hash = location.hash || "#/";
  if (!force && app.current?.isDirty?.() && hash !== app.lastHash) {
    const r = await dialog({ title: "Leave without saving?", body: "You have unsaved changes on this page.", confirm: "Leave without saving", cancel: "Stay", danger: true });
    if (!r.ok) { history.replaceState(null, "", app.lastHash); return; }
  }
  app.lastHash = hash;
  const path = hash.slice(1).split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  let view, active = pendingActive(path);
  clear(appEl, shell(skeleton(skeletonKind(path)), active, true));
  try {
    if ((ADMIN_ROUTES.has(path[0]) || (path[0] === "c" && path[1] === "settings")) && !isSuperAdmin(app.user.role)) view = noAccess();
    else if (!path.length) { active = "dashboard"; view = { el: await dashboardView(app) }; }
    else if (path[0] === "c" && COLLECTIONS[path[1]]) {
      const collection = path[1];
      active = collection;
      if (collection === "settings") { active = "settings"; view = await editorView(app, { collection, id: "site" }); }
      else if (!path[2]) view = { el: await listView(app, { collection }) };
      else view = await editorView(app, { collection, id: path[2] === "new" ? null : path[2] });
    }
    else if (path[0] === "tags") { active = "tags"; view = { el: await tagsView(app) }; }
    else if (path[0] === "users") { active = "users"; view = { el: await usersView(app) }; }
    else if (path[0] === "activity") { active = "activity"; view = { el: await activityView(app) }; }
    else if (path[0] === "recovery") { active = "recovery"; view = { el: await recoveryView(app) }; }
    else if (path[0] === "submissions") { active = "submissions"; view = { el: path[1] ? await submissionView(app, { id: path[1] }) : await submissionsView(app) }; }
    else view = { el: h("div", { class: "card empty" }, h("h3", {}, "Page not found"), h("p", {}, h("a", { href: "#/" }, "Back to the dashboard"))) };
  } catch (e) {
    if (e.status === 401) return;
    view = { el: h("div", { class: "alert alert--error" }, h("div", {}, h("p", {}, h("strong", {}, e.status === 403 ? "No access. " : "Could not load this page. "), errorText(e)))) };
  }
  app.current = view;
  clear(appEl, shell(view.el, active));
  if (!force) document.getElementById("page")?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

start();
