> **Superseded (15 Oct 2026).** Kept for history. Current guidance: `docs/04_Architecture_and_Recommendations.docx` and `docs/06_Forms_and_Lead_Capture_Specification.docx` (scope, audit and gaps in docs 01–03). File names below refer to the earlier build.

# Faith Works — Implementation assessment (Sprint 1)

Prepared 15 October 2026 against the *Faith Works Brand and Website Development Brief v2.0* (15 Oct 2026).
Status labels: **Verified** (checked in this audit) · **Assumed** (not checked; needs the account owner) · **Decision** (needs Faith's approval).

---

## 1. Current architecture and hosting

| Item | Finding | Status |
| --- | --- | --- |
| Live site platform | faithph.ai is served by **GoHighLevel** (`x-ghl-serve-region`, `x-ghl-cache` headers; assets from `leadconnectorhq.com` / `msgsndr.com`), behind Cloudflare. | Verified |
| DNS | Nameservers `ns31/ns32.domaincontrol.com` = **GoDaddy**. Registrar account owner not known. | Verified (NS) / Assumed (owner) |
| Live content | Title "Faith Works \| Faith AI"; "Launching Soon" / "Notify Me" page with a GHL survey/form; stray template text "Nails" still present (brief §0). | Verified |
| Live form | One GHL form/survey ("Notify Me"). Where its submissions go (pipeline, workflow, owner) is unknown. **Must not be broken.** | Verified (exists) / Assumed (routing) |
| Analytics | No GTM / gtag / Meta pixel found on the live page. | Verified (public HTML only) |
| GHL account access, staging URL, plan level, email sending domain | Not available to this audit. | Needs access |
| Local build | Plain HTML/CSS/JS, no build step, no backend. Designed to be pasted into GHL Custom HTML sections with CSS/JS on a CDN (`docs/GHL-HANDOFF.md`). | Verified |

### Git state

| Ref | Contents |
| --- | --- |
| `main` | Early multi-page build (index, learn, implement, scale, community, about, insight). Behind. |
| `faff08d` (on `revision`) | **Most complete multi-page build**: every brief route incl. `/free-ai-starter-kit`, thank-you, privacy, contact, speaking, workshops, resources, build, business. Forms present but placeholder (`data-fw-demo`). |
| `revision` HEAD `c34bb13` + uncommitted edits | Single-page homepage rebuilt from Ms. Faith's approved source (`docs/source/faithworks-chatgpt-source.html`), with upgraded motion/visuals. Other pages removed. **Uncommitted changes to index.html, style.css, main.js should be committed before further work.** |

---

## 2. Page and template inventory (brief §2, §10–12)

| Requirement | Route | Exists today | Gap | Acceptance test |
| --- | --- | --- | --- | --- |
| Home | `/` | Yes — `revision` single page | Hero CTAs/nav not yet to brief (see §6 conflict). Gallery uses stock placeholders. Starter CTA points to `.txt` worksheet. | Brief §3 copy; nav + CTAs reach correct routes; 360/768/desktop |
| Learn AI | `/learn` | `faff08d` | Program cards need status/format/requirements per brief; programs.json statuses need Faith's confirmation | Cards show audience, outcomes, format, requirements, status; CTA to detail |
| Program detail template | `/programs/{slug}` | **No** | Build one template driven by `programs.json`; hide empty sections | Each field from §2 renders; empty sections hidden; registration/waitlist CTA works |
| Workshops | `/workshops` | `faff08d` | Verify upcoming/past split, Asia/Manila time, capacity/status; Sept–early Oct 2026 events must be past | Event states (upcoming, sold-out, waitlist, past) render correctly |
| Build with AI | `/build` | `faff08d` | Faith AI scope/status unconfirmed; demo form placeholder | Training vs demo vs supported product distinguished; demo form stores use case |
| For Business | `/business` | `faff08d` | Proposal form placeholder | Corporate lead reaches CRM + owner |
| Speaking | `/speaking` | `faff08d` | Credentials need evidence; form placeholder | Inquiry routed to booking owner |
| Resources | `/resources` | `faff08d` | Only one real resource (worksheet `.txt`) | Download vs external labels correct; no dead links |
| About | `/about` | `faff08d` | Credentials need evidence (brief §4) | Only evidenced claims |
| Community | `/community` (footer) | `faff08d` | Verify official FB group link | Outbound click tracked |
| Contact | `/contact` (footer) | `faff08d` | Form placeholder; response time not agreed | Form stores + notifies |
| Privacy / Terms | `/privacy`, `/terms` | Privacy draft in `faff08d`; **no Terms** | Owner-approved legal text needed | Linked from every form and footer |
| Starter Kit landing | `/free-ai-starter-kit` | `faff08d` (reduced header) | **Kit PDF doesn't exist** (only a `.txt` worksheet). Brief §12: do not publish the card until kit, notice and delivery workflow are ready | Brief §14 acceptance tests |
| Starter Kit thank-you | `/free-ai-starter-kit/thank-you` | `faff08d` (as `free-ai-starter-kit-thank-you.html`) | Route path differs from brief; must only show after stored request | Success only after storage; download works |
| 404 page | — | **No** | Build | Unknown URL → branded 404 |
| Sitemap / canonical / staging noindex | — | **No** | GHL generates sitemap; set canonicals; staging noindex | Checked at launch gate |
| Reusable templates | — | Partial | One program, one event, one resource, one success-story component (brief §2) | Shared across pages |
| `/implement`, `/scale`, `/insight` | — | Legacy pages | Not in brief; redirect or drop | 301s in place if ever public |

## 3. Form and integration inventory (brief §5, §11–14)

All forms in the codebase are placeholders that send nothing. Field specs are already written in `docs/GHL-FORMS.md` and match the brief.

| Form | Page | Destination (proposed) | Notification owner | Blocking inputs |
| --- | --- | --- | --- | --- |
| Starter Kit request | `/free-ai-starter-kit` | GHL contact + tag `lead-magnet:starter-kit`, custom fields for source/UTM/version/consent | TBC (Marketing / Projects) | Final kit PDF, privacy notice, consent wording, verified sender domain, Email 0–3 approval |
| Corporate proposal | `/business` | GHL contact + opportunity in corporate pipeline | TBC | Pipeline + owner |
| Speaking / partnership | `/speaking` | GHL contact + opportunity in bookings pipeline | TBC | Owner, rate sheet |
| Faith AI demo | `/build` | GHL contact + tag, use case field | TBC | Faith AI scope/status |
| Program registration / waitlist | `/programs/{slug}` | GHL form or calendar; hosted checkout only if paid | TBC | Active programs, dates, prices |
| General contact | `/contact` | GHL contact + inbox notification | TBC | Inbox, response time |
| Footer updates sign-up | all pages | GHL contact with marketing consent recorded | TBC | Consent wording |
| Existing "Notify Me" | live site | **Unknown — inspect before replacing** | Unknown | GHL access |

Email journey (brief §13): Email 0 always after storage; Emails 1–3 only with marketing consent; repeats resend the kit without restarting the sequence; suppression for unsubscribed/complained/invalid. Implement as GHL workflows.

Analytics events (brief §14): `landing_view`, `form_start`, `lead_created`, `download_click`, `program_click`, `corporate_inquiry`. No PII to analytics. Tracking tool not yet chosen.

## 4. Preserve

- Live GHL account, its existing form, contacts and any workflows.
- Approved homepage design and copy from `docs/source/faithworks-chatgpt-source.html` and the current `revision` implementation (hero composition, workflow canvas, journey scenes, build motif, CTA circuits, reduced-motion handling).
- Multi-page content in `faff08d`, `assets/data/*.json`, `docs/GHL-FORMS.md`, `docs/GHL-HANDOFF.md`.
- Real photography: founder portraits, masterclass/workshop images, speaker images. Stock `temp-*` images are placeholders (see `docs/IMAGE-SOURCES.md`) and must be replaced before launch.
- Original F[ai]th Works wordmark SVGs.

## 5. Gaps, dependencies and permissions

**Access needed (Faith / account owner):** GHL sub-account (admin or collaborator invite), GoDaddy DNS access or a named person to make changes, a GHL staging/preview domain, sending domain authentication (SPF/DKIM/DMARC) status.

**Content needed:** Starter Kit PDF (6–8 pages, §11), privacy notice and terms, active programs with dates/prices/status, confirmed credentials with evidence, real workshop/participant photos to replace stock, testimonials with consent, Faith AI current scope, official contact email and response times, lead owners per form.

**Technical gaps:** program detail template, 404, terms page, real form integration, email workflows, analytics, sitemap/canonical/noindex configuration, thank-you route path, removal of the "Nails" template remnant on the live site.

## 6. Conflicts to resolve

| # | Conflict | Brief says | Approved homepage says | Recommendation |
| --- | --- | --- | --- | --- |
| C1 | Navigation behaviour | Nav items are routes (`/learn`, `/build`, `/business`, `/resources`, `/about`) | Nav items scroll to homepage sections | Keep the long-form homepage; nav links go to the dedicated pages; homepage sections keep "See more →" links to those pages |
| C2 | Persistent header CTA | "Get the Free AI Starter Kit" → `/free-ai-starter-kit` | "Start your journey" → `#pathways` | Use the brief's CTA **once the kit is ready**; until then keep "Start your journey" (brief §12: don't advertise the expanded kit before it exists) |
| C3 | Hero buttons | Primary: Starter Kit; secondary: Train My Team → `/business` | Primary: "Find your next step"; secondary: Train my team | Same as C2 |
| C4 | Hero copy | "Work Better with AI—without becoming a tech expert." + supporting copy in §3 | Same headline, different supporting line | Ask Faith which supporting line is final |
| C5 | Inquiry builder | Public traffic must use the real lead funnel, not local `.txt` downloads (§14) | "Prepare my learning inquiry" downloads a `.txt` brief | Replace with links to the real forms (`/contact`, `/business`) at build time |

## 7. Recommendation — smallest maintainable implementation

**Option A: keep everything in GHL.** The live site already runs on GHL, the brief names GHL as the candidate CRM/forms/email platform, and the codebase was written to be pasted into GHL Custom HTML sections. No migration, no new hosting, no backend, no CMS.

- **Pages:** one GHL Website page per route, built from the shared header/footer global sections and Custom HTML sections; CSS/JS/JSON/images on the GHL media library or a CDN.
- **Forms:** native GHL forms styled with custom CSS, placed inside the designed form cards. This gives storage, dedupe, consent fields, hidden UTM capture and workflows without exposing any API key. Custom-coded forms posting directly to GHL are **not** recommended (would need a server-side proxy to keep credentials private).
- **Email:** GHL workflows for Email 0 and the consent-gated Emails 1–3.
- **Editable content:** GHL page editor for copy; programs/events/resources stay in JSON on the CDN for launch (editing guide in handover). Revisit GHL's blog or custom objects only if Faith's team needs to edit those without a developer.
- **Option B (custom frontend on Netlify/Vercel + GHL forms)** only if GHL's custom-code limits break the design or JS in testing. Not justified yet.

**Unverified until GHL access:** custom-code size limits per section, whether GHL strips `<picture>`/`<dialog>`/inline SVG, native-form styling depth, page-path naming (`/free-ai-starter-kit/thank-you`), staging noindex control.

## 8. Sprint plan and gates

| Sprint | Work | Gate evidence |
| --- | --- | --- |
| 1 Scope | This assessment; commit current work; resolve C1–C5; obtain GHL + DNS access; inspect live "Notify Me" routing; itemized estimate | Faith accepts scope + estimate |
| 2 Content & design | Restore `faff08d` pages onto `revision` and align them to the upgraded homepage system; build program detail template, 404, terms; replace stock images as real ones arrive; desktop + mobile review | Faith signs off copy, offers, design |
| 3 Starter Kit & emails | Kit PDF production (separate deliverable); landing + thank-you; Email 0–3 in GHL; consent fields | Brief §14 tests pass on staging |
| 4 Build | Paste into GHL staging; native forms + workflows + pipelines; analytics; SEO settings | All forms store, notify, and confirm |
| 5 Testing | Brief §8 checklist + §14 acceptance tests; 360/768/desktop; Chrome/Safari/Edge; keyboard; reduced motion; LCP/INP/CLS lab checks | Acceptance report with screenshots |
| 6 Launch & handover | Backup live GHL page; DNS/domain mapping; remove staging noindex; handover docs | Faith's written launch signoff |

## 9. Acceptance checklist (traceable to §2–§3 above)

Every row in §2 and §3 is tracked with one of: **Implemented & verified · Implemented, not verified · Blocked (access/content) · Pending approval · Out of scope.** Current status: all integrations **Blocked (access)**; Starter Kit funnel **Blocked (kit PDF, privacy notice)**; homepage **Pending approval (C1–C5)**; secondary pages **Implemented, not verified** (exist in `faff08d`, need restoring and alignment).
