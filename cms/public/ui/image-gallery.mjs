// The event image manager (field type "images"): an ordered list of photos, one of them the
// cover. Photos are added by address only (until dedicated media storage exists): the address
// is checked, and the image must actually load, with a preview shown, before it can be added.
// Each photo has its description (alt text), a Cover choice (radio buttons, so there is always
// exactly one), "Show in the events gallery", and can be moved with drag and drop or the arrow
// buttons, or removed. Nothing is stored on the event until the editor saves.
// Returns the widget shape fields.mjs expects: { el, control, get, set, invalid }.
import { h, clear, toast } from "./dom.mjs";
import { checkUrl } from "/shared/validate.mjs";

// New images: an https:// address or a path on the website (/assets/images/…)
const IMAGE_SRC = /^(\/(?!\/)|https:\/\/)/i;
const LOAD_TIMEOUT_MS = 15000;

let uid = 0;

export function imageGallery({ id, value, disabled = false, onChange, describedBy, max = 24, src = (u) => u }) {
  const gid = `ig${++uid}`;
  let items = [];
  const list = h("ol", { class: "imgs", id, "aria-describedby": describedBy || null });
  const status = h("p", { class: "imgs__status", role: "status", "aria-live": "polite" });
  const count = h("span", { class: "imgs__count" });
  const urlBtn = h("button", { type: "button", class: "btn btn--light btn--sm", disabled, onclick: addByAddress }, "Add by address");
  const el = h("div", { class: "imgs-field" }, h("div", { class: "row imgs__tools" }, urlBtn, h("span", { class: "spacer" }), count), status, list);

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
    (list.children[Math.min(i, items.length - 1)]?.querySelector(".imgs__alt") || urlBtn).focus();
  }

  // What is wrong with an address before trying to load it, or null.
  const addressProblem = (url) => {
    if (!url) return "Enter the image address.";
    if (!IMAGE_SRC.test(url)) return "Use an https:// address or a path on the website starting with /.";
    const e = checkUrl(url);
    if (e) return e;
    if (has(url)) return "This image is already in the list.";
    if (room() <= 0) return `An event can have up to ${max} images.`;
    return null;
  };

  // The address dialog: Add stays off until the address passes the checks and the image has
  // loaded (shown as a preview with its size). Nothing is added if the dialog is cancelled.
  function addByAddress() {
    const fid = `${gid}-addr`;
    const input = h("input", { class: "input", id: fid, type: "url", inputmode: "url", autocomplete: "off", spellcheck: "false", placeholder: "https://… or /assets/images/…", "aria-describedby": `${fid}-help ${fid}-msg` });
    const msg = h("p", { class: "imgs-addr__msg small", id: `${fid}-msg`, role: "status", "aria-live": "polite" });
    const preview = h("img", { class: "imgs-addr__preview", alt: "", hidden: true });
    const ok = h("button", { class: "btn", type: "submit", value: "ok", disabled: true }, "Add image");
    let checked = "", seq = 0, timer;
    const say = (text, bad = false) => { msg.textContent = text; msg.classList.toggle("error", bad); input.toggleAttribute("aria-invalid", bad); };
    function check() {
      const url = input.value.trim(), mine = ++seq;
      checked = ""; ok.disabled = true; preview.hidden = true;
      const problem = addressProblem(url);
      if (problem) { say(url ? problem : "", !!url); return; }
      say("Checking the image…");
      const probe = new Image();
      const done = (fn) => { clearTimeout(timer); if (mine === seq) fn(); };
      timer = setTimeout(() => done(() => say("The image took too long to load. Check the address, or try again.", true)), LOAD_TIMEOUT_MS);
      probe.onload = () => done(() => {
        if (!probe.naturalWidth) { say("This address did not return an image.", true); return; }
        checked = url; ok.disabled = false;
        preview.src = probe.src; preview.hidden = false;
        say(`Image found: ${probe.naturalWidth} × ${probe.naturalHeight} pixels.${probe.naturalWidth < 800 ? " It is small, so it may look soft on large screens." : ""}`);
      });
      probe.onerror = () => done(() => say("This address did not load an image. Use a public link straight to a JPEG, PNG or WebP file (not a web page or a private link).", true));
      probe.src = src(url);
    }
    let debounce;
    input.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(check, 400); });
    const d = h("dialog", {},
      h("form", { method: "dialog", class: "dlg", novalidate: true }, // site paths are not "valid" type=url values
        h("h2", {}, "Add an image by address"),
        h("div", { class: "field" }, h("label", { for: fid }, "Image address", h("span", { class: "req" }, " *")),
          h("p", { class: "help", id: `${fid}-help` }, "A public https:// link straight to the image file, or a website path such as /assets/images/workshop.jpg."),
          input, msg),
        preview,
        h("div", { class: "row" }, h("button", { class: "btn btn--light", type: "button", onclick: () => d.close("cancel") }, "Cancel"), ok)));
    d.querySelector("form").addEventListener("submit", (ev) => {
      // Enter before the check finished, or after the address changed: check it, do not add
      if (!checked || checked !== input.value.trim()) { ev.preventDefault(); clearTimeout(debounce); check(); return; }
      d.returnValue = "ok";
    });
    d.addEventListener("close", () => {
      clearTimeout(debounce); clearTimeout(timer); seq++;
      if (d.returnValue === "ok" && checked) add([{ url: checked, featured: false }]);
      d.remove();
      urlBtn.focus();
    });
    document.body.append(d);
    d.showModal();
    input.focus();
  }

  function set(v) { items = (Array.isArray(v) ? v : []).filter((x) => x?.url).map((x) => ({ url: x.url, alt: x.alt || "", primary: !!x.primary, featured: !!x.featured })); if (items.length && !items.some((x) => x.primary)) items[0].primary = true; render(); }
  set(value);
  return {
    el, control: urlBtn,
    get: () => items.map((x) => ({ url: x.url, alt: x.alt.trim(), primary: x.primary, featured: x.featured })),
    set,
    invalid: (on) => el.toggleAttribute("data-invalid", on),
  };
}
