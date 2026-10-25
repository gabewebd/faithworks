// CMS configuration from environment variables (see cms/.env.example). Fails closed: on a
// hosted deployment (Vercel/Netlify) every security-relevant setting must be present, content
// is stored in Supabase (the source of truth for CMS content) and the development login cannot
// be switched on. Google is used only for sign-in (OAuth).
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

  if (!["supabase", "json"].includes(store)) errors.push(`CMS_STORE must be "supabase" or "json" (got "${store}"). The Google Sheets store was removed.`);
  if (store === "supabase") {
    if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(cfg.supabaseUrl)) errors.push("SUPABASE_URL is required for the Supabase store (https://<project-ref>.supabase.co).");
    const keyProblem = serviceKeyProblem(cfg.supabaseServiceKey, supabaseKeyVar);
    if (keyProblem) errors.push(keyProblem);
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

  cfg.errors = errors;
  return Object.freeze(cfg);
}

// Website form submissions (server/forms/). Problems here never stop the CMS: they are listed in
// cfg.forms.problems, shown on /api/health (as a count) and on the Submissions page, and the part
// they concern stays off. The submission endpoint is off until FORMS_ALLOWED_ORIGINS is set.
const EMAIL_ADDRESS = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]{2,}$/;
export function formsConfig(env = process.env) {
  const problems = [];
  const allowedOrigins = list(env.FORMS_ALLOWED_ORIGINS).map((o) => o.replace(/\/$/, ""));
  const badOrigins = allowedOrigins.filter((o) => !/^https:\/\/[^/]+$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
  if (badOrigins.length) problems.push("FORMS_ALLOWED_ORIGINS must list origins like https://faithph.ai (https, no path).");
  const f = {
    allowedOrigins: allowedOrigins.filter((o) => !badOrigins.includes(o)),
    rateLimit: Math.min(Math.max(Number(env.FORMS_RATE_LIMIT) || 5, 1), 100),
    problems,
  };
  return f;
}

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
