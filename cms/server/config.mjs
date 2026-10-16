// CMS configuration from environment variables (see cms/.env.example). Fails closed: on a
// hosted deployment (Vercel/Netlify) every security-relevant setting must be present, the
// Google Sheets store is mandatory and the development login cannot be switched on.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DEFAULT_IFRAME_HOSTS } from "../shared/sanitize-html.mjs";

const CMS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const list = (s) => String(s || "").split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

export function loadConfig(env = process.env) {
  const hosted = !!(env.VERCEL || env.NETLIFY);
  const production = hosted || env.NODE_ENV === "production";
  const errors = [];
  const store = (env.CMS_STORE || (hosted ? "sheets" : "json")).toLowerCase();

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

  const cfg = {
    hosted, production, store,
    cmsRoot: CMS_ROOT,
    jsonPath: env.CMS_JSON_PATH || join(CMS_ROOT, ".data", "store.json"),
    seedPath: join(CMS_ROOT, "fixtures", "seed.json"),
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
  };

  if (!["json", "sheets"].includes(store)) errors.push(`CMS_STORE must be "sheets" or "json" (got "${store}").`);
  if (store === "sheets") {
    if (!cfg.spreadsheetId) errors.push("GOOGLE_SHEETS_SPREADSHEET_ID is required for the Google Sheets store.");
    if (!cfg.clientEmail || !cfg.privateKey) errors.push("Google service-account credentials are required (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64).");
  }
  if (hosted && store !== "sheets") errors.push("Hosted deployments must use the Google Sheets store (CMS_STORE=sheets). The JSON store is for local development only.");
  if (production || !cfg.devLogin) {
    if (cfg.sessionSecret.length < 32) errors.push("CMS_SESSION_SECRET must be at least 32 random characters.");
    if (!cfg.oauthClientId || !cfg.oauthClientSecret) errors.push("GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required for sign-in.");
    if (!cfg.baseUrl) errors.push("CMS_BASE_URL is required (the CMS address, e.g. https://cms.faithph.ai).");
    if (!cfg.superAdmins.length) errors.push("CMS_SUPER_ADMINS must list at least one Super Admin email address.");
  }
  if (env.CMS_DEV_LOGIN === "true" && production) errors.push("CMS_DEV_LOGIN cannot be enabled in production. Remove it.");
  if (cfg.previewToken && cfg.previewToken.length < 32) errors.push("CMS_PREVIEW_TOKEN must be at least 32 random characters (or unset).");
  if (cfg.devLogin && !cfg.sessionSecret) cfg.sessionSecret = "local-development-only-session-secret-not-for-production";

  cfg.errors = errors;
  return Object.freeze(cfg);
}

// Settings safe to show in the dashboard (no secrets).
export function publicConfig(cfg) {
  return {
    store: cfg.store, publicSiteUrl: cfg.publicSiteUrl, devLogin: cfg.devLogin, deployHook: !!cfg.deployHookUrl,
    previewBuilds: !!cfg.previewToken, iframeHosts: cfg.iframeHosts, sessionHours: cfg.sessionHours,
  };
}
