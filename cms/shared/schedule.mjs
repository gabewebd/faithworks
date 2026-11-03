// Scheduled publishing (resources). An editor picks a date and a wall-clock time in Manila;
// the server turns them into one UTC instant (`scheduled_at`) and the scheduled job
// (netlify/functions/publish-scheduled.mjs → records.publishDue) publishes the item once that
// instant has passed. Shared by the server, the dashboard and the tests; no Node or browser APIs.
//
// Why a fixed zone: Faith Works publishes for a Philippine audience and Manila has no daylight
// saving time (UTC+8 all year), so "8:00 AM" means the same instant to every editor, whatever
// time zone their own computer or the server uses. The conversion still goes through
// Intl (eventInstant) rather than a hard-coded +08:00.
import { eventInstant } from "./page-doc.mjs";

export const SCHEDULE_TZ = "Asia/Manila";
export const SCHEDULE_TZ_LABEL = "Manila time (UTC+8)";
// The earliest a schedule may be set: a little in the future, so the item cannot be published
// by the job before the editor has finished confirming. The latest: two years ahead (typos
// such as 2062 are caught).
export const MIN_LEAD_MS = 2 * 60_000;
export const MAX_AHEAD_MS = 2 * 366 * 86_400_000;
// The job runs every 5 minutes; an item still waiting this long after its time means the job
// is not running (shown on the dashboard).
export const OVERDUE_MS = 20 * 60_000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// "2026-11-04" + "08:00" (Manila) → "2026-11-04T00:00:00.000Z", or null if either is missing
// or not a real calendar date (e.g. 2026-02-30).
export function scheduleInstant(date, time, tz = SCHEDULE_TZ) {
  if (!DATE_RE.test(String(date || "")) || !TIME_RE.test(String(time || ""))) return null;
  const [y, m, d] = date.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  const withOffset = eventInstant(date, time, tz); // e.g. 2026-11-04T08:00:00+08:00
  const ms = Date.parse(withOffset);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

// Problems with a schedule, as { field: message } (empty when it is fine). `now` is a Date.
export function scheduleProblems(rec, now = new Date()) {
  const errors = {};
  if (!rec.schedule_date) errors.schedule_date = "Choose the day it should go live.";
  if (!rec.schedule_time) errors.schedule_time = "Choose the time it should go live (Manila time).";
  if (Object.keys(errors).length) return errors;
  const at = scheduleInstant(rec.schedule_date, rec.schedule_time);
  if (!at) { errors.schedule_date = "This date or time could not be read. Use the calendar and the time list."; return errors; }
  const ms = Date.parse(at);
  if (ms < now.getTime() + MIN_LEAD_MS) errors.schedule_time = `This time has already passed (or is less than ${MIN_LEAD_MS / 60_000} minutes away) in ${SCHEDULE_TZ_LABEL}. Choose a later time, or use Publish to publish now.`;
  else if (ms > now.getTime() + MAX_AHEAD_MS) errors.schedule_date = "Choose a date within the next two years.";
  return errors;
}

// "Wed, 4 Nov 2026, 8:00 AM" in Manila (the dashboard adds "Manila time").
export function fmtSchedule(iso, tz = SCHEDULE_TZ) {
  const ms = Date.parse(String(iso || ""));
  if (Number.isNaN(ms)) return "";
  return new Intl.DateTimeFormat("en-PH", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(ms));
}
// The Manila calendar date of an instant (the article's publish date once it goes live).
export function scheduleLocalDate(iso, tz = SCHEDULE_TZ) {
  const ms = Date.parse(String(iso || ""));
  if (Number.isNaN(ms)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}
