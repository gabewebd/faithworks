// Form submissions (Super Admins): everything sent through the website's forms, from whichever
// provider delivered it. Read from the CMS database through /api/submissions; the API refuses
// anyone who is not a Super Admin, whatever this screen shows.
import { h, clear, api, toast, busy, errorText, when, who, icon, skeleton } from "./dom.mjs";
import { selectBox, datePicker } from "./controls.mjs";
import { FORMS, FORM_IDS, formLabel, answerLabel, SUBMISSION_STATUSES, SUBMISSION_KINDS, DELIVERY_STATES } from "/shared/forms.mjs";

const STATUS_TONE = { new: "pink", in_progress: "yellow", completed: "green" };
const DELIVERY_TONE = { pending: "yellow", sending: "yellow", sent: "green", failed: "red", off: "stone" };
const PROVIDERS = { cms_endpoint: "Website form (CMS endpoint)", netlify_forms: "Netlify Forms" };

const statusBadge = (s) => h("span", { class: `badge badge--${STATUS_TONE[s] || "stone"}` }, SUBMISSION_STATUSES[s] || s);
const kindBadge = (k) => (k === "spam" ? h("span", { class: "badge badge--red", title: "Marked as spam" }, "Spam") : k === "test" ? h("span", { class: "badge badge--stone", title: "A test submission, not a real inquiry" }, "Test") : null);
const fullDate = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");
const pageHead = (title, sub, ...actions) => h("div", { class: "page-head" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null), actions.length ? h("div", { class: "row" }, actions) : null);

// What is not set up yet, in plain words (the details are in cms/README.md §13).
function setupNotes(s) {
  if (!s) return null;
  const notes = [];
  if (!s.endpoint) notes.push("The website cannot send submissions yet: FORMS_ALLOWED_ORIGINS is not set on the CMS, and the website forms are still in preview mode.");
  if (!s.email) notes.push("Email alerts are off: RESEND_API_KEY, FORMS_EMAIL_FROM and FORMS_NOTIFY_TO are not all set. Submissions are still saved here.");
  for (const p of s.problems || []) notes.push(p);
  return notes.length ? h("div", { class: "alert alert--warn", style: "margin-bottom:16px" }, h("div", {}, h("p", {}, h("strong", {}, "Setup")), h("ul", { class: "small" }, notes.map((n) => h("li", {}, n))))) : null;
}

/* ---- List ---- */
export async function submissionsView() {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const q = h("input", { class: "input", type: "search", placeholder: "Search names, emails and answers…", "aria-label": "Search submissions" });
  q.value = params.get("q") || "";
  const form = selectBox({ label: "Filter by form", value: params.get("form") || "", onChange: () => load(), options: [{ value: "", label: "All forms" }, ...FORM_IDS.map((id) => ({ value: id, label: formLabel(id) }))] });
  const status = selectBox({ label: "Filter by status", value: params.get("status") || "", onChange: () => load(), options: [{ value: "", label: "All statuses" }, ...Object.entries(SUBMISSION_STATUSES).map(([value, label]) => ({ value, label }))] });
  const kind = selectBox({ label: "Filter by type", value: params.get("kind") ?? "not_spam", onChange: () => load(), options: [{ value: "not_spam", label: "Genuine and test" }, { value: "genuine", label: "Genuine only" }, { value: "test", label: "Test only" }, { value: "spam", label: "Spam" }, { value: "", label: "Everything" }] });
  const from = datePicker({ value: params.get("from") || "", onChange: () => load() });
  const to = datePicker({ value: params.get("to") || "", onChange: () => load() });
  const notes = h("div", {});
  const body = h("div", { class: "list-body" }, skeleton("table"));
  let timer;

  async function load() {
    const filters = { q: q.value, form: form.get(), status: status.get(), kind: kind.get(), from: from.get(), to: to.get() };
    const qs = new URLSearchParams(Object.entries(filters).filter(([k, v]) => v || (k === "kind" && v === "")));
    if (filters.kind === "not_spam") qs.delete("kind");
    history.replaceState(null, "", `#/submissions${qs.toString() ? `?${qs}` : ""}`);
    if (filters.kind === "not_spam") qs.set("kind", "not_spam");
    body.setAttribute("aria-busy", "true");
    try {
      const d = await api("GET", `/api/submissions?${qs}`);
      clear(notes, setupNotes(d.setup));
      const filtered = filters.q || filters.form || filters.status || filters.from || filters.to;
      clear(body, d.items.length ? [h("div", { class: "table-wrap" }, h("table", { class: "table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Received"), h("th", {}, "From"), h("th", {}, "Form"), h("th", {}, "Status"), h("th", {}, ""))),
        h("tbody", {}, d.items.map((r) => h("tr", { onclick: (e) => { if (!e.target.closest("a")) location.hash = `#/submissions/${encodeURIComponent(r.id)}`; } },
          h("td", { class: "small" }, fullDate(r.received_at)),
          h("td", { class: "title" }, h("a", { href: `#/submissions/${encodeURIComponent(r.id)}` }, r.name || "(no name)"), h("div", { class: "small muted" }, r.email || "")),
          h("td", { class: "small" }, formLabel(r.form_id)),
          h("td", {}, statusBadge(r.status)),
          h("td", {}, h("div", { class: "row", style: "gap:6px" }, kindBadge(r.kind),
            r.has_error ? h("span", { class: "badge badge--red", title: "The email alert or the Google Sheets copy failed. Open the submission to retry." }, "Delivery failed") : null))))))),
        d.truncated ? h("p", { class: "small muted", style: "margin-top:10px" }, "Showing the latest 1,000 matches. Narrow the dates to see older ones.") : null]
        : h("div", { class: "card empty" }, h("h3", {}, filtered ? "Nothing matches these filters" : "No submissions yet"), h("p", {}, filtered ? "Try clearing the search or filters." : "Submissions from the website's forms will appear here.")));
    } catch (e) { clear(body, h("div", { class: "alert alert--error" }, h("div", {}, errorText(e)))); }
    body.removeAttribute("aria-busy");
  }
  q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  load();
  return h("div", {}, pageHead("Form submissions", "Everything sent through the website's forms. Only Super Admins can see this page."),
    notes,
    h("div", { class: "filters" }, q, form.el, status.el, kind.el),
    h("div", { class: "filters" }, h("label", { class: "small muted" }, "From"), from.el, h("label", { class: "small muted" }, "To"), to.el),
    body);
}

/* ---- One submission ---- */
export async function submissionView(app, { id }) {
  const wrap = h("div", {});
  async function render(s) {
    const form = FORMS[s.form_id];
    const fieldRows = (form ? form.fields.map((f) => f.name) : []).concat(Object.keys(s.answers || {}).filter((k) => !form?.fields.some((f) => f.name === k)))
      .filter((k) => s.answers?.[k] !== undefined)
      .map((k) => [h("dt", {}, form?.fields.find((f) => f.name === k)?.label || k), h("dd", { style: "white-space:pre-wrap" }, answerLabel(s.form_id, k, s.answers[k]))]);
    const c = s.context || {};
    const contextRows = [
      ["Offer", [c.offer_title, c.offer_id ? `(${c.offer_id})` : ""].filter(Boolean).join(" ")],
      ["Sent from page", c.source_page],
      ["Campaign (UTM)", Object.entries(c.utm || {}).map(([k, v]) => `${k.replace("utm_", "")}: ${v}`).join(" · ")],
      ["Marketing consent", c.consent ? (c.consent.marketing === "yes" ? `Yes (${c.consent.wording_version || "wording version not recorded"})` : "No") : ""],
    ].filter(([, v]) => v).map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]);

    const setStatus = (value) => async (e) => busy(e.currentTarget, async () => {
      try { render(await api("PUT", `/api/submissions/${encodeURIComponent(s.id)}`, { status: value })); toast(`Marked as ${SUBMISSION_STATUSES[value]}.`, "ok"); } catch (err) { toast(errorText(err), "error"); }
    });
    const kindSel = selectBox({ label: "Type", value: s.kind, options: Object.entries(SUBMISSION_KINDS).map(([value, label]) => ({ value, label })), onChange: async (v) => {
      try { render(await api("PUT", `/api/submissions/${encodeURIComponent(s.id)}`, { kind: v })); toast(`Marked as ${SUBMISSION_KINDS[v]}.`, "ok"); } catch (err) { toast(errorText(err), "error"); }
    } });

    const delivery = (label, state, attempts, error, at) => [h("dt", {}, label), h("dd", {},
      h("span", { class: `badge badge--${DELIVERY_TONE[state] || "stone"}` }, DELIVERY_STATES[state] || state),
      attempts ? h("span", { class: "small muted" }, ` ${attempts} attempt(s)`) : null,
      at ? h("span", { class: "small muted" }, ` · ${fullDate(at)}`) : null,
      error ? h("div", { class: "small", style: "color:var(--red)" }, error) : null)];
    const retryable = ["failed", "pending", "sending"].includes(s.notify_state) || ["failed", "pending", "sending"].includes(s.sheets_state);
    const retry = retryable ? h("button", { class: "btn btn--light btn--sm", type: "button", onclick: (e) => busy(e.currentTarget, async () => {
      try {
        const r = await api("POST", `/api/submissions/${encodeURIComponent(s.id)}/retry`, {});
        render(r.submission);
        const failed = r.result.notify === false || r.result.sheets === false;
        toast(failed ? "Retried, but it failed again. See the error below." : "Retried.", failed ? "error" : "ok");
      } catch (err) { toast(errorText(err), "error"); }
    }) }, "Retry now") : null;

    clear(wrap,
      h("p", {}, h("a", { class: "icon-link", href: "#/submissions" }, icon("left"), "All submissions")),
      pageHead(s.name || "(no name)", `${formLabel(s.form_id)} · received ${fullDate(s.received_at)}`),
      setupNotes(s.setup),
      s.kind === "spam" ? h("div", { class: "alert alert--error", style: "margin-bottom:16px" }, h("div", {}, h("p", {}, h("strong", {}, "Marked as spam. "), s.spam_reason || "Marked by a Super Admin.", " No email alert was sent."))) : null,
      s.kind === "test" ? h("div", { class: "alert alert--info", style: "margin-bottom:16px" }, h("div", {}, h("p", {}, h("strong", {}, "Test submission. "), "Not a real inquiry."))) : null,
      h("div", { class: "card" }, h("h2", {}, "Status"),
        h("div", { class: "row", role: "group", "aria-label": "Status" }, Object.entries(SUBMISSION_STATUSES).map(([value, label]) =>
          h("button", { class: `btn btn--sm ${s.status === value ? "" : "btn--light"}`, type: "button", "aria-pressed": String(s.status === value), onclick: s.status === value ? null : setStatus(value) }, label))),
        h("div", { class: "field", style: "margin-top:14px;max-width:260px" }, h("label", {}, "Type"), kindSel.el),
        s.updated_by && s.updated_by !== "system" ? h("p", { class: "small muted" }, `Last changed ${when(s.updated_at)} by ${who(s.updated_by)}.`) : null),
      h("div", { class: "card", style: "margin-top:16px" }, h("h2", {}, "Submitted details"),
        h("dl", { class: "kv" }, fieldRows.length ? fieldRows : [h("dt", {}, "Answers"), h("dd", { class: "muted" }, "None")]),
        c.validation_errors?.length ? h("div", { class: "alert alert--warn", style: "margin-top:12px" }, h("div", {}, h("p", {}, h("strong", {}, "Some answers did not pass the website's checks and were not kept: ")), h("ul", { class: "small" }, c.validation_errors.map((x) => h("li", {}, x.message))))) : null),
      contextRows.length ? h("div", { class: "card", style: "margin-top:16px" }, h("h2", {}, "Context"), h("dl", { class: "kv" }, contextRows)) : null,
      h("div", { class: "card", style: "margin-top:16px" }, h("div", { class: "row" }, h("h2", { style: "margin:0" }, "Delivery"), h("span", { class: "spacer" }), retry),
        h("dl", { class: "kv" },
          delivery("Email alert", s.notify_state, s.notify_attempts, s.notify_error, s.notified_at),
          delivery("Google Sheets copy", s.sheets_state, s.sheets_attempts, s.sheets_error, s.sheets_at))),
      h("div", { class: "card", style: "margin-top:16px" }, h("h2", {}, "Record"),
        h("dl", { class: "kv small" },
          h("dt", {}, "Received through"), h("dd", {}, PROVIDERS[s.provider] || s.provider),
          h("dt", {}, "Provider id"), h("dd", { class: "mono" }, s.provider_id),
          h("dt", {}, "Submission id"), h("dd", { class: "mono" }, s.id),
          h("dt", {}, "Sent (browser time)"), h("dd", {}, fullDate(s.submitted_at)))));
  }
  await render(await api("GET", `/api/submissions/${encodeURIComponent(id)}`));
  return wrap;
}
