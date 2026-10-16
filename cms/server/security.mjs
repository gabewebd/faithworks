// Response security headers for the CMS (dashboard pages and API).
// script-src 'self' means no inline or third-party script can run in the dashboard, and the
// same policy is inherited by the sandboxed preview iframes (srcdoc), on top of their own.
export function csp(cfg) {
  const site = cfg?.publicSiteUrl ? ` ${cfg.publicSiteUrl}` : " https:";
  const frames = (cfg?.iframeHosts || []).map((h) => ` https://${h}`).join("");
  return [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com${site}`,
    `font-src 'self' data: https://fonts.gstatic.com${site}`,
    "img-src 'self' https: data:",
    "media-src 'self' https:",
    `frame-src 'self'${frames}`,
    "connect-src 'self'",
    "object-src 'none'",
    `base-uri 'self'${site}`,
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(cfg) {
  return {
    "content-security-policy": csp(cfg),
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "cross-origin-opener-policy": "same-origin",
    ...(cfg?.production ? { "strict-transport-security": "max-age=31536000; includeSubDomains" } : {}),
  };
}
