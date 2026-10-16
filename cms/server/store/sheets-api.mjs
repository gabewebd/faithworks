// Minimal Google Sheets API v4 client. Server-side only.
// Authenticates as a service account: a JWT signed with the account's private key (RS256,
// node:crypto) is exchanged for a short-lived access token. No Google SDK is needed.
// Every call has a timeout; idempotent calls retry transient failures (429, 5xx, network)
// with exponential backoff and jitter, honouring Retry-After. Appends are NOT retried here:
// the store checks whether the row arrived before trying again (see sheets-store.mjs).
import { createSign } from "node:crypto";
import { HttpError } from "../http.mjs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);

const b64url = (s) => Buffer.from(s).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createSheetsApi({ spreadsheetId, clientEmail, privateKey, fetchImpl = globalThis.fetch, timeoutMs = 8000, maxAttempts = 4, baseDelayMs = 400, log = console }) {
  let token = null; // { value, expires }

  async function accessToken() {
    if (token && token.expires > Date.now() + 60_000) return token.value;
    const iat = Math.floor(Date.now() / 1000);
    const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(JSON.stringify({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
    let signature;
    try {
      signature = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(privateKey, "base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    } catch {
      throw new HttpError(500, "The Google service-account private key could not be read. Check GOOGLE_PRIVATE_KEY.", "google_key");
    }
    const res = await call(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${signature}` }),
    }, { retry: true, auth: false });
    token = { value: res.access_token, expires: Date.now() + (res.expires_in || 3600) * 1000 };
    return token.value;
  }

  async function call(url, init, { retry, auth = true }) {
    let lastErr;
    for (let attempt = 1; attempt <= (retry ? maxAttempts : 1); attempt++) {
      let res;
      try {
        const headers = { ...(init.headers || {}) };
        if (auth) headers.authorization = `Bearer ${await accessToken()}`;
        res = await fetchImpl(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
      } catch (e) {
        if (e instanceof HttpError) throw e;
        lastErr = new HttpError(503, "Google Sheets could not be reached. Nothing was changed by this attempt. Please try again.", "google_unavailable");
        lastErr.cause = e;
        lastErr.transport = true;
        if (attempt < (retry ? maxAttempts : 1)) { await sleep(backoff(attempt)); continue; }
        throw lastErr;
      }
      if (res.ok) return res.status === 204 ? {} : res.json();
      const body = await res.text().catch(() => "");
      if (res.status === 401 && auth) token = null;
      if (TRANSIENT.has(res.status) || (res.status === 401 && auth && attempt === 1)) {
        lastErr = res.status === 429
          ? new HttpError(429, "Google Sheets is busy (rate limit reached). Wait a minute and try again.", "google_rate_limited")
          : new HttpError(503, `Google Sheets is temporarily unavailable (HTTP ${res.status}). Please try again.`, "google_unavailable");
        if (retry && attempt < maxAttempts) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 10_000) : backoff(attempt));
          continue;
        }
        throw lastErr;
      }
      log.error?.(`Google API ${init.method || "GET"} ${url.replace(/\?.*/, "")} → ${res.status}: ${body.slice(0, 300)}`);
      if (res.status === 403) throw new HttpError(502, "The CMS does not have access to the spreadsheet. Share it with the service account (Editor).", "google_forbidden");
      if (res.status === 404) throw new HttpError(502, "The spreadsheet or tab was not found. Check GOOGLE_SHEETS_SPREADSHEET_ID and run the setup script.", "google_not_found");
      throw new HttpError(502, `Google Sheets rejected the request (HTTP ${res.status}).`, "google_error");
    }
    throw lastErr;
  }
  const backoff = (attempt) => baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * baseDelayMs);

  const sheetRange = (tab, a1 = "") => `'${tab.replace(/'/g, "''")}'${a1 ? `!${a1}` : ""}`;
  const base = `${API}/${encodeURIComponent(spreadsheetId)}`;

  return {
    sheetRange,
    // One request for several tabs: { tab: rows[][] }
    async batchGet(ranges) {
      const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
      const res = await call(`${base}/values:batchGet?${qs}&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`, { method: "GET" }, { retry: true });
      return (res.valueRanges || []).map((v) => v.values || []);
    },
    async get(range) {
      const res = await call(`${base}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`, { method: "GET" }, { retry: true });
      return res.values || [];
    },
    // Overwrites a fixed range: idempotent, so it is retried.
    async update(range, values) {
      return call(`${base}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ range, majorDimension: "ROWS", values }),
      }, { retry: true });
    },
    // Adds rows after the last row of the table. Not retried (a retry could duplicate the row).
    async append(range, values) {
      return call(`${base}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ majorDimension: "ROWS", values }),
      }, { retry: false });
    },
    async metadata() {
      return call(`${base}?fields=properties.title,sheets.properties`, { method: "GET" }, { retry: true });
    },
    async batchUpdate(requests) {
      return call(`${base}:batchUpdate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requests }) }, { retry: false });
    },
  };
}
