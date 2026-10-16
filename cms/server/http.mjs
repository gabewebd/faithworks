// Small HTTP helpers shared by the router and services (web-standard Request/Response).
export class HttpError extends Error {
  constructor(status, message, code = "error", details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export async function readJson(request, limit = 3_000_000) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new HttpError(415, "Send JSON (content-type: application/json).", "bad_content_type");
  const text = await request.text();
  if (text.length > limit) throw new HttpError(413, "The request is too large.", "too_large");
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, "The request body is not valid JSON.", "bad_json"); }
}

export const now = () => new Date().toISOString();

export function randomId(prefix, bytes = 8) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return `${prefix}_${[...a].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function parseCookies(header) {
  const out = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, secure = true, httpOnly = true, sameSite = "Lax", path = "/" } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) c += "; HttpOnly";
  if (secure) c += "; Secure";
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}
