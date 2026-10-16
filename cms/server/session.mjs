// Signed, stateless session cookies (HMAC-SHA256). The cookie holds only the user's email,
// issue and expiry times; the role is looked up on every request, so removing or demoting a
// user takes effect within the user cache window (see auth.mjs), not at cookie expiry.
import { createHmac, timingSafeEqual } from "node:crypto";

const b64 = (buf) => Buffer.from(buf).toString("base64url");

export function sign(payload, secret) {
  const body = b64(JSON.stringify(payload));
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = createHmac("sha256", secret).update(body).digest();
  let given;
  try { given = Buffer.from(mac, "base64url"); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
