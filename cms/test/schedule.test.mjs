// Scheduled publishing (resources): Manila time conversion, the Schedule / Cancel schedule actions,
// saves while scheduled, and the scheduled job (records.publishDue) that publishes due items once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { testApp, signedIn, article } from "./helpers.mjs";
import { scheduleInstant, scheduleProblems, fmtSchedule, scheduleLocalDate } from "../shared/schedule.mjs";
import { SCHEDULER } from "../server/services/records.mjs";

const HOOK = "https://api.vercel.com/v1/integrations/deploy/test-hook";
const rec = (r) => r.data.record;
const MIN = 60_000;
// A Manila wall-clock date and time `ms` from now (rounded up to the next minute).
function manilaIn(ms) {
  const d = new Date(Math.ceil((Date.now() + ms) / MIN) * MIN + 8 * 3600_000); // shift to UTC+8, read as UTC
  return { schedule_date: d.toISOString().slice(0, 10), schedule_time: d.toISOString().slice(11, 16) };
}

async function setup() {
  const deploys = [];
  const fetchImpl = async (url, init) => { if (url === HOOK) deploys.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); };
  const t = testApp({ env: { PUBLIC_SITE_DEPLOY_HOOK_URL: HOOK }, fetchImpl });
  const u = await signedIn(t.app);
  const records = t.app.services.records;
  async function draft(over = {}) {
    const r = await u.author.post("/api/records/resources", { data: article({ slug: `sched-${Math.random().toString(36).slice(2, 8)}`, ...over }) });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return rec(r);
  }
  const save = (r, data) => u.author.put(`/api/records/resources/${r.id}`, { version: r.version, data: { ...r, ...data } });
  const act = (r, action, who = u.author) => who.post(`/api/records/resources/${r.id}/actions/${action}`, { version: r.version });
  const publicSlugs = async () => (await u.author.get("/api/public/content")).data.resources.map((x) => x.slug);
  return { ...t, u, records, deploys, draft, save, act, publicSlugs };
}

test("Manila wall-clock times convert to the right UTC instant, whatever the server's zone", () => {
  assert.equal(scheduleInstant("2026-11-04", "08:00"), "2026-11-04T00:00:00.000Z", "8:00 AM Manila is midnight UTC");
  assert.equal(scheduleInstant("2026-11-04", "07:30"), "2026-11-03T23:30:00.000Z", "and crosses the date line backwards");
  assert.equal(scheduleInstant("2026-12-31", "23:59"), "2026-12-31T15:59:00.000Z");
  assert.equal(scheduleInstant("2026-03-08", "02:30", "America/New_York"), "2026-03-08T07:30:00.000Z", "other zones go through Intl (the time is EST there)");
  for (const [d, t] of [["2026-02-30", "08:00"], ["2026-11-04", "8:00"], ["2026-11-04", "24:00"], ["", "08:00"], ["2026-11-04", ""], ["04/11/2026", "08:00"]]) assert.equal(scheduleInstant(d, t), null, `${d} ${t} is refused`);
  assert.equal(fmtSchedule("2026-11-04T00:00:00.000Z"), "Wed, Nov 4, 2026, 8:00 AM");
  assert.equal(scheduleLocalDate("2026-11-03T23:30:00.000Z"), "2026-11-04", "the article's date is the Manila date");
  const now = new Date("2026-11-03T13:00:00Z");
  assert.deepEqual(scheduleProblems({ schedule_date: "2026-11-04", schedule_time: "08:00" }, now), {});
  assert.ok(scheduleProblems({ schedule_date: "2026-11-03", schedule_time: "21:01" }, now).schedule_time, "less than two minutes away is refused");
  assert.ok(scheduleProblems({ schedule_date: "2026-11-03", schedule_time: "08:00" }, now).schedule_time, "a past time is refused");
  assert.ok(scheduleProblems({ schedule_date: "2029-01-01", schedule_time: "08:00" }, now).schedule_date, "more than two years ahead is refused");
  assert.ok(scheduleProblems({ schedule_date: "2026-11-04" }, now).schedule_time, "a time is required");
});

test("schedule: validated like Publish, stays off the website, then the job publishes it once", async () => {
  const s = await setup();
  try {
    let r = await s.draft({ summary: "" });
    // No date and time yet; then a complete date but an incomplete article
    let res = await s.act(r, "schedule");
    assert.equal(res.status, 422);
    assert.ok(res.data.error.errors.schedule_date && res.data.error.errors.schedule_time);
    r = rec(await s.save(r, { schedule_date: "2020-01-01", schedule_time: "08:00" }));
    res = await s.act(r, "schedule");
    assert.equal(res.status, 422);
    assert.ok(res.data.error.errors.summary, "checked as strictly as Publish");
    assert.ok(res.data.error.errors.schedule_time, "and a past time is refused");

    const when = manilaIn(30 * MIN);
    r = rec(await s.save(r, { summary: "Ready.", ...when }));
    assert.equal(r.status, "draft", "saving a date and time alone schedules nothing");
    res = await s.act(r, "schedule");
    assert.equal(res.status, 200, JSON.stringify(res.data));
    r = rec(res);
    assert.equal(r.status, "scheduled");
    assert.equal(r.scheduled_at, scheduleInstant(when.schedule_date, when.schedule_time));
    assert.equal(r.scheduled_by, "author@example.test");
    assert.equal(r.publish_date, when.schedule_date, "the article's date becomes the scheduled Manila date");
    assert.equal(res.data.live, null);
    assert.deepEqual(res.data.actions.sort(), ["archive", "delete", "publish", "schedule", "unschedule"]);
    assert.ok(!(await s.publicSlugs()).includes(r.slug), "not public while scheduled");
    assert.equal(s.deploys.length, 0, "scheduling does not rebuild the website");

    // The job before the time: nothing happens
    let job = await s.records.publishDue({ now: new Date() });
    assert.deepEqual([job.checked, job.due.length, job.published.length], [1, 0, 0]);
    assert.ok(!(await s.publicSlugs()).includes(r.slug));

    // After the time: published once, by the scheduler, with one rebuild
    const later = new Date(Date.parse(r.scheduled_at) + MIN);
    job = await s.records.publishDue({ now: later });
    assert.deepEqual(job.published.map((x) => x.id), [r.id]);
    assert.equal(job.deploy.triggered, true);
    assert.equal(s.deploys.length, 1);
    assert.ok((await s.publicSlugs()).includes(r.slug), "public once published");
    const after = rec(await s.u.author.get(`/api/records/resources/${r.id}`).then((x) => ({ data: x.data })));
    assert.equal(after.status, "published");
    assert.equal(after.published_by, SCHEDULER.email);
    assert.deepEqual([after.scheduled_at, after.schedule_date, after.schedule_time], ["", "", ""], "the schedule is cleared once published");
    const pub = (await s.u.author.get("/api/public/content")).data.resources.find((x) => x.id === r.id);
    for (const k of ["schedule_date", "schedule_time", "scheduled_at", "scheduled_by", "schedule_error"]) assert.ok(!(k in pub), `${k} is never public`);

    // Running again (or twice at once) publishes nothing more and rebuilds nothing
    const again = await Promise.all([s.records.publishDue({ now: later }), s.records.publishDue({ now: later })]);
    assert.deepEqual(again.map((j) => j.published.length), [0, 0]);
    assert.equal(s.deploys.length, 1);
    const live = (await s.u.super.get("/api/public/content")).data.resources.filter((x) => x.id === r.id);
    assert.equal(live.length, 1, "exactly one live copy");
    const audit = (await s.u.super.get(`/api/audit?record=${r.id}`)).data;
    assert.deepEqual(audit.filter((a) => a.action === "publish").map((a) => a.actor), [SCHEDULER.email], "published once, recorded as the scheduler");
    assert.match(audit.find((a) => a.action === "schedule").detail, /Manila time/);
  } finally { s.cleanup(); }
});

test("a draft without a publish date can be scheduled: the scheduled Manila date fills it in", async () => {
  const s = await setup();
  try {
    let r = await s.draft({ publish_date: "", ...manilaIn(60 * MIN) });
    assert.equal(r.publish_date, "");
    const res = await s.act(r, "schedule");
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(rec(res).publish_date, manilaIn(60 * MIN).schedule_date);
    r = rec(res);
    const saved = await s.save(r, { publish_date: "" });
    assert.equal(saved.status, 200, "a save while scheduled refills it too");
    assert.equal(rec(saved).publish_date, r.publish_date);
  } finally { s.cleanup(); }
});

test("reschedule, cancel, publish now, and saves while scheduled", async () => {
  const s = await setup();
  try {
    let r = await s.draft(manilaIn(60 * MIN));
    r = rec(await s.act(r, "schedule"));
    // Rescheduling by saving a new time keeps it scheduled, with the new instant
    const later = manilaIn(5 * 60 * MIN);
    let res = await s.save(r, later);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    r = rec(res);
    assert.equal(r.status, "scheduled");
    assert.equal(r.scheduled_at, scheduleInstant(later.schedule_date, later.schedule_time));
    // A save that would make it unpublishable, or move it into the past, is refused
    res = await s.save(r, { summary: "" });
    assert.equal(res.status, 422);
    assert.ok(res.data.error.errors.summary);
    res = await s.save(r, { schedule_date: "2020-01-01" });
    assert.equal(res.status, 422);
    res = await s.save(r, { scheduled_at: "2020-01-01T00:00:00.000Z", status: "published" });
    assert.equal(rec(res).scheduled_at, r.scheduled_at, "the instant and status are server-owned");
    assert.equal(rec(res).status, "scheduled");
    r = rec(res);
    // The Schedule action again also reschedules
    Object.assign(r, rec(await s.save(r, manilaIn(2 * 60 * MIN))));
    res = await s.act(r, "schedule");
    assert.equal(res.status, 200);
    r = rec(res);
    // Cancel: back to Draft, the date and time are kept; the job ignores it
    res = await s.act(r, "unschedule");
    assert.equal(res.status, 200);
    r = rec(res);
    assert.equal(r.status, "draft");
    assert.equal(r.scheduled_at, "");
    assert.ok(r.schedule_date && r.schedule_time);
    const job = await s.records.publishDue({ now: new Date(Date.now() + 24 * 3600_000) });
    assert.equal(job.checked, 0);
    // Schedule again, then Publish now (manual publishing is unchanged)
    r = rec(await s.save(r, manilaIn(60 * MIN)));
    r = rec(await s.act(r, "schedule"));
    res = await s.act(r, "publish");
    assert.equal(res.status, 200);
    assert.equal(rec(res).status, "published");
    assert.equal(rec(res).scheduled_at, "");
    assert.equal(s.deploys.length, 1, "Publish now rebuilds as before");
    assert.equal((await s.records.publishDue({ now: new Date(Date.now() + 24 * 3600_000) })).published.length, 0, "and the job does not publish it again");
  } finally { s.cleanup(); }
});

test("an update to a live resource can be scheduled; the live version stays until then", async () => {
  const s = await setup();
  try {
    let r = await s.draft({ title: "Version one" });
    r = rec(await s.act(r, "publish"));
    r = rec(await s.save(r, { title: "Version two", ...manilaIn(60 * MIN) }));
    const res = await s.act(r, "schedule");
    assert.equal(res.status, 200);
    r = rec(res);
    const shown = async () => (await s.u.author.get("/api/public/content")).data.resources.find((x) => x.id === r.id)?.title;
    assert.equal(await shown(), "Version one");
    await s.records.publishDue({ now: new Date(Date.parse(r.scheduled_at) + MIN) });
    assert.equal(await shown(), "Version two");
  } finally { s.cleanup(); }
});

test("the job retries an item edited meanwhile, and gives up (back to Draft, with the reason) when it can no longer be published", async () => {
  const s = await setup();
  try {
    let a = await s.draft(manilaIn(60 * MIN));
    a = rec(await s.act(a, "schedule"));
    const due = new Date(Date.parse(a.scheduled_at) + MIN);
    // Someone saves between the job's read and its publish: the version check refuses, next run publishes
    const store = s.app.store;
    const realQuery = store.query;
    store.query = async (...args) => { const rows = await realQuery(...args); store.query = realQuery; await s.save(a, { summary: "Edited meanwhile." }); return rows; };
    let job = await s.records.publishDue({ now: due });
    assert.deepEqual([job.published.length, job.retry.length, job.failed.length], [0, 1, 0]);
    job = await s.records.publishDue({ now: due });
    assert.equal(job.published.length, 1, "published on the next run, with the edit");
    assert.equal((await s.u.author.get("/api/public/content")).data.resources.find((x) => x.id === a.id).summary, "Edited meanwhile.");

    // Another item takes the slug live first: the scheduled one cannot be published any more
    let b = await s.draft({ slug: "shared-address", ...manilaIn(60 * MIN) });
    b = rec(await s.act(b, "schedule"));
    await s.app.store.update("resources", b.id, { ...b, slug: "shared-address" }); // (as stored)
    let c = await s.draft({ slug: "other-address" });
    // Free the slug check on save by moving c to the address after b was scheduled (direct store edit)
    c = await s.app.store.update("resources", c.id, { ...c, slug: "shared-address" });
    await s.u.author.post(`/api/records/resources/${c.id}/actions/publish`, { version: c.version });
    job = await s.records.publishDue({ now: new Date(Date.parse(b.scheduled_at) + MIN) });
    assert.equal(job.failed.length, 1, JSON.stringify(job));
    const failed = (await s.u.author.get(`/api/records/resources/${b.id}`)).data.record;
    assert.equal(failed.status, "draft");
    assert.match(failed.schedule_error, /\/resources\/shared-address\/ is already/);
    assert.equal((await s.records.publishDue({ now: new Date(Date.now() + 86_400_000) })).due.length, 0, "not retried");
    const dash = (await s.u.author.get("/api/dashboard")).data;
    assert.deepEqual(dash.scheduleFailed.map((x) => x.id), [b.id], "shown on the dashboard");
  } finally { s.cleanup(); }
});

test("only resources can be scheduled; the dashboard lists what is scheduled and flags late items", async () => {
  const s = await setup();
  try {
    const ev = await s.u.author.post("/api/records/events", { data: { title: "An event", event_date: "2027-01-10", schedule_date: "2027-01-01", schedule_time: "08:00" } });
    assert.equal(ev.status, 201);
    assert.ok(!ev.data.actions.includes("schedule"));
    const res = await s.u.author.post(`/api/records/events/${ev.data.record.id}/actions/schedule`, { version: ev.data.record.version });
    assert.equal(res.status, 403);

    let r = await s.draft(manilaIn(60 * MIN));
    r = rec(await s.act(r, "schedule"));
    let dash = (await s.u.author.get("/api/dashboard")).data;
    assert.deepEqual(dash.scheduled.map((x) => [x.id, x.late]), [[r.id, false]]);
    assert.equal(dash.counts.resources.scheduled, 1);
    const list = (await s.u.author.get("/api/records/resources?status=scheduled")).data;
    assert.deepEqual(list.map((x) => [x.id, x.scheduled_at]), [[r.id, r.scheduled_at]]);
    // The job did not run in time: the dashboard says so
    await s.app.store.update("resources", r.id, { ...r, scheduled_at: new Date(Date.now() - 3600_000).toISOString() });
    dash = (await s.u.author.get("/api/dashboard")).data;
    assert.equal(dash.scheduled[0].late, true);
  } finally { s.cleanup(); }
});
