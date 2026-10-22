// Website lead forms: one definition for the form markup (tools/render.mjs builds the fields
// from it) and for the server that accepts submissions (cms/server/forms/). Labels, options and
// limits are therefore the same in the browser and on the server, and a field the website does
// not have is never stored.
//
// Field shape: name, label, type (text | email | tel | number | date | select | textarea),
// required (default true), maxlength, options (strings, { value, label }, or "events" for the
// event list the website fills in), plus presentation-only keys (half, placeholder, hint, rows,
// autocomplete, inputmode, min).

export const ROLES = ["Founder/Business Owner", "Professional/Freelancer", "Team/HR Leader", "Other"];

export const FORMS = {
  starter_kit: {
    label: "Starter Kit request",
    nameField: "first_name",
    hidden: ["lead_magnet_version"],
    fields: [
      { name: "first_name", label: "First name", autocomplete: "given-name", maxlength: 80 },
      { name: "email", label: "Email address", type: "email", autocomplete: "email", inputmode: "email" },
      { name: "role", label: "Your role", type: "select", required: false, options: ROLES },
    ],
  },
  program_interest: {
    label: "Program interest",
    nameField: "first_name",
    fields: [
      { name: "first_name", label: "First name", autocomplete: "given-name", maxlength: 80, half: true },
      { name: "email", label: "Email address", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "role", label: "Your role", type: "select", required: false, options: ROLES },
      { name: "goal", label: "What would you like to improve?", type: "textarea", required: false, rows: 3, placeholder: "One task or outcome that matters to you" },
    ],
  },
  corporate_inquiry: {
    label: "Corporate inquiry",
    nameField: "name",
    fields: [
      { name: "name", label: "Name", autocomplete: "name", half: true },
      { name: "email", label: "Work email", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "company", label: "Company", autocomplete: "organization", half: true },
      { name: "job_role", label: "Your role", autocomplete: "organization-title", half: true },
      { name: "team_size", label: "Team size", type: "select", options: ["2–10", "11–50", "51–200", "200+"], half: true },
      { name: "format", label: "Preferred format", type: "select", required: false, options: ["Open to a recommendation", "Online", "In person", "Hybrid"], half: true },
      { name: "goals", label: "What are your goals for your team?", type: "textarea", rows: 4 },
      { name: "preferred_date", label: "Preferred date or timing", required: false, half: true, placeholder: "For example, Q1 2027" },
      { name: "budget", label: "Budget range", required: false, half: true, placeholder: "A range is fine" },
    ],
  },
  speaking_inquiry: {
    label: "Speaking or partnership inquiry",
    nameField: "name",
    fields: [
      { name: "organization", label: "Organization", autocomplete: "organization", half: true },
      { name: "name", label: "Contact name", autocomplete: "name", half: true },
      { name: "email", label: "Email", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "event_name", label: "Event name", half: true },
      { name: "event_date", label: "Event date", type: "date", half: true },
      { name: "location", label: "Location", placeholder: "City and venue, or online", half: true },
      { name: "audience_size", label: "Audience size", type: "number", inputmode: "numeric", min: "1", half: true },
      { name: "requested_format", label: "Requested format", type: "select", half: true, options: ["Learn with Faith (workshop or training)", "Hear from Faith (keynote or talk)", "Partner with Faith (brand partnership)", "Not sure yet"] },
      { name: "audience_profile", label: "Who is the audience?", type: "textarea", rows: 3 },
      { name: "budget", label: "Budget", required: false, placeholder: "A range is fine" },
    ],
  },
  faith_ai_demo: {
    label: "Faith AI demo request",
    nameField: "name",
    fields: [
      { name: "name", label: "Name", autocomplete: "name", half: true },
      { name: "email", label: "Work email", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "company", label: "Company", autocomplete: "organization" },
      { name: "use_case", label: "Which business process needs support?", type: "textarea", rows: 3, placeholder: "For example, inquiry tracking or follow-up" },
      { name: "tools", label: "Tools you use today", required: false },
    ],
  },
  general_contact: {
    label: "General contact",
    nameField: "name",
    fields: [
      { name: "name", label: "Name", autocomplete: "name", half: true },
      { name: "email", label: "Email", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "inquiry_type", label: "Inquiry type", type: "select", half: true, options: [
        { value: "programs", label: "Programs and workshops" }, { value: "corporate", label: "Corporate training" },
        { value: "speaking", label: "Speaking and partnerships" }, { value: "faith-ai", label: "Faith AI" },
        { value: "other", label: "Something else" }] },
      { name: "phone", label: "Phone", type: "tel", autocomplete: "tel", required: false, half: true },
      { name: "message", label: "Message", type: "textarea", rows: 5 },
    ],
  },
  event_notify: {
    label: "Event notification request",
    nameField: "first_name",
    fields: [
      { name: "first_name", label: "First name", autocomplete: "given-name", maxlength: 80, half: true },
      { name: "email", label: "Email address", type: "email", autocomplete: "email", inputmode: "email", half: true },
      { name: "event_interest", label: "Tell me about", type: "select", required: false, placeholder: "Any upcoming workshop or event", options: "events" },
    ],
  },
};

export const FORM_IDS = Object.keys(FORMS);
export const formLabel = (id) => FORMS[id]?.label || id;

// Team workflow on a submission, and what kind of record it is.
export const SUBMISSION_STATUSES = { new: "New", in_progress: "In Progress", completed: "Completed" };
export const SUBMISSION_KINDS = { genuine: "Genuine", spam: "Spam", test: "Test" };
// Delivery of the team email and of the Google Sheets copy.
export const DELIVERY_STATES = { pending: "Pending", sending: "Sending", sent: "Sent", failed: "Failed", off: "Not configured" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,119}$/i;
// Control characters except tab and line breaks.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const clean = (v, multiline) => {
  let s = String(v ?? "").replace(CONTROL, "").normalize("NFC");
  if (!multiline) s = s.replace(/\s+/g, " ");
  return s.trim();
};
export const optionValue = (o) => (typeof o === "string" ? o : o.value);
const limitOf = (f) => f.maxlength || (f.type === "textarea" ? 3000 : 160);

// Validates and normalises the answers of one form. Unknown keys are dropped; nothing is
// coerced silently into a different value. Returns { answers, errors: [{ field, message }] }.
export function validateAnswers(formId, input) {
  const form = FORMS[formId];
  if (!form) return { answers: {}, errors: [{ field: "form_id", message: "Unknown form." }] };
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const answers = {};
  const errors = [];
  for (const f of form.fields) {
    const v = clean(src[f.name], f.type === "textarea");
    const required = f.required !== false;
    if (!v) { if (required) errors.push({ field: f.name, message: `${f.label} is required.` }); continue; }
    if (v.length > limitOf(f)) { errors.push({ field: f.name, message: `${f.label} is too long.` }); continue; }
    if (f.type === "email" && !EMAIL.test(v)) { errors.push({ field: f.name, message: "Enter a valid email address." }); continue; }
    if (f.type === "number" && (!/^\d+$/.test(v) || Number(v) < Number(f.min || 0))) { errors.push({ field: f.name, message: `${f.label} must be a number.` }); continue; }
    if (f.type === "date" && (!DATE.test(v) || Number.isNaN(Date.parse(v)))) { errors.push({ field: f.name, message: `${f.label} must be a date.` }); continue; }
    if (f.type === "select") {
      const ok = f.options === "events" ? TOKEN.test(v) : f.options.some((o) => optionValue(o) === v);
      if (!ok) { errors.push({ field: f.name, message: `Choose one of the options for ${f.label}.` }); continue; }
    }
    answers[f.name] = f.type === "email" ? v.toLowerCase() : v;
  }
  for (const k of form.hidden || []) {
    const v = clean(src[k]);
    if (v) answers[k] = v.slice(0, 80);
  }
  return { answers, errors };
}

// Plain-text view of a value for lists, emails and spreadsheets.
export function answerLabel(formId, name, value) {
  const f = FORMS[formId]?.fields.find((x) => x.name === name);
  if (!f || f.type !== "select" || !Array.isArray(f.options)) return value;
  const o = f.options.find((x) => optionValue(x) === value);
  return o ? (typeof o === "string" ? o : o.label) : value;
}
