// Newsletter: choose published resources -> AI writes the copy -> preview -> Approve or Reject.
// Approved issues become the RSS feed GoHighLevel reads. Nothing here sends email.
import { h, clear, api, toast, errorText, icon, dialog, busy, when, who } from "./dom.mjs";

const STATUS = { draft: ["Waiting for review", "badge--yellow"], approved: ["Approved · in the feed", "badge--green"], rejected: ["Rejected", "badge--stone"] };
const badge = (s) => h("span", { class: `badge ${STATUS[s]?.[1] || ""}` }, STATUS[s]?.[0] || s);

async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied.`, "ok"); } catch { toast(`Could not copy. Select the ${what.toLowerCase()} and copy it by hand.`, "error"); }
}

// The issue as it will read in the email (GHL fills the same parts from the feed).
function preview(issue, { editable = false, onChange } = {}) {
  const d = issue.data;
  const field = (key, label, rows, max) => editable
    ? h("div", { class: "field" }, h("label", { for: `nl-${key}` }, label), h(rows ? "textarea" : "input", { class: "input", id: `nl-${key}`, rows, maxlength: max, value: d[key] || "", oninput: (e) => onChange(key, e.target.value) }, rows ? d[key] || "" : null))
    : h("div", { class: "field" }, h("div", { class: "label" }, label), h("p", { class: "nl-text" }, d[key] || "—"));
  return h("div", { class: "card nl-preview" },
    h("div", { class: "two" }, field("subject", "Subject line", 0, 120), field("preview_text", "Preview text", 0, 160)),
    field("intro", "Introduction", 4, 900),
    h("div", { class: "label nl-label" }, `Resources (${d.items.length})`),
    h("ul", { class: "list nl-items" }, d.items.map((it) => h("li", {},
      it.image ? h("img", { class: "nl-img", src: it.image, alt: it.image_alt || "", loading: "lazy" }) : h("span", { class: "nl-img nl-img--none" }, "No image"),
      h("div", { class: "nl-item" },
        h("a", { href: it.url, target: "_blank", rel: "noopener" }, it.title),
        editable
          ? h("textarea", { class: "input", rows: 2, maxlength: 400, "aria-label": `Summary for ${it.title}`, oninput: (e) => onChange("item", e.target.value, it.resource_id) }, it.summary)
          : h("p", { class: "nl-text" }, it.summary),
        h("span", { class: "small mono" }, it.url))))),
    h("div", { class: "two" }, field("cta_label", "Button label", 0, 40), field("closing", "Closing", 2, 400)));
}

export async function newsletterView(app) {
  const body = h("div", {});
  let state;

  async function load() {
    state = await api("GET", "/api/newsletter");
    render();
  }

  function render() {
    const s = state, c = s.configured;
    const feedUrl = new URL(s.feed_url, location.origin).href; // absolute even when CMS_BASE_URL is unset locally
    const missing = [!c.ai && "ANTHROPIC_API_KEY", !c.resourceUrl && "NEWSLETTER_RESOURCE_URL", !c.assetOrigin && "NEWSLETTER_ASSET_ORIGIN (images)"].filter(Boolean);
    const feed = h("div", { class: "card" },
      h("h2", {}, "RSS feed for GoHighLevel"),
      h("p", {}, "Paste this address into the GHL email campaign (Send or schedule → RSS Schedule). It always shows the latest approved newsletter."),
      h("div", { class: "row" }, h("code", { class: "mono nl-url" }, feedUrl),
        h("button", { class: "btn btn--light btn--sm", type: "button", onclick: () => copy(feedUrl, "Feed address") }, "Copy address"),
        h("button", { class: "btn btn--light btn--sm", type: "button", onclick: async () => { try { const r = await fetch("/rss.xml", { credentials: "same-origin" }); copy(await r.text(), "Feed XML"); } catch (e) { toast(errorText(e), "error"); } } }, "Copy XML")),
      s.approved ? h("p", { class: "small" }, "In the feed now: ", h("strong", {}, s.approved.data.subject), ` · approved ${when(s.approved.data.approved_at)} by ${who(s.approved.data.approved_by)}`) : h("p", { class: "small" }, "No newsletter has been approved yet, so the feed has no items."));

    clear(body,
      missing.length ? h("div", { class: "alert alert--warn" }, h("div", {}, h("p", {}, h("strong", {}, "Setup needed. "), `A developer needs to set ${missing.join(", ")} in Vercel.`))) : null,
      s.draft ? draftCard(s.draft) : pickCard(),
      feed,
      s.recent.length ? h("div", { class: "card" }, h("h2", {}, "Recent newsletters"), h("ul", { class: "list" }, s.recent.map((r) => h("li", {}, badge(r.status), h("span", {}, r.subject || "(no subject)"), h("span", { class: "spacer" }), h("span", { class: "small" }, `${when(r.created_at)} · ${who(r.created_by)}`))))) : null);
  }

  function pickCard() {
    const chosen = new Set(state.resources.filter((r) => !r.already_sent).slice(0, 4).map((r) => r.id));
    const count = h("span", { class: "small" });
    const gen = h("button", { class: "btn", type: "button" }, "Generate newsletter");
    const sync = () => { count.textContent = `${chosen.size} selected`; gen.disabled = !chosen.size || !state.configured.ai; };
    gen.onclick = (e) => busy(e.currentTarget, async () => {
      try { await api("POST", "/api/newsletter/generate", { resourceIds: [...chosen] }); toast("Newsletter drafted. Review it below.", "ok"); await load(); }
      catch (err) { toast(errorText(err), "error"); }
    });
    sync();
    return h("div", { class: "card" },
      h("h2", {}, "1. Choose resources"),
      h("p", {}, "Only published resources are listed. Resources that were already in an approved newsletter are marked."),
      state.resources.length ? h("ul", { class: "list" }, state.resources.map((r) => h("li", {},
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: chosen.has(r.id), onchange: (e) => { e.target.checked ? chosen.add(r.id) : chosen.delete(r.id); sync(); } }), h("span", {}, r.title)),
        r.already_sent ? h("span", { class: "badge badge--stone" }, "Already sent") : null,
        h("span", { class: "spacer" }), h("span", { class: "small" }, r.published_at ? when(r.published_at) : "")))) : h("p", {}, "No published resources yet."),
      h("div", { class: "row nl-actions" }, gen, count));
  }

  function draftCard(issue) {
    const edits = {};
    const items = {};
    const save = h("button", { class: "btn btn--light", type: "button", hidden: true }, "Save changes");
    const onChange = (key, value, id) => { if (key === "item") items[id] = value; else edits[key] = value; save.hidden = false; };
    const act = (path, msg) => (e) => busy(e.currentTarget, async () => {
      try {
        if (!save.hidden) { toast("Save or discard your changes first.", "error"); return; }
        const r = await api("POST", `/api/newsletter/${encodeURIComponent(issue.id)}/${path}`, { version: issue.version });
        toast(msg + (r.webhook?.sent ? " GHL was notified." : ""), "ok"); await load();
      } catch (err) { toast(errorText(err), "error"); }
    });
    save.onclick = (e) => busy(e.currentTarget, async () => {
      try {
        await api("PUT", `/api/newsletter/${encodeURIComponent(issue.id)}`, { version: issue.version, data: { ...edits, items: Object.entries(items).map(([resource_id, summary]) => ({ resource_id, summary })) } });
        toast("Changes saved.", "ok"); await load();
      } catch (err) { toast(errorText(err), "error"); }
    });
    const approve = h("button", { class: "btn", type: "button", onclick: async (e) => {
      const btn = e.currentTarget;
      const r = await dialog({ title: "Approve this newsletter?", body: "It replaces the current issue in the RSS feed. GoHighLevel sends it at its next RSS schedule run. No email is sent from the CMS.", confirm: "Approve" });
      if (r.ok) act("approve", "Approved. The RSS feed now shows this newsletter.")({ currentTarget: btn });
    } }, "Approve");
    const reject = h("button", { class: "btn btn--light", type: "button", onclick: async (e) => {
      const btn = e.currentTarget;
      const r = await dialog({ title: "Reject this draft?", body: "It is discarded and the feed stays as it is. You can then choose resources and generate again.", confirm: "Reject", danger: true });
      if (r.ok) act("reject", "Draft rejected.")({ currentTarget: btn });
    } }, "Reject");
    return h("div", {},
      h("div", { class: "card" }, h("div", { class: "row" }, h("h2", {}, "2. Review the draft"), badge(issue.status)),
        h("p", {}, `Written by AI ${when(issue.created_at)}${issue.data.source === "cron" ? " (scheduled)" : ` for ${who(issue.created_by)}`}. Check every fact and link, then approve or reject it.`),
        h("div", { class: "row nl-actions" }, approve, reject, save)),
      preview(issue, { editable: true, onChange }));
  }

  await load();
  return h("div", {},
    h("div", { class: "page-head" }, h("div", {}, h("h1", {}, "Newsletter"), h("p", {}, "Turn published resources into a newsletter for GoHighLevel. GHL handles the audience, scheduling, sending and unsubscribes."))),
    body);
}
