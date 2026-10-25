// Event images: uploads and the site's photo library.
//
// upload   One image file per request (the dashboard sends several in a row). The bytes must
//          really be a JPEG, PNG or WebP (checked from the file itself, never from its name or
//          the browser's content type; SVG is refused because it can carry scripts), and at most
//          MAX_BYTES. Only the image's address is stored on the event, never the file itself.
//            supabase store: Supabase Storage, public bucket "event-images" (created by
//                            supabase/migrations/20261022000000_event_galleries.sql)
//            json store (local development): the website's assets/images/uploads/ folder, so the
//                            local site build and the dashboard preview show it at once
// library  The photos already on the website (src/data/gallery.json and its web versions), so an
//          editor can pick one without uploading it again.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { HttpError } from "../http.mjs";
import { slugify } from "../../shared/validate.mjs";

export const MAX_BYTES = 5 * 1024 * 1024;
export const BUCKET = "event-images";

// Signature → [content type, extension]
export function sniffImage(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ["image/jpeg", "jpg"];
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ["image/png", "png"];
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return ["image/webp", "webp"];
  return null;
}

// A storage name nobody can guess or collide with: events/2026/10/<random>-<name>.<ext>
function objectName(fileName, ext, now = new Date()) {
  const base = slugify(String(fileName || "").replace(/\.[a-z0-9]{2,5}$/i, "")).slice(0, 50) || "image";
  const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `events/${month}/${randomBytes(6).toString("hex")}-${base}.${ext}`;
}

export function createMedia({ cfg, store, log, fetchImpl = globalThis.fetch }) {
  const repo = join(cfg.cmsRoot, "..");

  async function readBody(request) {
    const declared = Number(request.headers.get("content-length"));
    if (declared > MAX_BYTES) throw new HttpError(413, `The image is too large. Upload files of up to ${MAX_BYTES / 1024 / 1024} MB.`, "too_large");
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new HttpError(413, `The image is too large. Upload files of up to ${MAX_BYTES / 1024 / 1024} MB.`, "too_large");
    if (!buf.length) throw new HttpError(400, "The file is empty.", "empty_file");
    return buf;
  }

  async function toSupabase(name, buf, type) {
    const key = cfg.supabaseServiceKey;
    const auth = { apikey: key, ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}) };
    const res = await fetchImpl(`${cfg.supabaseUrl}/storage/v1/object/${BUCKET}/${name}`, {
      method: "POST", headers: { ...auth, "content-type": type, "cache-control": "31536000", "x-upsert": "false" }, body: buf,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      log?.error?.(`Image upload to Supabase Storage failed: HTTP ${res.status} ${detail.slice(0, 300)}`);
      throw new HttpError(502, res.status === 404 ? "Image storage is not set up yet (the event-images bucket is missing). Ask a developer to run the latest Supabase migration." : "The image could not be stored. Nothing was changed; try again.", "upload_failed");
    }
    return `${cfg.supabaseUrl}/storage/v1/object/public/${BUCKET}/${name}`;
  }

  function toLocalFolder(name, buf) {
    const file = join(cfg.uploadDir, ...name.split("/"));
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, buf, { flag: "wx" });
    return `/assets/images/uploads/${name}`;
  }

  return {
    async upload(user, request, { requestId } = {}) {
      const buf = await readBody(request);
      const kind = sniffImage(buf);
      if (!kind) throw new HttpError(415, "Upload a JPEG, PNG or WebP photo.", "unsupported_type");
      const [type, ext] = kind;
      const fileName = decodeURIComponent(request.headers.get("x-file-name") || "");
      const name = objectName(fileName, ext);
      const url = cfg.store === "supabase" ? await toSupabase(name, buf, type) : toLocalFolder(name, buf);
      await log.log(user, "upload_image", "events", "", null, url, requestId);
      return { url, name: fileName || name.split("/").pop(), type, bytes: buf.length };
    },

    library() {
      const reg = join(repo, "src", "data", "gallery.json"), lockFile = join(repo, "src", "data", "gallery.lock.json");
      if (!existsSync(reg) || !existsSync(lockFile)) return { photos: [] };
      const { images = {} } = JSON.parse(readFileSync(reg, "utf8"));
      const lock = JSON.parse(readFileSync(lockFile, "utf8"));
      const photos = Object.entries(images).filter(([id]) => lock[id]).map(([id, p]) => ({
        id, url: `/assets/images/web/${id}-1280.webp`, thumb: `/assets/images/web/${id}-640.webp`, alt: p.alt || "", width: lock[id].width, height: lock[id].height,
      }));
      return { photos };
    },
  };
}
