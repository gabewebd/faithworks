# Faith Works Website

The faithph.ai website for Faith Works PH: practical AI learning for founders, professionals and teams.
Built to the *Faith Works Brand and Website Development Brief v2.0* (15 October 2026).

**Current phase:** staging. Every page in the brief's sitemap exists. Forms are designed and tested but
**not connected** to a CRM yet (preview mode: nothing is sent). The pages are `noindex` until launch.

Plain HTML, CSS and JavaScript. No framework, no npm packages, no backend. A small Node script generates
the pages so that the header, footer and repeated content (programs, events, articles) come from one place.

## Run it locally

```bash
node tools/build.mjs                         # regenerate pages after editing src/ or assets/data/
```

Then open `index.html` directly, or use any local server (VS Code Live Server, `python -m http.server`).
The default build writes **relative** links (`css/style.css`, `../learn/index.html`), so styles, images
and navigation work from disk, from a sub-folder, or from a server root.

For production on a host that serves this folder at the domain root, build with clean URLs instead:

```bash
node tools/build.mjs --deploy                # root-relative links: /learn/, /css/style.css
```

## Where things live

| Path | What |
| --- | --- |
| `src/pages/*.html` | Page bodies. Each starts with a `<!--meta {...}-->` header (route, title, description, nav). `{{renderer}}` tokens insert generated content. |
| `assets/data/programs.json` | Programs → `/learn/` cards and one `/programs/{slug}/` page each. Leave fee/dates `null` until approved. |
| `assets/data/events.json` | Events → `/workshops/` (upcoming vs past), each with its own `destination` (external, internal or notify). |
| `assets/data/resources.json`, `insights.json` | Resources list and articles (`/resources/{slug}/`). Articles are drafts. |
| `assets/data/site.json` | `staging` flag, contact email, social and community URLs, `starterKitReady`. |
| `tools/build.mjs`, `layout.mjs`, `render.mjs` | The generator, shared page chrome, and content/form renderers. |
| `css/style.css` | The design system: tokens, components, states, responsive and reduced-motion rules. |
| `js/main.js` | Navigation, tabs, program selector, thank-you state, analytics events (`dataLayer`, no personal data). |
| `js/forms.js`, `js/config.js` | Form validation, states and submission; `config.js` sets the form mode (`preview` / `endpoint`) and the kit download URL. Never put secrets here. |
| `docs/01–07_*.docx` | Project documents: scope, audit, gap list, architecture, copy, forms spec, acceptance checklist. |

Generated output (do not edit by hand): `index.html`, `404.html`, `sitemap.xml`, `robots.txt` and the
route folders `about/ build/ business/ community/ contact/ free-ai-starter-kit/ learn/ privacy/ programs/
resources/ speaking/ terms/ workshops/`.

## Before launch

See `docs/07_Implementation_and_Acceptance_Checklist.docx`. In short: connect forms in GHL and pass the
brief §14 tests, publish the final Starter Kit and set `starterKit.downloadUrl`, approve copy and legal pages,
then set `"staging": false` (and `"starterKitReady": true`) in `site.json` and rebuild.

## History

- `main`: the earliest multi-page build (SVG motifs originate here).
- `faff08d`: multi-page snapshot before the single-page rebuild.
- `c34bb13`: single-page homepage from Ms. Faith's approved HTML (`docs/source/faithworks-chatgpt-source.html`).
- Uncommitted homepage work from before the full-site build is saved as a git stash entry:
  `backup: homepage WIP before full-site build (2026-10-15)`.
