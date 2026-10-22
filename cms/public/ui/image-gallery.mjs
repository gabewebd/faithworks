// The event image manager (field type "images"): an ordered list of photos, one of them the
// cover. Photos are added by uploading files (POST /api/media, one file per request, so one
// failure never loses the others), by picking photos already on the website (GET
// /api/media/library) or by pasting an address. Each photo has its description (alt text), a
// Cover choice (radio buttons, so there is always exactly one), "Show in the events gallery",
// and can be moved with drag and drop or the arrow buttons, or removed. Nothing is stored on the
// event until the editor saves; uploaded files are kept in storage either way.
// Returns the widget shape fields.mjs expects: { el, control, get, set, invalid }.
import { h, clear, toast, dialog } from "./dom.mjs";
import { checkUrl } from "/shared/validate.mjs";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;
const IMAGE_SRC = /^(\/(?!\/)|https?:\/\/)/i;

let uid = 0;

export function imageGallery({ id, value, disabled = false, onChange, describedBy, max = 24, src = (u) => u }) {
  const gid = `ig${++uid}`;
  let items = [];
  const list = h("ol", { class: "imgs", id, "aria-describedby": describedBy || null });
  const status = h("p", { class: "imgs__status", role: "status", "aria-live": "polite" });
  const count = h("span", { class: "imgs__count" });
  const file = h("input", { type: "file", accept: TYPES.join(","), multiple: true, hidden: true });
  const uploadBtn = h("button", { type: "button", class: "btn btn--light btn--sm", disabled, onclick: () => file.click() }, "Upload photos");
  const libraryBtn = h("button", { type: "button", class: "btn btn--light btn--sm", disabled, onclick: pickFromLibrary }, "Choose from website photos");
  const urlBtn = h("button", { type: "button", class: "btn btn--ghost btn--sm", disabled, onclick: addByAddress }, "Add by address");
  const el = h("div", { class: "imgs-field" }, h("div", { class: "row imgs__tools" }, uploadBtn, libraryBtn, urlBtn, h("span", { class: "spacer" }), count), file, status, list);

  const changed = () => onChange?.();
  const has = (url) => items.some((x) => x.url === url);
  const room = () => max - items.length;

  function add(entries) {
    const fresh = entries.filter((x) => x.url && !has(x.url)).slice(0, Math.max(0, room()));
    if (fresh.length < entries.length) toast(room() <= 0 ? `An event can have up to ${max} images.` : "Images already in the list were skipped.", "info");
    if (!fresh.length) return;
    for (const x of fresh) items.push({ url: x.url, alt: x.alt || "", primary: !items.length, featured: x.featured !== false });
    render();
    changed();
    list.querySelector(`[data-url="${CSS.escape(fresh[0].url)}"] .imgs__alt`)?.focus();
  }

  function move(from, to) {
    if (to < 0 || to >= items.length || from === to) return;
    const [x] = items.splice(from, 1);
    items.splice(to, 0, x);
    render();
    changed();
  }

  function render() {
    count.textContent = `${items.length} of ${max}`;
    if (!items.length) { clear(list, h("li", { class: "imgs__empty" }, "No images yet. The event card shows no picture.")); return; }
    clear(list, items.map((x, i) => {
      const alt = h("input", { class: "input imgs__alt", type: "text", maxlength: 200, value: x.alt, disabled, "aria-label": `Description of image ${i + 1} (alt text)`, placeholder: "Describe what the photo shows" });
      alt.addEventListener("input", () => { x.alt = alt.value; changed(); });
      const cover = h("input", { type: "radio", name: `${gid}-cover`, checked: x.primary, disabled, id: `${gid}-c${i}` });
      cover.addEventListener("change", () => { items.forEach((y) => { y.primary = y === x; }); render(); changed(); list.querySelector(`#${gid}-c${items.indexOf(x)}`)?.focus(); });
      const featured = h("input", { type: "checkbox", checked: x.featured, disabled, id: `${gid}-f${i}` });
      featured.addEventListener("change", () => { x.featured = featured.checked; changed(); });
      const thumb = h("img", { class: "imgs__thumb", src: src(x.url), alt: "", loading: "lazy" });
      thumb.addEventListener("error", () => thumb.classList.add("is-broken"));
      const btn = (label, text, fn, off) => h("button", { type: "button", class: "btn btn--ghost btn--sm", "aria-label": label, disabled: disabled || off, onclick: fn }, text);
      // The photo is the drag handle (so text in the description can still be selected)
      const media = h("div", { class: "imgs__media", draggable: disabled ? null : "true", title: disabled ? null : "Drag to reorder" }, thumb, x.primary ? h("span", { class: "imgs__badge" }, "Cover") : null);
      const li = h("li", { class: `imgs__item${x.primary ? " is-cover" : ""}`, dataset: { url: x.url } },
        media,
        h("div", { class: "imgs__body" },
          alt,
          h("div", { class: "imgs__opts" },
            h("label", { class: "imgs__opt", for: cover.id }, cover, " Cover image"),
            h("label", { class: "imgs__opt", for: featured.id }, featured, " Show in the events gallery")),
          h("p", { class: "imgs__url mono", title: x.url }, x.url)),
        h("div", { class: "imgs__actions" },
          btn(`Move image ${i + 1} up`, "↑", () => { move(i, i - 1); list.children[i - 1]?.querySelector("button")?.focus(); }, i === 0),
          btn(`Move image ${i + 1} down`, "↓", () => { move(i, i + 1); list.children[i + 1]?.querySelectorAll("button")[1]?.focus(); }, i === items.length - 1),
          btn(`Remove image ${i + 1}`, "Remove", () => remove(i))));
      media.addEventListener("dragstart", (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("application/x-cms-image", String(i)); e.dataTransfer.setDragImage(thumb, 20, 20); li.classList.add("is-dragging"); });
      media.addEventListener("dragend", () => li.classList.remove("is-dragging"));
      li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("is-over"); });
      li.addEventListener("dragleave", () => li.classList.remove("is-over"));
      li.addEventListener("drop", (e) => {
        const from = e.dataTransfer.getData("application/x-cms-image");
        li.classList.remove("is-over");
        if (from === "") return; // not one of these photos (e.g. text dropped on a description)
        e.preventDefault();
        move(Number(from), i);
      });
      return li;
    }));
  }

  function remove(i) {
    const [gone] = items.splice(i, 1);
    if (gone.primary && items.length) items[0].primary = true;
    render();
    changed();
    status.textContent = gone.primary && items.length ? "Image removed. The first image is now the cover." : "Image removed.";
    (list.children[Math.min(i, items.length - 1)]?.querySelector(".imgs__alt") || uploadBtn).focus();
  }

  async function uploadOne(f) {
    const res = await fetch("/api/media", {
      method: "POST", credentials: "same-origin", body: f,
      headers: { accept: "application/json", "content-type": f.type, "x-file-name": encodeURIComponent(f.name), "x-cms-csrf": "1" },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message || `Upload failed (${res.status}).`);
    return data;
  }

  file.addEventListener("change", async () => {
    const files = [...file.files];
    file.value = "";
    if (!files.length) return;
    if (files.length > room()) toast(`Only ${Math.max(0, room())} more image(s) fit (up to ${max}).`, "error");
    const todo = files.slice(0, Math.max(0, room()));
    uploadBtn.disabled = true;
    let done = 0;
    const failed = [];
    for (const f of todo) {
      status.textContent = `Uploading ${done + failed.length + 1} of ${todo.length}: ${f.name}…`;
      try {
        if (!TYPES.includes(f.type)) throw new Error("Use a JPEG, PNG or WebP photo.");
        if (f.size > MAX_MB * 1024 * 1024) throw new Error(`The file is larger than ${MAX_MB} MB.`);
        const up = await uploadOne(f);
        add([{ url: up.url }]);
        done++;
      } catch (e) { failed.push(`${f.name}: ${e.message}`); }
    }
    uploadBtn.disabled = disabled;
    status.textContent = `${done} of ${todo.length} uploaded.${done ? " Add a description to each photo, then save." : ""}`;
    if (failed.length) toast(`Not uploaded: ${failed.join(" · ")}`, "error", 9000);
  });

  async function pickFromLibrary() {
    let photos;
    try {
      const res = await fetch("/api/media/library", { credentials: "same-origin", headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ({ photos } = await res.json());
    } catch (e) { toast(`The website photos could not be loaded. ${e.message}`, "error"); return; }
    if (!photos.length) { toast("No website photos are available here.", "info"); return; }
    const boxes = photos.map((p, i) => {
      const inList = has(p.url);
      const cb = h("input", { type: "checkbox", id: `${gid}-lib${i}`, value: String(i), checked: inList, disabled: inList });
      return h("label", { class: `imgs-lib__item${inList ? " is-added" : ""}`, for: cb.id, title: p.alt }, cb, h("img", { src: src(p.thumb), alt: "", loading: "lazy" }), h("span", { class: "sr-only" }, p.alt));
    });
    const r = await dialog({ title: "Choose from website photos", body: "Photos already on the Faith Works website. Selected photos are added with their descriptions.", content: h("div", { class: "imgs-lib" }, boxes), confirm: "Add selected", wide: true });
    if (!r.ok) return;
    add(boxes.map((b) => b.querySelector("input")).filter((c) => c.checked && !c.disabled).map((c) => photos[Number(c.value)]).map((p) => ({ url: p.url, alt: p.alt })));
  }

  async function addByAddress() {
    const r = await dialog({ title: "Add an image by address", note: { label: "Image address (https://… or /assets/images/…)", required: true }, confirm: "Add image" });
    if (!r.ok) return;
    const url = r.value.trim();
    const problem = IMAGE_SRC.test(url) ? checkUrl(url) : "Use an https:// address or a site path starting with /.";
    if (problem) { toast(problem, "error"); return; }
    add([{ url, featured: false }]);
  }

  function set(v) { items = (Array.isArray(v) ? v : []).filter((x) => x?.url).map((x) => ({ url: x.url, alt: x.alt || "", primary: !!x.primary, featured: !!x.featured })); if (items.length && !items.some((x) => x.primary)) items[0].primary = true; render(); }
  set(value);
  return {
    el, control: uploadBtn,
    get: () => items.map((x) => ({ url: x.url, alt: x.alt.trim(), primary: x.primary, featured: x.featured })),
    set,
    invalid: (on) => el.toggleAttribute("data-invalid", on),
  };
}
