import { test } from "node:test";
import assert from "node:assert/strict";
import { feedConfig, feedItems, buildFeed } from "../server/services/feed.mjs";

// A 50-day window so both sample resources count as recent; the weekly rule has its own test below.
const fc = feedConfig({ NEWSLETTER_ASSET_ORIGIN: "https://cdn.example.test", NEWSLETTER_RESOURCE_DAYS: "50" }, { publicSiteUrl: "https://site.example.test", baseUrl: "https://cms.example.test" });
const now = new Date("2026-11-05T04:00:00Z");
const snap = {
  resources: [
    { id: "res_old", slug: "old", title: "Old guide", summary: "Old", resource_type: "Guide", published_at: "2026-10-01", cover_image_url: "/assets/a.png" },
    { id: "res_new", slug: "new one", title: "New & fresh", summary: "<b>New</b>", category: "AI", published_at: "2026-11-01", cover_image_url: "https://img.example.test/b.jpg" },
    { id: "res_noslug", title: "No slug" },
  ],
  events: [
    { id: "evt_past", title: "Past", event_date: "2026-11-01", time_zone: "Asia/Manila" },
    { id: "evt_hidden", title: "Hidden", event_date: "2026-12-01", visible: false },
    { id: "evt_later", title: "Later", event_date: "2026-12-10", registration_type: "none" },
    { id: "evt_soon", title: "Soon", event_date: "2026-11-20", start_time: "19:00", end_time: "21:00", time_zone: "Asia/Manila", venue: "Makati", registration_type: "external", registration_url: "https://reg.example.test/x", featured_image_url: "/assets/e.jpg" },
    { id: "evt_multi", title: "Ongoing", event_date: "2026-11-01", end_date: "2026-11-06", time_zone: "Asia/Manila", registration_type: "page", slug: "ongoing" },
  ],
};

test("feed: eligibility, order and links", () => {
  const items = feedItems(snap, fc, now);
  assert.deepEqual(items.map((i) => i.guid), ["event:evt_multi", "event:evt_soon", "event:evt_later", "resource:res_new", "resource:res_old"]);
  const [multi, soon, later, rnew, rold] = items;
  assert.equal(soon.url, "https://reg.example.test/x");
  assert.equal(soon.image, "https://cdn.example.test/assets/e.jpg");
  assert.equal(multi.url, "https://site.example.test/events/ongoing/");
  assert.equal(later.url, "https://site.example.test/workshops");
  assert.equal(rnew.url, "https://site.example.test/resources?new%20one");
  assert.equal(rnew.summary, "New");
  assert.equal(rold.image, "https://cdn.example.test/assets/a.png");
  assert.deepEqual(rold.categories, ["Resource", "Guide"]);
});

test("feed: no image without asset origin; xml escaped; categories and stable guids", () => {
  const fc2 = { ...fc, assetOrigin: "" };
  assert.equal(feedItems(snap, fc2, now).find((i) => i.guid === "resource:res_old").image, "");
  const xml = buildFeed(feedItems(snap, fc, now), fc, now);
  assert.match(xml, /<title>New &amp; fresh<\/title>/);
  assert.match(xml, /<guid isPermaLink="false">event:evt_soon<\/guid>/);
  assert.match(xml, /<category>Event<\/category>/);
  assert.match(xml, /<ev:startdate>2026-11-20T19:00<\/ev:startdate>/);
  // GHL reads <description>, so it carries the email card (date label, time, venue), not plain text.
  const soonDesc = xml.split("<item>").find((b) => b.includes("event:evt_soon")).match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)[1];
  assert.match(soonDesc, /FRI · NOV 20[\s\S]*7:00 PM – 9:00 PM \(Manila\)[\s\S]*Makati/);
  assert.doesNotMatch(xml, /evt_past|evt_hidden|res_noslug/);
  assert.equal(xml, buildFeed(feedItems(snap, fc, now), fc, now));
});

test("feed: resources published this week, or the newest few when nothing is new", () => {
  const weekly = feedConfig({}, { publicSiteUrl: "https://site.example.test" });
  assert.equal(weekly.resourceDays, 7);
  const ids = (n) => feedItems(snap, weekly, n).filter((i) => i.kind === "resource").map((i) => i.guid);
  assert.deepEqual(ids(now), ["resource:res_new"]); // res_old (Oct 1) is older than a week
  assert.deepEqual(ids(new Date("2026-12-31T00:00:00Z")), ["resource:res_new", "resource:res_old"]); // nothing new: fallback
  assert.deepEqual(feedItems(snap, { ...weekly, fallbackResources: 1 }, new Date("2026-12-31T00:00:00Z")).filter((i) => i.kind === "resource").map((i) => i.guid), ["resource:res_new"]);
});

test("feed: limits", () => {
  const items = feedItems(snap, { ...fc, maxResources: 1, maxEvents: 1 }, now);
  assert.deepEqual(items.map((i) => i.guid), ["event:evt_multi", "resource:res_new"]);
});

test("feed: email cards carry date label, time, icons and one heading per section", () => {
  const items = feedItems(snap, fc, now);
  const soon = items.find((i) => i.guid === "event:evt_soon");
  assert.equal(soon.chip, "FRI · NOV 20");
  assert.equal(soon.time, "7:00 PM – 9:00 PM (Manila)");
  assert.equal(items.find((i) => i.guid === "event:evt_multi").time, "Nov 1 – Nov 6 (Manila)");
  const xml = buildFeed(items, fc, now);
  assert.equal((xml.match(/Learn with us, live/g) || []).length, 2);
  assert.equal((xml.match(/New to read this week/g) || []).length, 2);
  assert.match(xml, /https:\/\/cdn\.example\.test\/assets\/email\/icon-clock-pink\.png/);
  assert.match(xml, /https:\/\/cdn\.example\.test\/assets\/email\/icon-book-yellow\.png/);
});
