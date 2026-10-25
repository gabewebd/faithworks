// Event image galleries: the content model (normalize, validate, migrate), the API round trip
// (create, edit, reorder, change the cover, publish), uploads, the photo library, and the
// website's Events gallery (selection and a masonry grid without holes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testApp, signedIn, client, USERS } from "./helpers.mjs";
import { normalize, validate } from "../shared/validate.mjs";
import { migrateRecord, blankRecord } from "../shared/schema.mjs";
import { toPublic } from "../shared/public.mjs";
import { recordComponent } from "../shared/page-doc.mjs";
import { createMedia, sniffImage } from "../server/services/media.mjs";
import { spansFor, galleryItems, eventGallery, eventGalleryEntries } from "../../tools/event-gallery.mjs";

const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const img = (n, over = {}) => ({ url: `/assets/images/web/photo-${n}.webp`, alt: `Photo ${n}`, ...over });

/* ---- Content model ------------------------------------------------------------------------ */
test("an event gallery is normalized: rows without an address dropped, first image the cover, cover mirrored", () => {
  const r = normalize("events", { title: "E", gallery: [{ url: " " }, img(1), img(2, { featured: "true" })] });
  assert.deepEqual(r.gallery.map((g) => [g.url, g.primary, g.featured]), [[img(1).url, true, false], [img(2).url, false, true]]);
  assert.equal(r.featured_image_url, img(1).url);
  assert.equal(r.featured_image_alt, "Photo 1");
  const moved = normalize("events", { title: "E", gallery: [img(1), img(2, { primary: true })] });
  assert.equal(moved.featured_image_url, img(2).url, "the cover, not the first image, is the card image");
  const none = normalize("events", { title: "E", gallery: [], featured_image_url: "/old.webp" });
  assert.equal(none.featured_image_url, "", "removing every image clears the card image");
});

test("an older client that sends only a featured image keeps it, as a one-image gallery", () => {
  const r = normalize("events", { title: "E", featured_image_url: "/assets/images/x.webp", featured_image_alt: "X" });
  assert.deepEqual(r.gallery, [{ url: "/assets/images/x.webp", alt: "X", primary: true, featured: false }]);
});

test("gallery validation: one cover, no copies, safe addresses, alt text to publish, at most 24", () => {
  const v = (gallery, strict = false) => validate("events", { ...blankRecord("events"), title: "E", gallery }, { strict }).gallery;
  assert.equal(v([img(1, { primary: true }), img(2)]), undefined);
  assert.match(v([img(1, { primary: true }), img(2, { primary: true })]), /one cover/);
  assert.match(v([img(1, { primary: true }), img(1)]), /already in the list/);
  for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.example/x.png", "mailto:a@b.co"]) {
    assert.match(v([{ url: bad, alt: "a", primary: true }]), /Image 1/, bad);
  }
  assert.equal(v([img(1, { primary: true, alt: "" })]), undefined, "drafts may lack alt text");
  assert.match(v([img(1, { primary: true, alt: "" })], true), /describe/);
  const many = Array.from({ length: 25 }, (_, i) => img(i, { primary: i === 0 }));
  assert.match(v(many), /up to 24/);
});

test("events saved before galleries read as a one-image gallery, not shown in the Events gallery", () => {
  const old = migrateRecord("events", { title: "Old", featured_image_url: "/assets/images/masterclass-room-960.webp", featured_image_alt: "Room" });
  assert.deepEqual(old.gallery, [{ url: "/assets/images/masterclass-room-960.webp", alt: "Room", primary: true, featured: false }]);
  assert.deepEqual(migrateRecord("events", { title: "No image" }).gallery, []);
  const kept = migrateRecord("events", { title: "New", featured_image_url: img(1).url, gallery: [img(1, { primary: true, featured: true })] });
  assert.equal(kept.gallery[0].featured, true, "a saved gallery is never rebuilt");
});

test("the gallery is public, and the event page component lists the images after the cover", () => {
  const rec = { ...normalize("events", { title: "E", gallery: [img(1), img(2), img(3)] }), id: "evt_x", version: 1 };
  const pub = toPublic("events", rec);
  assert.equal(pub.gallery.length, 3);
  assert.equal(pub.featured_image_url, img(1).url);
  const html = recordComponent("event-gallery", "events", rec);
  assert.ok(!html.includes(img(1).url) && html.includes(img(2).url) && html.includes(img(3).url));
  assert.equal(recordComponent("event-gallery", "events", { ...rec, gallery: [img(1, { primary: true })] }), null);
});

/* ---- API round trip ------------------------------------------------------------------------ */
test("create, edit, reorder, change the cover and remove images; every change persists", async () => {
  const t = testApp();
  const { author } = await signedIn(t.app);
  const created = await author.post("/api/records/events", { data: { title: "Gallery event", gallery: [img(1), img(2), img(3, { featured: true })] } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.record.id;
  let r = (await author.get(`/api/records/events/${id}`)).data.record;
  assert.deepEqual(r.gallery.map((g) => g.url), [img(1).url, img(2).url, img(3).url]);
  assert.equal(r.featured_image_url, img(1).url);

  // Reorder (3, 1), make 3 the cover, drop 2, add 4. The dashboard sends the whole record.
  const gallery = [img(3, { primary: true, featured: true }), img(1), img(4, { featured: true })];
  const saved = await author.put(`/api/records/events/${id}`, { version: r.version, data: { ...r, gallery } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  r = (await author.get(`/api/records/events/${id}`)).data.record;
  assert.deepEqual(r.gallery.map((g) => [g.url, g.primary, g.featured]), [[img(3).url, true, true], [img(1).url, false, false], [img(4).url, false, true]]);
  assert.equal(r.featured_image_url, img(3).url, "the card image follows the new cover");
  assert.equal(r.featured_image_alt, "Photo 3");

  // A save that does not send the hidden single-image fields still gets them from the cover
  const { featured_image_url, featured_image_alt, ...withoutLegacy } = r;
  const again = await author.put(`/api/records/events/${id}`, { version: r.version, data: { ...withoutLegacy, gallery: [img(1, { primary: true })] } });
  assert.equal(again.status, 200);
  assert.equal(again.data.record.featured_image_url, img(1).url);

  const twoCovers = await author.put(`/api/records/events/${id}`, { version: again.data.record.version, data: { ...again.data.record, gallery: [img(1, { primary: true }), img(2, { primary: true })] } });
  assert.equal(twoCovers.status, 422);
  assert.match(twoCovers.data.error.errors.gallery, /one cover/);
  t.cleanup();
});

test("an existing single-image event keeps its image when edited without touching the images", async () => {
  const t = testApp();
  const { super: admin } = await signedIn(t.app);
  const before = (await admin.get("/api/records/events/evt_c0e615cab7")).data.record;
  assert.equal(before.gallery.length, 1);
  assert.equal(before.gallery[0].url, "/assets/images/masterclass-batch3-960.webp");
  const saved = await admin.put("/api/records/events/evt_c0e615cab7", { version: before.version, data: { ...before, summary: "Edited." } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.record.featured_image_url, "/assets/images/masterclass-batch3-960.webp");
  assert.equal(saved.data.record.gallery[0].primary, true);
  t.cleanup();
});

test("a published event's gallery reaches the public content; drafts do not", async () => {
  const t = testApp();
  const { super: admin } = await signedIn(t.app);
  const rec = (await admin.get("/api/records/events/evt_c0e615cab7")).data.record;
  const gallery = [img(9, { primary: true, featured: true }), img(8, { featured: true })];
  const saved = (await admin.put("/api/records/events/evt_c0e615cab7", { version: rec.version, data: { ...rec, gallery } })).data.record;
  let pub = (await client(t.app, USERS.super).get("/api/public/content")).data;
  assert.ok(!pub.events.some((e) => e.id === "evt_c0e615cab7"), "a draft is not public");
  const done = await admin.post("/api/records/events/evt_c0e615cab7/actions/publish", { version: saved.version });
  assert.equal(done.status, 200, JSON.stringify(done.data));
  pub = (await client(t.app, USERS.super).get("/api/public/content")).data;
  const live = pub.events.find((e) => e.id === "evt_c0e615cab7");
  assert.deepEqual(live.gallery.map((g) => g.url), [img(9).url, img(8).url]);
  assert.equal(live.featured_image_url, img(9).url);
  t.cleanup();
});

/* ---- Uploads and the photo library ----------------------------------------------------------- */
// Signs in through the development login and returns the session cookie (for raw requests)
async function sessionCookie(app, email) {
  const res = await app.handle(new Request("http://localhost/api/auth/dev-login", { method: "POST", headers: { "content-type": "application/json", "x-cms-csrf": "1" }, body: JSON.stringify({ email }) }));
  return res.headers.getSetCookie()[0].split(";")[0];
}

test("uploads: real JPEG/PNG/WebP only, size-limited, signed-in with CSRF, stored outside the record", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fwcms-up-"));
  const t = testApp({ env: { CMS_UPLOAD_DIR: dir } });
  const cookie = await sessionCookie(t.app, USERS.author);
  const upload = async (body, { headers = {}, signedIn = true, csrf = true } = {}) => {
    const res = await t.app.handle(new Request("http://localhost/api/media", {
      method: "POST", body,
      headers: { "content-type": "application/octet-stream", ...(csrf ? { "x-cms-csrf": "1" } : {}), ...(signedIn ? { cookie } : {}), ...headers },
    }));
    return { status: res.status, data: await res.json() };
  };
  const ok = await upload(PNG, { headers: { "x-file-name": encodeURIComponent("Room photo.png") } });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.match(ok.data.url, /^\/assets\/images\/uploads\/events\/\d{4}\/\d{2}\/[0-9a-f]{12}-room-photo\.png$/);
  assert.ok(existsSync(join(dir, ...ok.data.url.replace("/assets/images/uploads/", "").split("/"))));
  const svg = await upload(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), { headers: { "content-type": "image/png" } });
  assert.equal(svg.status, 415, "the bytes decide, not the declared type");
  assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1, 0xff))).status, 413);
  assert.equal((await upload(PNG, { signedIn: false })).status, 401);
  assert.equal((await upload(PNG, { csrf: false })).status, 403);
  t.cleanup();
  rmSync(dir, { recursive: true, force: true });
});

test("uploads to Supabase Storage go to the event-images bucket with the secret key, and report a missing bucket", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response("{}", { status: calls.length === 1 ? 200 : 404 }); };
  const cfg = { store: "supabase", supabaseUrl: "https://abc.supabase.co", supabaseServiceKey: "sb_secret_test", cmsRoot: join(process.cwd()), uploadDir: tmpdir() };
  const media = createMedia({ cfg, store: { kind: "supabase" }, log: { log: async () => {}, error() {} }, fetchImpl });
  const req = () => new Request("http://x/api/media", { method: "POST", body: PNG, headers: { "x-file-name": "a.png" } });
  const out = await media.upload({ email: USERS.author }, req());
  assert.match(calls[0].url, /^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/event-images\/events\/\d{4}\/\d{2}\/[0-9a-f]{12}-a\.png$/);
  assert.equal(calls[0].init.headers.apikey, "sb_secret_test");
  assert.equal(calls[0].init.headers.authorization, undefined, "new secret keys are not sent as a bearer token");
  assert.equal(calls[0].init.headers["content-type"], "image/png");
  assert.equal(out.url, calls[0].url.replace("/object/event-images/", "/object/public/event-images/"));
  await assert.rejects(media.upload({ email: USERS.author }, req()), (e) => e.status === 502 && /bucket is missing/.test(e.message));
});

test("file sniffing recognises JPEG, PNG and WebP, and nothing else", () => {
  assert.deepEqual(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), ["image/jpeg", "jpg"]);
  assert.deepEqual(sniffImage(PNG), ["image/png", "png"]);
  assert.deepEqual(sniffImage(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")), ["image/webp", "webp"]);
  for (const b of ["GIF89a", "<svg>", "%PDF-1.7", ""]) assert.equal(sniffImage(Buffer.from(b)), null, b);
});

test("the photo library lists the website's registered photos", async () => {
  const t = testApp();
  const { author } = await signedIn(t.app);
  const r = await author.get("/api/media/library");
  assert.equal(r.status, 200);
  const p = r.data.photos.find((x) => x.id === "presenter-qr");
  assert.ok(p && p.url === "/assets/images/web/presenter-qr-1280.webp" && p.alt);
  assert.equal((await client(t.app, "nobody@example.test").get("/api/media/library")).status, 401);
  t.cleanup();
});

/* ---- Website Events gallery ---------------------------------------------------------------- */
// Places tiles the way CSS grid auto-placement does (grid-auto-flow: dense) and counts the empty
// cells above the lowest tile: a hole would show as a gap in the masonry.
function holes(spans, cols) {
  const grid = [];
  const free = (r, c) => !grid[r]?.[c];
  for (const [w, h] of spans) {
    let placed = false;
    for (let r = 0; !placed; r++) {
      for (let c = 0; c + w <= cols && !placed; c++) {
        let fits = true;
        for (let y = r; y < r + h && fits; y++) for (let x = c; x < c + w && fits; x++) fits = free(y, x);
        if (!fits) continue;
        for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) (grid[y] ||= [])[x] = true;
        placed = true;
      }
    }
  }
  let empty = 0;
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < cols; c++) if (free(r, c)) empty++;
  return empty;
}

test("the masonry grid has no holes on desktop, tablet or phone, for any number of photos", () => {
  for (let n = 1; n <= 40; n++) {
    const s = spansFor(n);
    assert.equal(s.length, n);
    assert.equal(holes(s.map((x) => x.d), 12), 0, `desktop, ${n} photos`);
    assert.equal(holes(s.map((x) => x.t), 6), 0, `tablet, ${n} photos`);
    assert.equal(holes(s.map((x) => x.m), 2), 0, `phone, ${n} photos`);
  }
});

test("the Events gallery puts featured CMS event images first, never repeats a photo, and keeps the homepage to three rows of 18", () => {
  const events = [
    { rid: "evt_a", title: "Older", date: "2026-01-10", gallery: eventGalleryEntries([{ url: "/assets/images/web/room-full-1280.webp", alt: "", primary: true, featured: true }]) },
    { rid: "evt_b", title: "Newer", date: "2026-09-10", gallery: eventGalleryEntries([
      { url: "https://abc.supabase.co/storage/v1/object/public/event-images/x.jpg", alt: "Upload", primary: false, featured: true },
      { url: "/assets/images/web/group-community-1280.webp", alt: "", primary: true, featured: true },
      { url: "/assets/images/poster.webp", alt: "Poster", primary: false, featured: false },
    ]) },
  ];
  const items = galleryItems(events);
  assert.deepEqual(items.slice(0, 3).map((x) => x.photo || x.url), ["group-community", "https://abc.supabase.co/storage/v1/object/public/event-images/x.jpg", "room-full"], "newest event first, its cover first");
  assert.ok(!items.some((x) => x.url === "/assets/images/poster.webp"), "images not marked for the gallery stay out");
  const keys = items.map((x) => x.key);
  assert.equal(new Set(keys).size, keys.length, "group-community is also in the archive, but shown once");
  const home = eventGallery("home", events);
  assert.equal((home.match(/<li /g) || []).length, 18);
  assert.deepEqual((home.match(/data-srow="(\w+)"/g) || []).map((m) => m.slice(11, -1)), ["left", "right", "left"]);
  assert.ok(!/<figcaption/.test(home), "the rows carry no captions");
  assert.ok(!eventGallery("home", []).includes("poster"));
  assert.equal((eventGallery("all", []).match(/<li /g) || []).length, 30);
});
