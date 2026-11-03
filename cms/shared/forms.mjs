// Website lead forms: the fields of the site's own designed form markup (tools/render.mjs). The
// live forms are GoHighLevel embeds, and GoHighLevel stores what visitors send; the CMS does not
// accept submissions.
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

export const optionValue = (o) => (typeof o === "string" ? o : o.value);
