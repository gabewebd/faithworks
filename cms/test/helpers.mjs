// Test helpers: an app on a temporary JSON store (seeded from the fixtures) and a small
// client that signs in through the development login.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";

export const USERS = {
  super: "super.admin@example.test",
  main: "main.admin@example.test",
  author: "author@example.test",
  author2: "second.author@example.test",
};

export function testApp({ env = {}, store, fetchImpl } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "fwcms-"));
  const logs = [];
  const app = createApp({
    env: { CMS_STORE: "json", CMS_JSON_PATH: join(dir, "store.json"), CMS_DEV_LOGIN: "true", CMS_PREVIEW_TOKEN: "p".repeat(40), PUBLIC_SITE_URL: "https://faithph.ai", ...env },
    store, fetchImpl, log: { error: (m) => logs.push(m) },
  });
  return { app, dir, logs, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export function client(app, email) {
  let cookie = "";
  async function call(method, path, body, extra = {}) {
    const headers = { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(method !== "GET" ? { "x-cms-csrf": "1" } : {}), ...(cookie ? { cookie } : {}), ...extra };
    const res = await app.handle(new Request(`http://localhost${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }));
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
  return {
    call,
    async login() {
      const r = await call("POST", "/api/auth/dev-login", { email });
      if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.data)}`);
      cookie = r.headers.getSetCookie()[0].split(";")[0];
      return this;
    },
    get: (p, h) => call("GET", p, undefined, h),
    post: (p, b, h) => call("POST", p, b ?? {}, h),
    put: (p, b) => call("PUT", p, b),
  };
}

export async function signedIn(app) {
  const out = {};
  for (const [k, email] of Object.entries(USERS)) out[k] = await client(app, email).login();
  return out;
}

// A complete, valid article (resources) payload.
export function article(over = {}) {
  return {
    title: "Testing the CMS", slug: "testing-the-cms", resource_type: "article", category: "AI", summary: "A test article.",
    author: "Faith Works", publish_date: "2026-10-16", access_rule: "open", content_owner: "Content owner", review_date: "2027-01-31",
    body_html: "<h2>Hello</h2><p>Body text.</p>", tags: ["ai"], ...over,
  };
}
