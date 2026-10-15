# Faith Works Website

The Faith Works homepage: practical AI learning for founders, professionals and teams.

**Current phase:** a single-page foundation rebuilt from Ms. Faith's approved single-HTML design
(`docs/source/faithworks-chatgpt-source.html`). Additional pages come after this page is reviewed and approved.

Built with **plain HTML, CSS and JavaScript**. No framework, no build step, no npm, no backend.

## Architecture

| Layer | Where | What |
| --- | --- | --- |
| Structure + copy | `index.html` | The whole page, in source order |
| Design | `css/style.css` | Tokens, components, motion graphics, responsive rules |
| Interaction | `js/main.js` | Navigation, examples, learning journey, dialogs, line-draw reveals |
| Media | `assets/icons`, `assets/images` | Wordmark, favicon, photography for later pages |
| Downloads | `assets/downloads` | The starter worksheet |

## Running it locally

```bash
python -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly also works, because nothing is fetched at runtime.

## Project structure

```text
fw/
├── index.html
├── css/style.css
├── js/main.js
├── assets/
│   ├── downloads/AI_Workflow_Starter.txt
│   ├── icons/          # wordmark, wordmark-reversed, favicon, tools/
│   ├── images/
│   └── data/           # JSON content from the earlier multi-page build, kept for later pages (not used yet)
├── docs/
│   ├── source/faithworks-chatgpt-source.html   # the approved design source (reference only)
│   └── GHL-HANDOFF.md · GHL-FORMS.md · IMAGE-SOURCES.md
└── DESIGN.md
```

## What works on the page

- Responsive navigation (menu below 1080px; Escape closes it) with the current section marked.
- Example tabs ("Make it concrete") and the five-step learning journey.
- Program details dialogs, FAQs, and the starter worksheet download.
- The inquiry builder: it prepares a `.txt` conversation brief **locally**. Nothing is submitted, because forms, calendar and CRM are not connected yet (see `docs/GHL-HANDOFF.md`).

## Motion graphics

Two SVG motifs from the earlier build are reused:

- **Build motif** (framework → workflow → system) on the dark "Don't stop at knowing" card. It assembles once in view, and the selected journey step controls how much of the system is built. Improve adds a signal flowing through it.
- **Corner circuits** on the yellow closing call to action. They draw in once.

All motion sits inside `prefers-reduced-motion: no-preference`. With reduced motion or without JS, the finished drawings show statically.

## Previous implementation

The earlier multi-page site (Learn, Build, Business, Community, Insights…) is preserved in Git history:
commit `faff08d` ("Snapshot multi-page implementation before single-page rebuild").
