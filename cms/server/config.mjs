// CMS configuration from environment variables (see cms/.env.example). Fails closed: on a
// hosted deployment (Vercel/Netlify) every security-relevant setting must be present, content
// is stored in Supabase (the source of truth for CMS content) and the development login cannot
// be switched on. The Google Sheets settings are still read: the Sheets integration is kept for
// other workflows and as an explicit rollback store (CMS_STORE=sheets), never as a fallback.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DEFAULT_IFRAME_HOSTS } from "../shared/sanitize-html.mjs";

const CMS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const list = (s) => String(s || "").split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

export function loadConfig(env = process.env) {
  const hosted = !!(env.VERCEL || env.NETLIFY);
  const production = hosted || env.NODE_ENV === "production";
  const errors = [];
  const store = (env.CMS_STORE || (hosted ? "supabase" : "json")).toLowerCase();

  // Private keys pasted into env UIs usually arrive with literal "\n".
  let privateKey = env.GOOGLE_PRIVATE_KEY ? env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n") : "";
  let clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    try {
      const sa = JSON.parse(Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8"));
      privateKey ||= sa.private_key;
      clientEmail ||= sa.client_email;
    } catch { errors.push("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64 JSON."); }
  }

  // SUPABASE_SECRET_KEY (sb_secret_…) is the current name; SUPABASE_SERVICE_ROLE_KEY is still read
  // for existing deployments and is ignored when both are set.
  const supabaseKeyVar = env.SUPABASE_SECRET_KEY?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? "SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY";

  const cfg = {
    hosted, production, store,
    cmsRoot: CMS_ROOT,
    jsonPath: env.CMS_JSON_PATH || join(CMS_ROOT, ".data", "store.json"),
    seedPath: join(CMS_ROOT, "fixtures", "seed.json"),
    // Local development only (JSON store): uploaded event images go to the website's assets
    uploadDir: env.CMS_UPLOAD_DIR || join(CMS_ROOT, "..", "assets", "images", "uploads"),
    supabaseUrl: (env.SUPABASE_URL || "").replace(/\/$/, ""),
    supabaseKeyVar,
    supabaseServiceKey: (env[supabaseKeyVar] || "").trim(),
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
    clientEmail, privateKey,
    oauthClientId: env.GOOGLE_OAUTH_CLIENT_ID || "",
    oauthClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET || "",
    baseUrl: (env.CMS_BASE_URL || "").replace(/\/$/, ""),
    sessionSecret: env.CMS_SESSION_SECRET || "",
    sessionHours: Math.min(Math.max(Number(env.CMS_SESSION_HOURS) || 8, 1), 24),
    superAdmins: list(env.CMS_SUPER_ADMINS),
    allowedDomains: list(env.CMS_ALLOWED_EMAIL_DOMAINS),
    devLogin: env.CMS_DEV_LOGIN === "true" && !production,
    previewToken: env.CMS_PREVIEW_TOKEN || "",
    publicSiteUrl: (env.PUBLIC_SITE_URL || "https://faithph.ai").replace(/\/$/, ""),
    deployHookUrl: env.PUBLIC_SITE_DEPLOY_HOOK_URL || "",
    iframeHosts: env.CMS_IFRAME_HOSTS ? list(env.CMS_IFRAME_HOSTS) : DEFAULT_IFRAME_HOSTS,
    forms: formsConfig(env),
  };

  if (!["supabase", "sheets", "json"].includes(store)) errors.push(`CMS_STORE must be "supabase", "sheets" or "json" (got "${store}").`);
  if (store === "supabase") {
    if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(cfg.supabaseUrl)) errors.push("SUPABASE_URL is required for the Supabase store (https://<project-ref>.supabase.co).");
    const keyProblem = serviceKeyProblem(cfg.supabaseServiceKey, supabaseKeyVar);
    if (keyProblem) errors.push(keyProblem);
  }
  if (store === "sheets") {
    if (!cfg.spreadsheetId) errors.push("GOOGLE_SHEETS_SPREADSHEET_ID is required for the Google Sheets store.");
    if (!cfg.clientEmail || !cfg.privateKey) errors.push("Google service-account credentials are required (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64).");
  }
  if (hosted && store === "json") errors.push("Hosted deployments must use the Supabase store (CMS_STORE=supabase). The JSON store is for local development only.");
  if (production || !cfg.devLogin) {
    if (cfg.sessionSecret.length < 32) errors.push("CMS_SESSION_SECRET must be at least 32 random characters.");
    if (!cfg.oauthClientId || !cfg.oauthClientSecret) errors.push("GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required for sign-in.");
    if (!cfg.baseUrl) errors.push("CMS_BASE_URL is required (the CMS address, e.g. https://cms.faithph.ai).");
    if (!cfg.superAdmins.length) errors.push("CMS_SUPER_ADMINS must list at least one Super Admin email address (the pinned admins).");
    else if (cfg.superAdmins.some((e) => !EMAIL_ADDRESS.test(e))) errors.push("CMS_SUPER_ADMINS must contain only full email addresses, separated by commas.");
  }
  if (env.CMS_DEV_LOGIN === "true" && production) errors.push("CMS_DEV_LOGIN cannot be enabled in production. Remove it.");
  if (cfg.previewToken && cfg.previewToken.length < 32) errors.push("CMS_PREVIEW_TOKEN must be at least 32 random characters (or unset).");
  if (cfg.devLogin && !cfg.sessionSecret) cfg.sessionSecret = "local-development-only-session-secret-not-for-production";
  if (cfg.forms.sheetsMirror && (!cfg.spreadsheetId || !cfg.clientEmail || !cfg.privateKey)) {
    cfg.forms.problems.push("FORMS_SHEETS_MIRROR needs the Google Sheets settings (GOOGLE_SHEETS_SPREADSHEET_ID and the service account).");
    cfg.forms.sheetsMirror = false;
  }

  cfg.errors = errors;
  return Object.freeze(cfg);
}

// Website form submissions (server/forms/). Problems here never stop the CMS: they are listed in
// cfg.forms.problems, shown on /api/health (as a count) and on the Submissions page, and the part
// they concern stays off. The submission endpoint is off until FORMS_ALLOWED_ORIGINS is set.
const EMAIL_ADDRESS = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]{2,}$/;
export function formsConfig(env = process.env) {
  const problems = [];
  const emails = (name) => {
    const all = list(env[name]);
    const bad = all.filter((e) => !EMAIL_ADDRESS.test(e));
    if (bad.length) problems.push(`${name} has ${bad.length} invalid address(es).`);
    return all.filter((e) => EMAIL_ADDRESS.test(e));
  };
  const allowedOrigins = list(env.FORMS_ALLOWED_ORIGINS).map((o) => o.replace(/\/$/, ""));
  const badOrigins = allowedOrigins.filter((o) => !/^https:\/\/[^/]+$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
  if (badOrigins.length) problems.push("FORMS_ALLOWED_ORIGINS must list origins like https://faithph.ai (https, no path).");
  const notifyToByForm = {};
  for (const k of Object.keys(env)) {
    const m = k.match(/^FORMS_NOTIFY_TO_([A-Z0-9_]+)$/);
    if (m) notifyToByForm[m[1].toLowerCase()] = emails(k);
  }
  const f = {
    allowedOrigins: allowedOrigins.filter((o) => !badOrigins.includes(o)),
    resendKey: (env.RESEND_API_KEY || "").trim(),
    emailFrom: (env.FORMS_EMAIL_FROM || "").trim(),
    notifyTo: list(env.FORMS_NOTIFY_TO).length ? emails("FORMS_NOTIFY_TO") : [DEFAULT_NOTIFY_TO],
    notifyToByForm,
    sheetsMirror: env.FORMS_SHEETS_MIRROR === "true",
    sheetsTab: (env.FORMS_SHEETS_TAB || "form_submissions").trim(),
    netlifySecret: (env.NETLIFY_FORMS_WEBHOOK_SECRET || "").trim(),
    rateLimit: Math.min(Math.max(Number(env.FORMS_RATE_LIMIT) || 5, 1), 100),
    problems,
  };
  if (f.resendKey && !f.emailFrom) problems.push("FORMS_EMAIL_FROM is required for email alerts (a sender on a domain verified in Resend).");
  if (f.emailFrom && !/<[^>]+@[^>]+>$|^[^\s@]+@[^\s@]+$/.test(f.emailFrom)) problems.push("FORMS_EMAIL_FROM must be an address or \"Name <address>\".");
  if (f.resendKey && !f.notifyTo.length) problems.push("FORMS_NOTIFY_TO has no valid address (leave it empty to use the default).");
  if (f.netlifySecret && f.netlifySecret.length < 32) problems.push("NETLIFY_FORMS_WEBHOOK_SECRET must be at least 32 random characters.");
  f.email = !!(f.resendKey && f.emailFrom && !problems.some((p) => /FORMS_EMAIL_FROM|FORMS_NOTIFY_TO/.test(p)));
  return f;
}
// Every form's team alert goes here unless FORMS_NOTIFY_TO (or a per-form variable) says otherwise.
export const DEFAULT_NOTIFY_TO = "projects@digitalgrowthscale.com";
export const recipientsFor = (forms, formId) => (forms.notifyToByForm[formId]?.length ? forms.notifyToByForm[formId] : forms.notifyTo);

// The kind of Supabase key, never the key itself: "secret" (sb_secret_…), "service_role" (legacy
// JWT), "publishable", another JWT role, or null when unset/unrecognised.
export function supabaseKeyKind(key) {
  if (!key) return null;
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";
  try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role || null; } catch { return null; }
}

// The CMS needs a secret (or legacy service-role) key: the tables are closed to the public keys.
function serviceKeyProblem(key, name) {
  if (!key) return `${name} is required for the Supabase store: a secret key (sb_secret_…), server-side only; never expose it to a browser.`;
  const kind = supabaseKeyKind(key);
  if (kind === "secret" || kind === "service_role") return null;
  if (kind === "publishable") return `${name} is a publishable key. Use a secret key (sb_secret_…).`;
  return kind ? `${name} has the "${kind}" role. Use a secret key (sb_secret_…).` : `${name} is not a Supabase secret key (sb_secret_…) or legacy service-role key.`;
}

// Settings safe to show in the dashboard (no secrets).
export function publicConfig(cfg) {
  return {
    store: cfg.store, publicSiteUrl: cfg.publicSiteUrl, devLogin: cfg.devLogin, deployHook: !!cfg.deployHookUrl,
    previewBuilds: !!cfg.previewToken, iframeHosts: cfg.iframeHosts, sessionHours: cfg.sessionHours,
  };
}
