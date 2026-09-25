# Faith Works Website

A premium, content-rich website for Faith Works — a practical education and business transformation platform focused on AI, business, leadership, purposeful growth, and real-world implementation.

Built with **plain HTML, CSS, and JavaScript** plus **JSON for content**, for maximum portability and an eventual **GoHighLevel (GHL)** handoff.

**No framework. No build step. No npm. No backend.**

---

## Architecture

| Layer | Where | What |
| --- | --- | --- |
| Structure | `*.html` | Pages, navigation, permanent sections |
| Design | `css/style.css` | The whole visual system |
| Interaction | `js/main.js` | Animations, menus, rendering JSON content, Insight article pages |
| Dynamic content | `assets/data/*.json` | Insights, events, resources, success stories, AI tools, social links |
| Media | `assets/images`, `assets/icons` | Photos, logos |

**Add data → content appears.** Adding an insight or an event means editing one JSON file, not five HTML pages.

## Running it locally

The JSON is loaded with `fetch()`, which browsers block on `file://` pages, so serve the folder:

```bash
python -m http.server 8000     # then open http://localhost:8000
```

Any static host (Vercel, Netlify, S3, a CDN) works as-is.

## Project structure

```text
fw/
├── index.html · learn.html · implement.html · scale.html · community.html · about.html
├── insight.html            # One Insight: insight.html?slug=<slug> (shareable, refreshable)
├── css/style.css
├── js/main.js
├── assets/
│   ├── data/
│   │   ├── insights.json         # Every Insight: cards on Home + Learn, and the article page (insight.html?slug=…)
│   │   ├── events.json           # Upcoming events; date { day, month, year } drives the yellow date card
│   │   ├── event-highlights.json # The photo/video gallery on Community (#highlights)
│   │   ├── resources.json        # Guides, frameworks, checklists, programs (Learn, Implement)
│   │   ├── programs.json         # The AI Workforce Accelerator and its tracks (Implement #program)
│   │   ├── success-stories.json  # Success stories (Home); drafts until real ones exist
│   │   ├── tools.json            # AI tools (Implement)
│   │   └── site.json             # Social icons + the Facebook Group call to action
│   ├── images/
│   └── icons/              # Wordmark, favicon, tools/ (AI tool logos)
├── docs/ (GHL-HANDOFF.md, IMAGE-SOURCES.md, concept PDF)
└── DESIGN.md
```

## Editing content

Each JSON file starts with a `_readme` describing its fields.

- **New insight:** add an object to `insights.json` with a unique `slug`. It appears on Learn (newest first, filterable by `topics`), opens at `insight.html?slug=<slug>`, and can be listed in other insights' `related`. Set `featured: true` on one insight to lead Home and Learn. Body `content` is a list of blocks: `paragraph`, `heading`, `subheading`, `list` (optionally `ordered`), `quote`, `callout` (examples, prompts), `takeaway`, `image`, `link`, `cta`. `resources` (ids from `resources.json`) adds a "Put it into practice" block at the end.
- **New event:** add an object to `events.json`. `status: "upcoming"` with a `date` shows it in full (Home features the `featured` one); without a date it's listed as "coming soon". `status: "past"` with a `gallery` of photos adds it to the Past Events gallery on Community (list newest first). Each event has ONE call to action: `registrationUrl` + `registrationLabel` (`https://` links open in a new tab). A past event with no photos or description shows "Details and photos coming soon"; past events also appear in Home's Event highlights strip.
- **Featured event:** set `featured: true` on one dated upcoming event. Home and Community both render it from that one record, with the same `.fw-event-feature` markup.
- **Resources:** add an object to `resources.json`. `type` (Guide, Framework, Checklist, Worksheet, Plan, Program, Event) sets the card's mark; `status` is `available`, `on-request` (added to the Implement request form automatically) or `coming-soon`. A resource with `eventRef` takes its title, text, photo, date and link from that event, so nothing is written twice.
- **Success stories:** edit `success-stories.json` (title, summary, category, image + imageAlt, url). The first story leads. The current records are `draft` layout slots (marked "Draft" on the page) — replace them with real, permitted stories and set `"showDrafts": false` before launch. Never invent a person, quote or result.
- **AI tools:** edit `tools.json` (name, `category`, `logo` in `assets/icons/tools/`, `url`, `description`; `home: true` also lists it on Home). Shown as examples, not endorsements.
- **Social links + Facebook Group:** edit `site.json` (`social` for the icons, `community` for the "Join the community" panel on Home and Community). Only add a channel once its URL is confirmed.

Images in JSON use `{ "base": "assets/images/name", "widths": [480, 960] }` (the site builds `name-480.webp` / `.jpg` …) or `{ "url": "https://…" }` for a single file, plus `width`, `height`, `alt` and `position`. Every insight, event and resource has an image. Temporary stock photos also carry `source` (their origin URL, output as `data-image-source`) and are listed in `docs/IMAGE-SOURCES.md`; an upcoming event using a photo from a past session says so in `caption`.

## Insight article pages

Every Insight card links to its own page, `insight.html?slug=…`: the site header and footer with the full article rendered from `insights.json` (category, title, date, cover image, body, "Put it into practice" resources, related insights, Back and Share). An unknown slug shows a "not found" state with a link back to Learn.

Social previews (Open Graph) for each Insight need per-page HTML, which a static JSON site can't generate; in GHL, Insights can become individual blog/CMS pages (see `docs/GHL-HANDOFF.md`).
