# DESIGN.md — Faith Works Website

> **Source of truth:** *Faith Works Website Study & Concept* (PDF, 18 pages, 2026). Page references below are written as **[C‑NN]**, where NN is the page's folio number in the concept.
> Every decision here traces back to the concept. When the concept is silent, the decision is marked **⚑ Assumption**. It is the smallest choice that fits the concept, and it can be revisited.
> This document defines the visual system only. It is not an implementation.

---

## 1. Brand Overview

**What Faith Works is** [C‑03]
> "Faith Works is the education and business transformation arm of the Faith Works PH ecosystem. It helps founders, professionals and organizations learn practical skills, put them into practice, and build from there."

**What the website must be** [C‑01, C‑18]
> "A clearer digital home for practical education, business transformation, and purposeful growth."

**The problem it solves** [C‑02]
Faith Works already teaches AI, business and leadership through workshops, events and resources, but that material "lives across scattered pages." The site has to make it all feel like **one place people can actually move through**. Every layout decision should favour one continuous place over a collection of separate pages.

**Pillars** [C‑01]: AI · Business · Lifestyle · Founder

**Core journey** [C‑04]

| Stage | Visitor's voice | What's inside |
|---|---|---|
| 01 Learn | "I want to understand this." | AI insights · business · leadership · workshops · talks · resources · purpose |
| 02 Implement | "I want to apply this." | Frameworks · AI tools · automation · templates · programs · Faith AI |
| 03 Scale | "I want this to last." | Business growth · systems · repeatable processes · leadership · transformation |

**Audience** [C‑07]: individuals, professionals and entrepreneurs.
- Founders & owners: *systems the business can run on*
- CEOs & executives: *lead with AI they understand*
- HR & talent leaders: *specific functional gains*
- Marketing pros: *more output, same team*
- Operations leaders: *process that holds at scale*
- Consultants & coaches: *deliver more without more hours*
- Freelancers: *punch above their size*
- Event suppliers & SMEs: *stop losing leads in an inbox*

**No technical background required.** Every one of these roles comes from past workshops. None are invented personas. This is why the site must never feel "overly tech."

**Brand DNA: "lives in the middle, not the extremes"** [C‑06]
The concept plots Faith Works on five sliders. The dots are not dead centre, and the design should match where they actually sit:

| Axis | Where the dot sits | What it means for design |
|---|---|---|
| Inspirational ↔ Practical | Leans **practical** | Concrete copy and real photos. Motivation is never the headline. |
| Approachable ↔ Professional | Leans **professional** | Disciplined grid and restrained palette, softened by warm surfaces. |
| Strategic ↔ Tactical | Leans **strategic** | Clear structure and hierarchy, not a toolbox of widgets. |
| Confident ↔ Humble | Leans **confident** | Big type and decisive whitespace. No hedging or ornament. |
| Educational ↔ Promotional | Strongly **educational** | Content leads. CTAs are clear but never shouty. There are no urgency tricks. |

> "Warm before cold. Credible right behind. Proudly Filipino, built for a global audience." [C‑06]

**Guiding principle** [C‑17]: *One brand. Many expressions.* Learn can feel practical. Implement can feel hands‑on. Scale can feel strategic. Community can feel warm. It should still be unmistakably Faith Works.

---

## 2. Design Principles

1. **The homepage is the journey.** [C‑12] Scrolling means moving from understanding to application to lasting systems. Colour, motif and chapter markers all move with the visitor. *Why:* this is the concept's central idea. A page that only labels the journey fails the brief.
2. **Typography is the layout.** Headlines are the main visual element. There are no decorative illustrations or icon grids. *Why:* every page of the concept is built from type, hairlines and real photos, and the concept says "the headlines and colour do the talking." [C‑08]
3. **One accent per section.** [C‑08] Each section has one surface and one accent colour. Never use all four brand colours at once. *Why:* colour paces the scroll, and a restrained palette signals strategic confidence.
4. **Simple on the surface, rich underneath.** [C‑11] Six nav items, one idea per screen, with depth one click away. *Why:* the concept states that hierarchy matters more than including everything. [C‑12]
5. **Real people, real work, real learning.** [C‑09] Every photograph shows actual Faith Works people and moments. *Why:* credibility comes from proof, and the audience roles are real. [C‑07]
6. **Warm before cold.** [C‑06] Warm surfaces (Works White, Faith Pink) are the default. Soft Charcoal is used for rhythm and is never the base. *Why:* this avoids the corporate or SaaS coldness the brief rules out.
7. **Every element earns its place.** A card, animation or rule only exists if it helps someone read, navigate or move forward. *Why:* the brief's educational lean means nothing should be promotional decoration.

---

## 3. Color System

### 3.1 Brand palette (fixed, from [C‑08])

| Token | Hex | Concept role | Web role |
|---|---|---|---|
| `--fw-pink` **Faith Pink** | `#F8D8E0` | "Soft surfaces & warmth" | Section surface; image plates; Implement stage |
| `--fw-yellow` **AI Yellow** | `#FBC522` | "Highlights & spotlight" | Primary CTA fill; the `[ai]` block; one spotlight surface (Faith AI); accent on dark |
| `--fw-white` **Works White** | `#FAF8F4` | "Foundation surface" | Default page surface |
| `--fw-charcoal` **Soft Charcoal** | `#1A1A1A` | "Typography & reversed", "a rhythm device" | All primary text; dark sections; footer |

### 3.2 Supporting tones (sampled from the concept file itself, not invented)

The concept uses these tints for eyebrows, hairlines, highlights and tinted surfaces. They are documented here so nobody has to guess them.

| Token | Hex | Where the concept uses it | Web role |
|---|---|---|---|
| `--fw-pink-tint` | `#FBEEF2` | Cover, hero and closing page backgrounds; tinted rows [C‑01, C‑13, C‑18, C‑12] | Final CTA surface; image placeholders |
| `--fw-pink-mid` | `#EFACBA` | Logo brackets; highlighted headline word on dark; circuit lines [C‑01, C‑03, C‑15] | Brackets in the logo; highlight words **on charcoal only**; circuit motif |
| `--fw-pink-ink` | `#E85D8A` | Eyebrow text, italic sub‑lines, bullets, category labels [C‑02, C‑04, C‑12, C‑14] | Highlight word in **display‑size** type on light surfaces; bullets; eyebrow text on charcoal |
| `--fw-hairline` | `#E8D2D9` | All horizontal and vertical rules on light pages [C‑05, C‑10, C‑11] | Rules and dividers on light surfaces |
| `--fw-grey` | `#5B5E66` | Body copy on light pages | Body and secondary text on White and Pink |

**⚑ Assumption: accessible small pink text.** `#E85D8A` on Works White is 3.1:1, which is fine for display type but fails for small eyebrows and labels. Small pink text on light surfaces therefore uses **`--fw-pink-ink-deep: #B8305F`** (5.5:1 on White, 5.1:1 on Pink Tint). It is a darker step of the concept's own pink, not a new hue. On Faith Pink surfaces, small labels are Soft Charcoal.

**⚑ Note: charcoal hex.** The concept's full‑bleed dark pages render as `#1A1E24`, while the swatch page specifies `#1A1A1A`. The specified value, **`#1A1A1A`**, is used everywhere.

**Derived text‑on‑dark:** `--fw-white-72: rgba(250,248,244,0.72)` for body on charcoal (≈8.6:1). `--fw-rule-dark: rgba(250,248,244,0.14)` for hairlines on charcoal.

### 3.3 Surface → accent pairings (the "one accent" rule, made explicit)

The concept pairs each surface with one accent [C‑08]: *Works White + AI Yellow accent · Faith Pink + warmth on dark · Soft Charcoal as a rhythm device.*

| Surface | Text | The one accent | Allowed accent uses |
|---|---|---|---|
| Works White | Charcoal / Grey | **AI Yellow** *or* **Pink Ink**, chosen per section, never both | Yellow: CTA fill, short marker bars, the `[ai]` block. Pink Ink: one highlighted headline word, category labels, bullets. |
| Faith Pink | Charcoal / Grey | **Soft Charcoal** | Dark pill buttons, dark tags, charcoal quote marks |
| Soft Charcoal | Works White / White‑72 | **AI Yellow** *or* **Pink Mid** | Yellow: CTA, one highlighted word, labels. Pink Mid: one highlighted word ("Faith Works", "human layer"). |
| AI Yellow (once per page at most) | Charcoal | **Soft Charcoal** | Dark buttons, bracket device |
| Pink Tint | Charcoal | **AI Yellow** | Logo block, primary CTA |

**System marks don't count as a second accent.** The bracketed eyebrow (`[ 04 · The Journey ]`) and the logo are brand furniture that appear on every section in the concept. Their colours follow §4.4 and do not break the rule.

**Gradients: none.** The concept contains no gradients. There is no design reason to add them.

---

## 4. Typography System

### 4.1 Families [C‑08]
- **Poppins** is used for display, headlines, section numbers, card titles, quotes and the wordmark.
- **Inter** is used for body copy, UI, nav, buttons, labels, eyebrows and meta. The concept says: "Inter carries every paragraph: legible, warm and neutral, so the headlines and colour do the talking."

No other families. No serif, no mono.

### 4.2 Weights and styles in use
| Family | Weights | Why |
|---|---|---|
| Poppins | 800 (display), 700 (headings), 600 (titles), 500 *italic* (voice lines) | The concept's headlines are heavy and tightly tracked. Its quotes ("I want to understand this.") and the line "It is the journey." are pink Poppins italic. [C‑04, C‑12] |
| Inter | 400 (body), 500 (UI, buttons, nav), 600 (eyebrows, labels) | Keeps UI quiet so the display type carries the design. |

### 4.3 Headline treatment
- **Tight line‑height and negative tracking.** Display sets at 0.88–0.95 line‑height and −0.04 to −0.045em tracking, as in "Learn. Implement. Scale." [C‑13, C‑18]. *Why:* stacked words read as one confident block.
- **Full stops are part of the voice.** "Learn." "Scale." "One system." Short declarative statements end with a period. *Why:* it is the concept's editorial cadence, and it reads as confident.
- **One highlighted word or phrase per headline, at most.** Examples: "for **practical learning.**", "**Faith Works** is…", "A **human layer**, kept light.", "**Many** expressions." It uses the section's accent colour. *Why:* this is the concept's signature emphasis device and stops highlights spreading.
- **Voice line.** Poppins 500 italic in Pink Ink sits directly under a headline to give the human voice ("It is the journey.", "I want to apply this."). Limit it to one per section.

### 4.4 The bracket eyebrow (signature system mark)
Every section in the concept opens with `[ 04 · THE JOURNEY ]` [C‑02 onward]:
- The brackets `[` `]` are AI Yellow. The number and label are Pink Ink, set in Inter 600, uppercase, with 0.22em tracking.
- *Why:* the brackets echo the **F[ai]th** wordmark. The AI lives inside the brand, and every section repeats that idea quietly.
- Accessibility variants:
  - **On Works White or Pink Tint:** label in `--fw-pink-ink-deep`. Yellow brackets are decorative and set `aria-hidden`.
  - **On Faith Pink or AI Yellow:** label in Charcoal, brackets in Charcoal.
  - **On Charcoal:** label in Pink Ink, brackets in Yellow, exactly as in the concept.

### 4.5 Running folio
The concept runs a quiet folio along every page footer ("FAITH WORKS · WEBSITE STUDY & CONCEPT … The Journey · 04"). On the web this becomes an optional **section folio** at the bottom edge of chapter‑opening sections: the chapter name and section number in Inter 500, 11px, with 0.2em tracking, in grey. *Why:* it gives an editorial, publication‑like rhythm and reinforces where the visitor is in the journey.

---

## 5. Type Scale

The scale is fluid, measured between a 360px and a 1440px viewport. Sizes are `clamp()` values. Only `display‑xl` is allowed to dominate a viewport.

| Token | Family / weight | Size (clamp) | Line‑height | Tracking | Use |
|---|---|---|---|---|---|
| `display-xl` | Poppins 800 | `clamp(2.75rem, 14vw, 11rem)` | 0.88 | −0.045em | Hero "Learn. Implement. Scale." and the final CTA only |
| `display-l` | Poppins 800 | `clamp(2.5rem, 8vw, 7rem)` | 0.92 | −0.04em | Chapter statements (Journey stage words, Faith AI) |
| `numeral-xl` | Poppins 800 | `clamp(5rem, 16vw, 13rem)` | 0.8 | −0.05em | Oversized section and stage numbers (decorative) |
| `h1` | Poppins 800 | `clamp(2.25rem, 5vw, 4.5rem)` | 0.98 | −0.035em | Section headlines ("Four ways to learn. One system.") |
| `h2` | Poppins 700 | `clamp(1.75rem, 3.2vw, 3rem)` | 1.04 | −0.03em | Sub‑sections, positioning statement |
| `h3` | Poppins 700 | `clamp(1.375rem, 2vw, 1.875rem)` | 1.1 | −0.02em | Index‑list items, event titles |
| `h4` | Poppins 600 | `clamp(1.0625rem, 1.3vw, 1.25rem)` | 1.25 | −0.01em | Card titles, audience roles |
| `voice` | Poppins 500 italic | `clamp(1.125rem, 1.7vw, 1.5rem)` | 1.3 | −0.01em | Voice lines under headlines |
| `body-l` | Inter 400 | `clamp(1.0625rem, 1.2vw, 1.25rem)` | 1.55 | 0 | Lead paragraphs |
| `body` | Inter 400 | `1rem` (16px) → `1.0625rem` at ≥1024px | 1.6 | 0 | Paragraphs |
| `body-s` | Inter 400 | `0.875rem` | 1.5 | 0 | Card descriptions, meta |
| `eyebrow` | Inter 600 UPPER | `0.75rem` | 1.2 | 0.22em | Bracket eyebrows |
| `label` | Inter 600 UPPER | `0.6875rem` | 1.2 | 0.18em | Category tags, "CORE OFFERING", "NEXT STEP" |
| `nav` | Inter 500 UPPER | `0.8125rem` | 1 | 0.14em | Header nav [C‑13] |
| `button` | Inter 500 | `0.9375rem` | 1 | 0.01em | Buttons |

**Rules**
- **Measure.** Body copy runs 45–68ch, set with `max-width: 34rem` on paragraphs. *Why:* the concept's paragraphs are short and narrow, which keeps the educational tone readable.
- **Scale jumps are big.** Put at least two steps between a headline and its body copy. *Why:* big contrast is what makes the layout read as editorial rather than templated.
- **Only one `display-xl` moment per viewport,** and only in the hero and final CTA. Section headlines use `h1`. *Why:* keeping `display-xl` rare is what makes the hero and final CTA feel dramatic.
- **Fit check.** The longest display word is "Implement." (about 6.1em wide in Poppins 800 at −0.045em). The clamp above fits it inside a 320px viewport with 16px margins. Re‑check this if the tracking or weight changes.
- **Section numerals are decorative.** Use `aria-hidden="true"`, colour them in the surface's hairline tone, and never make them the only carrier of meaning.

---

## 6. Spacing System

The base unit is 4px, and all spacing uses these tokens.

| Token | px | Typical use |
|---|---|---|
| `--space-1` | 4 | Icon to label |
| `--space-2` | 8 | Tag padding, tight stacks |
| `--space-3` | 12 | Eyebrow to headline |
| `--space-4` | 16 | Minimum mobile gutter; paragraph gap |
| `--space-5` | 24 | Headline to body; grid gutter (desktop) |
| `--space-6` | 32 | Body to CTA row |
| `--space-7` | 48 | Between blocks inside a section |
| `--space-8` | 64 | Header height (desktop); large internal gap |
| `--space-9` | 96 | Section padding (mobile) |
| `--space-10` | 128 | Section padding (tablet) |
| `--space-11` | 176 | Section padding (desktop) |
| `--space-12` | 240 | Chapter openers; hero bottom breathing room |

- **Section vertical padding:** `clamp(96px, 12vw, 176px)`. Chapter openers (Learn, Implement, Scale entry points) get `clamp(128px, 16vw, 240px)`. *Why:* generous whitespace signals premium and educational rather than promotional. The concept's pages are roughly 40% empty.
- **Vertical rhythm inside a section:** eyebrow → 12 → headline → 24 → voice line → 24 → body → 32 → CTA. This is repeated everywhere for consistency.

---

## 7. Grid / Layout Rules

| Breakpoint | Columns | Outer margin | Gutter |
|---|---|---|---|
| ≥1280 (desktop) | 12 | `clamp(48px, 6.25vw, 96px)` | 24px |
| 768–1279 (tablet) | 8 | 40px | 20px |
| <768 (mobile) | 4 | 20px (never below 16px) | 16px |

- **The margin comes from the concept.** Content starts at 6.25% of the page width on every page, and the web margin reuses that ratio.
- **Max content width:** 1440px of content inside the margins. Full‑bleed colour surfaces always span the full viewport. *Why:* colour environments must feel like rooms, not boxes.
- **Asymmetry by default.** Standard split: headline block in columns 1–5, content in 7–12, with column 6 left empty as air. This follows [C‑02, C‑06, C‑11, C‑12]. Centred layouts are reserved for the final CTA, which mirrors [C‑18]. *Why:* asymmetric editorial composition is the concept's own layout language, and centring everything reads as a template.
- **Hairlines are structure.** Lists and column sets are separated by 1px `--fw-hairline` rules, not boxes [C‑05, C‑10, C‑11]. *Why:* rules organise content without the visual weight of cards.
- **Vertical rules** separate column sets such as the four offerings [C‑10].
- **Border radius tokens:** `0` for surfaces and sections, `6px` for photos and media, `8px` for the rare content card, `999px` for buttons and chips only. *Why:* pills and softly rounded images are in the concept [C‑13, C‑14, C‑09]. Everything else stays square to avoid the "rounded SaaS card" look.
- **Shadows: none.** The only exception is the sticky header on scroll, which gets a 1px bottom hairline rather than a shadow.

---

## 8. Section Rhythm

The homepage rhythm follows the tinting in the concept's homepage flow [C‑12]: alternating White and Pink, with Charcoal reserved for Workshops & Events and a yellow "Register now". Two concept‑backed adjustments are marked ⚑.

| # | Section | Surface | Accent | Journey chapter | Source |
|---|---|---|---|---|---|
| 01 | Hero | Works White | AI Yellow | — (threshold) | C‑13 |
| 02 | What is Faith Works? | Faith Pink | Soft Charcoal | Learn | C‑12 (pink row), C‑03, C‑07 |
| 03 | Learn / Implement / Scale | White → **Faith Pink** → White (per stage) | Pink Ink → Charcoal → AI Yellow | The map | C‑04 (exact colours per column) |
| 04 | Workshops & Events | **Soft Charcoal** | AI Yellow | Learn | C‑12 (charcoal row + yellow Register) |
| 05 | Resources (+ Next‑step bar) | Works White | Pink Ink | Learn → Implement | C‑14 |
| 06 | Programs | Faith Pink | Soft Charcoal | Implement | C‑12 (pink row) |
| 07 | Faith AI | **AI Yellow** ⚑ | Soft Charcoal | Implement | Logo `[ai]` block, C‑08 "spotlight" |
| 08 | Community | Works White ⚑ | Pink Ink | Scale | C‑17 "Community can feel warm" |
| 09 | Lifestyle & Founder socials | Soft Charcoal | Pink Mid | Supporting | C‑15 |
| 10 | Final CTA | Pink Tint + circuit lines | AI Yellow | Scale (continue) | C‑18 |
| — | Footer | Soft Charcoal | AI Yellow | — | Assumption |

**⚑ Faith AI on AI Yellow.** The concept gives yellow the role "Highlights & spotlight" and puts it behind the letters "ai" in the logo. Faith AI is the one product that *is* that "ai", so it gets the page's single yellow environment. *Why:* this gives one intentional yellow peak instead of scattering yellow across the page.

**⚑ Community on Works White.** The concept tints this row pink. Following it exactly would put three pink surfaces within four sections (06, 08, 10) around the yellow. White with large warm photography keeps Community "warm" [C‑17] while protecting the pacing.

**Resulting pace:** light → warm → map → **dark** → light → warm → **bright** → light → **dark** → warm → dark. There are two dark beats (mid‑page and near the end), one bright spotlight, and warm surfaces in between. No two adjacent sections share a surface, except inside the Journey section, where the change of stage is the point.

**Transitions between surfaces** are hard edges. There are no fades and no wave dividers. *Why:* hard colour cuts read like turning the page of a publication.

---

## 9. Image Direction

**"Real people. Real work. Real learning."** [C‑09] That means founders, professionals and teams in workshops, AI in real hands, and honest behind‑the‑scenes moments.

**Use**
- Actual Faith Works workshop and event photography, like the speaker, room and participant shots in [C‑09]: lanyards, laptops, microphones, full rooms.
- The founder portrait on its pink backdrop [C‑15].
- Hands on laptops and phones showing real tools in use, and screens that show real slides [C‑04 Implement photo].
- Filipino faces and rooms. The site is proudly Filipino and built for a global audience.

**Never** use generic stock, handshakes, glowing‑brain or circuit‑board "AI" imagery, AI‑generated people, or staged corporate brochure shots. [C‑09: "✕ No generic stock"]

**Treatment**
- **Natural colour.** No duotones, colour overlays or gradient scrims. *Why:* credibility comes from honesty, and filters make real photos look like stock.
- **Editorial crops.** Portrait 4:5 for people, wide 3:2 or 16:9 for rooms, and tight 1:1 crops for detail (hands, screens).
- **The mosaic** from [C‑09]: one tall portrait next to one wide room shot above two tighter moments, with 12px gaps and a 6px radius. Use it for Community and About.
- **Pink plate.** Portraits may sit on, or be revealed from, a Faith Pink plate [C‑13 hero panel, C‑15 backdrop]. The plate is the only "frame" allowed.
- **Text never sits on a photo.** Put captions below in `label` style. *Why:* it avoids scrims and keeps contrast guaranteed.
- **Placeholders.** Until real photos exist, use a Pink Tint block with a `label` caption describing the intended shot. Never fill a gap with stock.
- **Performance.** AVIF/WebP with a JPEG fallback, `srcset` at 480/960/1440/2160 widths, lazy‑loaded below the fold, and explicit `width`/`height` to prevent layout shift.

---

## 10. Navigation

**Primary items (six)** [C‑11]: Home · Learn · Implement · Scale · Community · About, plus a **Join** CTA [C‑13].

The concept's hero mock omits Community, but the IA page lists all six. The IA page wins.

**Desktop header** [C‑13]
- Height 64px, Works White surface, and a 1px hairline bottom border once the page scrolls.
- Wordmark on the left. Nav on the right in `nav` style (Inter 500, uppercase, 0.14em tracking) with 32px spacing. **Join** is a small AI Yellow pill.
- **"Rich underneath":** hovering or focusing Learn, Implement, Scale or Community opens a full‑width panel under the header on the same surface. The panel shows sub‑items as an **index list** (Poppins 700 `h3`, hairline rules, the one‑line description on the right) exactly like [C‑11]. It never shows an icon grid.
  - Learn: AI · Business · Leadership · Workshops · Events · Resources
  - Implement: Frameworks · Templates · Workflows · AI tools · Programs · Faith AI
  - Scale: Systems · Transformation · Growth · Leadership · Business development
  - Community: Events · Connection · Participation
- **Surface awareness.** Over charcoal or yellow sections the header switches to that surface with the matching text colour. *Why:* the header belongs to the room the visitor is in.
- **Behaviour.** It hides on scroll down and reappears on scroll up (transform only, 300ms). It never overlaps the hero's first line of type.
- **⚑ Journey indicator (homepage only).** A small three‑part marker in the header reads `Learn · Implement · Scale`. The current chapter is set in Charcoal and underlined with a 2px bar in the section's accent colour. The others are grey. *Why:* this makes "the homepage is the journey" legible at all times. It is not decorative. The active state uses weight and underline as well as colour.

**Mobile navigation**
- A header with the wordmark, a Join pill and a "Menu" text button (a word, not a hamburger icon alone).
- A full‑screen overlay on Works White showing the six items as a large index list: Poppins 800 at `h1` size, numbered 01–06 in pink, hairline separated, following [C‑11]. Sub‑items expand as accordions.
- Focus is trapped while open, Esc closes it, and focus returns to the trigger.

**Wordmark**
F`[ai]`th Works, per [C‑01, C‑18]. The brackets are Pink Mid, the "ai" sits on a rounded AI Yellow block, and the rest is Charcoal Poppins 800. Ship it as an SVG with `aria-label="Faith Works"`. Never rebuild it in live text, and never recolour it except for a reversed version with White letters on dark.

**⚑ Founder portrait in the logo.** The concept's header mock [C‑13] shows a small founder cut‑out beside the wordmark. It is unclear whether this is part of the logo lockup. The default is the wordmark only, pending confirmation.

---

## 11. Buttons / CTAs

All button types come from the concept [C‑13, C‑08, C‑12, C‑14].

| Variant | Look | Use |
|---|---|---|
| **Primary** | AI Yellow fill, Charcoal text, pill, 52px tall (desktop) / 48px (mobile), 28px horizontal padding | The single most important action in a section: "Explore Learning", "Register now", "Join" |
| **Secondary** | Transparent, 1.5px Charcoal outline, Charcoal text, pill | The alternative action: "See upcoming events" |
| **Dark** | Charcoal fill, White text, pill | The primary action on Faith Pink or AI Yellow surfaces, where yellow is not the accent: "Continue" [C‑14] |
| **Reversed outline** | 1.5px White‑72 outline, White text | Secondary action on Charcoal |
| **Text link** | Inter 500, underline offset 4px, followed by an `→` arrow | Inline "Read", "View program". The arrow is a text glyph, not an icon library. |

**Rules**
- **At most one primary button per section.** *Why:* the brand leans educational rather than promotional [C‑06], and one clear next step beats three competing ones.
- **Labels are verbs and specific.** Use "Explore Learning", "Register now", "See upcoming events". Never use "Learn more" or "Click here".
- **Hover (pointer devices):** the fill darkens by about 6% (yellow `#EDB710`) and the `→` arrow nudges 4px right. Duration 200ms. No scale, glow or shadow.
- **Focus:** a 2px outline offset by 3px, Charcoal on light surfaces and AI Yellow on dark surfaces. It is always visible with `:focus-visible`.
- **Minimum touch target is 44×44px.**

---

## 12. Cards / Content Blocks

Cards only appear where the content is a genuine collection of similar items. Everything else uses the concept's **rules‑and‑type** patterns.

| Pattern | Looks like | Use for | Source |
|---|---|---|---|
| **Index list** | Full‑width rows separated by hairlines. Optional small number on the left, Poppins title, meta label on the right, and a row hover that indents the title and reveals an `→`. | Programs, nav panels, the Learn/Implement/Scale sub‑topics, mobile menu | C‑05, C‑11 |
| **Offering columns** | Four columns divided by vertical hairlines. Each has a short accent bar on top, a number, an `h4` title and a short description, with an image at the bottom. | "Four ways to learn. One system." on the Learn landing page | C‑10 |
| **Role grid** | Three columns of role + one‑liner pairs, each with a hairline above. There is no box. | Audience in section 02 | C‑07 |
| **Resource card** (a real card) | A 3:2 image with 6px radius, a category `label` in pink, and an `h4` title. **No border, no background, no shadow.** The whole card is a link. | Resources feed | C‑14 |
| **Event row** | A large date numeral in Poppins 800 on the left, then title (`h3`), format, location and a "Register now" button on the right, all hairline separated. | Workshops & Events | C‑12 |
| **Filter chips** | Pill outline, uppercase `label` text. The active chip is a Charcoal fill with White text. | Resources and content hubs | C‑14 |
| **Next‑step bar** | A full‑width Faith Pink band with a 4px AI Yellow left edge. It holds a "NEXT STEP" label, the line "Ready to apply this? → Implement" and a Dark "Continue" button. | The bridge between journey chapters | C‑14 |
| **Journey path** | Outline pill chips joined by `→` arrows | "Many entry points. One journey." on the About or Learn pages | C‑16 |
| **Tag pill cloud** | Outline pills with a pink dot | Only to show topic scope, e.g. the About page "one clear home" | C‑02 |

**Card rules:** an 8px radius only when a card has a background fill. There are never shadows or hover lift. Hover is an image zoom of 1.03 inside a clipped frame plus a title underline. *Why:* motion stays inside the content, so the layout never jitters.

---

## 13. Learn / Implement / Scale Visual Language

Each stage has its own expression [C‑17] made from concept‑sourced motifs [C‑04]:

| | **01 Learn** | **02 Implement** | **03 Scale** |
|---|---|---|---|
| Feels | Practical, curious | Hands‑on | Strategic |
| Surface | Works White | Faith Pink | Works White |
| Accent | Pink Ink | Soft Charcoal | AI Yellow |
| Motif | **Circuit lines**: thin Pink Mid paths with rounded corners and node dots, branching and exploratory | **A real photograph**: hands, a workshop, a screen | **Ascending line**: an AI Yellow polyline with Charcoal nodes ending in an arrow, rising but not straight |
| Meaning | Many paths into understanding | The idea meets real work | Progress that compounds and lasts |
| Motion | Lines draw in along their paths | Image clip‑reveals upward | The line draws left to right, then its nodes pop in sequence |
| Voice line | "I want to understand this." | "I want to apply this." | "I want this to last." |

**The circuit line is the brand's thread.** It appears on the cover and closing pages [C‑01, C‑18] and in the Learn column [C‑04]. On the site it appears in three places only: the hero, the Learn stage and the final CTA. There it is the same path drawn *once* per visit, marking where the journey starts, where understanding begins and where it continues. *Why:* keeping the motif rare keeps it meaningful. Everywhere else it would become wallpaper.

**Stage colour is a wayfinding code across the whole site.** Learn pages use White with Pink Ink accents. Implement pages use Faith Pink surfaces for heroes. Scale pages use White with Yellow line accents. Community pages use warm photography. *Why:* "One brand. Many expressions." Each area has a character, but the system never changes.

**Chapter bridges.** The Next‑step bar [C‑14] appears at the end of each chapter on the homepage and at the end of every content page: *Ready to apply this? → Implement* and *Ready to make it last? → Scale*. *Why:* every page pushes the visitor one step along the journey, so no page is a dead end.

---

## 14. Motion Principles

**Motion should show progress, not decorate.** Every animation either reveals content in reading order or shows movement from Learn to Implement to Scale.

**Tokens**
| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | All reveals |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Surface and colour changes, line draws |
| `--dur-fast` | 200ms | Hover, focus |
| `--dur-base` | 450ms | Small reveals, menu |
| `--dur-slow` | 800ms | Headline and image reveals |
| `--dur-hero` | 1100ms | Hero sequence (total, including stagger) |
| `--stagger` | 70ms | Between lines and list items |

**Vocabulary (use only these)**
1. **Line‑mask text reveal.** Each headline line rises from `translateY(105%)` inside an `overflow:hidden` line wrapper. It applies to headlines only and never to body copy.
2. **Image clip reveal.** `clip-path: inset(100% 0 0 0)` → `inset(0)`, with the image counter‑scaling from 1.08 to 1. It plays once, on entry.
3. **Path draw.** The circuit lines and the Scale line animate `stroke-dashoffset`, tied to scroll position within their section.
4. **Directional entry.** Journey content enters from the left by 24px to match left‑to‑right reading and the `→` arrows of [C‑16]. Movement is always forwards and never backwards.
5. **Surface change.** In the Journey section, the background colour changes (White → Pink → White) over 600ms as each stage becomes active.
6. **Subtle parallax.** Large photos may drift at most 6% of their height relative to scroll. It is disabled below 768px.
7. **Hover** follows §11 and §12.

**Hero sequence (on load):** eyebrow fades in (0ms) → "Learn." (100ms) → "Implement." (170ms) → "Scale." (240ms) → circuit line draws through the three words (300–1100ms) → support copy and CTAs fade up (600ms). The image clip‑reveals from its pink plate (400ms).

**Forbidden:** scroll‑jacking or smooth‑scroll libraries that override native scrolling, horizontal scroll hijacks, parallax on text, looping or floating elements, cursor followers, magnetic buttons, character‑by‑character typewriter effects, bounce or elastic easing, and animating anything the user already passed on scroll‑up.

**Reduced motion (`prefers-reduced-motion: reduce`):** no transforms, clip‑paths or path draws. Content is visible immediately. Only opacity fades of 150ms or less remain, and stage colour changes are instant. The page must be fully meaningful with motion off.

---

## 15. Responsive Rules

Desktop is the primary composition. Smaller screens **re‑compose** the layout rather than shrink it.

| Element | Desktop | Tablet | Mobile |
|---|---|---|---|
| Hero words | Staircase across 12 columns (see §18) | Staircase compressed to 8 columns | Left‑aligned stack, each word on its own line, image moves below the CTAs |
| Asymmetric splits (5 + 6 columns) | Side by side | Headline full width, content indented 1 column | Stacked. The headline keeps `h1`, and content follows. |
| Journey (sticky stages) | Sticky left stage word, scrolling right content | Same, narrower | **No sticky.** Three sequential blocks, each with its own numeral, surface and motif. |
| Index lists | Title left, meta right | Same | Meta drops under the title as a `label` |
| Offering columns | 4 across | 2 × 2 | 1 column. Vertical hairlines become horizontal ones. |
| Resource cards | 3 across | 2 across | Horizontal scroll‑snap row of 80%‑width cards with visible overflow cue, or a 1‑column list (choose the list if there are more than 6 items). The page itself never scrolls horizontally. |
| Event rows | One line | Two lines | Stacked: date numeral, title, meta, full‑width Register button |
| Photo mosaic | 1 tall + 1 wide + 2 small | Same, smaller | 1 wide + 2 small in a row. The tall portrait is dropped or placed first. |
| Section padding | 176px | 128px | 96px |

**Hard rules**
- There must be no horizontal overflow at any width from 320px up. Set `overflow-wrap: anywhere` on display type as a safety net, but the clamp sizes must be the real fix.
- Primary CTAs must be visible without scrolling on mobile in the hero. They go below "Scale." and above the image.
- Display type never goes below `h1` size on mobile. Strong typography is the brand.
- Tap targets are at least 44px, and hover‑only information must also be reachable by tap or focus.

---

## 16. Accessibility Considerations

- **Target: WCAG 2.2 AA.**
- **Contrast (measured):**

  | Pair | Ratio | Allowed for |
  |---|---|---|
  | Charcoal on White | 16.4:1 | Everything |
  | Charcoal on Faith Pink | 13.2:1 | Everything |
  | Charcoal on AI Yellow | 10.9:1 | Everything |
  | Grey `#5B5E66` on White | 6.1:1 | Body |
  | Grey on Faith Pink | 4.9:1 | Body |
  | Grey on Yellow | 4.1:1 | **Not allowed.** Use Charcoal. |
  | White‑72 on Charcoal | ≈8.6:1 | Body on dark |
  | AI Yellow on Charcoal | 10.9:1 | Highlight words, labels |
  | Pink Mid on Charcoal | 9.4:1 | Highlight words |
  | Pink Ink `#E85D8A` on White | 3.1:1 | **Display sizes only** (≥24px, or ≥18.66px bold) |
  | Pink Ink Deep `#B8305F` on White | 5.5:1 | Small pink text |
  | AI Yellow, Faith Pink or Pink Mid on light surfaces | <1.8:1 | **Never as text.** Decorative only. |

- **Semantics.** Use one `h1` per page (the hero headline). Each section is a `<section>` with an `aria-labelledby` heading, and the heading order never skips levels.
- **Decorative elements get `aria-hidden="true"`.** That covers the bracket glyphs, section numerals, circuit lines, the Scale line and highlight tints.
- **The hero headline** "Learn. Implement. Scale." must be real text in the `h1`. No SVG or canvas text.
- **Colour is never the only signal.** The journey indicator uses weight and an underline as well as colour. Active chips use fill and `aria-pressed`.
- **Keyboard.** Add a skip link to `#main`. Nav panels open on focus, close on Esc and are fully tabbable. Carousels or scroll‑snap rows are reachable by keyboard.
- **Motion.** Follow §14 reduced‑motion rules. Never auto‑play video with sound. Any auto‑play of 5 seconds or longer needs a pause control.
- **Images.** Give descriptive alt text naming the people or context ("Participants working through an AI exercise at a Faith Works workshop in Manila"). Decorative crops get `alt=""`.
- **Language.** Set `lang="en"`. Mark any Filipino phrases with `lang="fil"`.
- **Forms** (registration, Join) need visible labels (never placeholder‑only), inline errors in text rather than colour alone, and error text in Charcoal with a Pink Ink Deep marker.

---

## 17. Do / Don't

| Do | Don't |
|---|---|
| Let big Poppins headlines and whitespace carry the page | Fill space with icons, blobs, illustrations or "AI" decoration |
| Use one surface and one accent per section | Put Pink, Yellow, Charcoal and White together in one section [C‑08] |
| Separate content with hairlines, index lists and columns | Default to three‑column rounded feature cards |
| Use pills for buttons and chips only | Round every container. Use glassmorphism, blur or shadows. |
| Use real Faith Works photography in natural colour | Use stock photos, handshakes, AI‑generated people or glowing‑brain AI imagery |
| Write short declarative statements ending in a period | Use motivational slogans, hype ("Unlock your potential!") or jargon |
| Use one primary CTA per section, with a specific verb | Stack three equal CTAs or add urgency banners and pop‑ups |
| Use the circuit line in only three places | Use it as a background pattern everywhere |
| Use Yellow as a spotlight: CTAs, the `[ai]` block, one surface | Use Yellow as a common background or text colour on light surfaces |
| Make motion reveal content forwards, once | Loop, float or bounce, or hijack scroll |
| Keep the founder layer light and link out to socials [C‑15] | Turn the homepage into a personal‑brand page or embed heavy social feeds |
| Keep faith present as warmth and purpose | Make it overly spiritual, or hide it entirely |
| Use no gradients | Use purple or blue gradients, or any gradient |

---

## 18. Homepage Visual Direction

The homepage has three chapters and a threshold. A header journey indicator (§10) tracks the chapter. Chapter bridges (§13) hand the visitor from one chapter to the next.

```
THRESHOLD   01 Hero
LEARN       02 What is Faith Works? · 03 The Journey (the map) · 04 Workshops & Events · 05 Resources
            ── Next step: "Ready to apply this? → Implement"
IMPLEMENT   06 Programs · 07 Faith AI
            ── Next step: "Ready to make it last? → Scale"
SCALE       08 Community · 09 Founder (supporting) · 10 Final CTA
```

*Why this mapping:* the concept lists workshops, talks and resources under **Learn**; templates, programs and Faith AI under **Implement**; and growth, systems and leadership under **Scale** [C‑04, C‑11]. The homepage sections already fall into those groups, so the scroll order is the journey order.

---

### 01 · Hero (Works White, Yellow accent)
**The concept's hero, taken further typographically.**

```
[ PRACTICAL EDUCATION & BUSINESS TRANSFORMATION ]                  (eyebrow, col 1)

Learn.⁰¹                                   ┌──────────────┐
                                           │  photo on    │   (cols 8–12, 3:2,
Implement.⁰²                               │  pink plate  │    real workshop moment)
                                           └──────────────┘
      Practical education, business
      transformation, AI, leadership …                     Scale.⁰³
      [Explore Learning] (See upcoming events)
```
- The three words form a **staircase that travels left to right**. "Learn." sits at column 1. "Implement." spans the width. "Scale." is right‑aligned. Small `label` numerals ⁰¹ ⁰² ⁰³ in Pink Ink Deep sit top‑right of each word. *Why:* the first thing on the page is a physical path from understanding to growth, and it replaces the generic "headline, paragraph, buttons, image" layout.
- A single **circuit line** (Pink Mid, 1.5px, rounded corners, node dots) threads from "Learn." through "Implement." to "Scale.", drawn on load. The final node on "Scale." is a small AI Yellow dot, which is the section's one accent besides the CTA.
- The **support copy and CTAs** sit in columns 2–6 under "Implement.", on the same row as "Scale.". The primary button is "Explore Learning" and the secondary is "See upcoming events" [C‑13].
- The **image** is one real workshop or founder photo revealed from a Faith Pink plate (the concept's pink hero panel [C‑13]). It sits beside "Learn.", smaller than the concept's half‑screen panel, so the type dominates.
- The hero fills 100svh minus the header on desktop, with 96px or more of whitespace below "Scale.".
- **Mobile:** the words are left‑stacked with no staircase. Copy and CTAs follow, then the image. The circuit line becomes a short vertical path in the left margin.

### 02 · What is Faith Works? (Faith Pink, Charcoal accent) — Learn
- **Top:** the positioning statement from [C‑03] as a large `h2` in Charcoal, spanning columns 1–10: "**Faith Works** is the education and business transformation arm of the Faith Works PH ecosystem." A large Charcoal quote mark sits above it. The concept used yellow on dark; on pink the accent is Charcoal.
- Below it, in columns 7–12, the lead: "It helps founders, professionals and organizations learn practical skills, put them into practice, and build from there."
- **Bottom:** "Who it's for" as a role grid [C‑07] (8 roles, 3 columns, hairlines in Charcoal at 15% opacity), then the line **"No technical background required."** preceded by a short Charcoal bar.
- *Why:* a first‑time visitor learns what Faith Works is and whether it is for them before seeing any offer. This section uses the most text on the page, so its surface is the calmest warm one.

### 03 · The Journey: Learn / Implement / Scale (the map)
**This is the page's centrepiece. The visitor physically passes through the three stages.**
- **Desktop:** a sticky composition 300vh tall. On the left (columns 1–5), a sticky stage block shows the `numeral-xl` number (01/02/03), the stage word in `display-l`, and the voice line in Poppins italic. On the right (columns 7–12), each stage's content scrolls past: a short description, the stage's sub‑topics as an index list with links to the Learn, Implement and Scale pages, and the stage motif (§13).
- As each stage becomes active, **the whole section surface changes**: White (Learn) → Faith Pink (Implement) → White (Scale), matching the columns of [C‑04]. The numeral and word swap with a line‑mask reveal.
- Scrolling stays native. The sticky block is CSS `position: sticky`, and stage changes happen on intersection. This is not scroll‑jacking.
- **Mobile:** three stacked blocks, each full‑width on its own surface with its numeral, word, voice line, motif and topic list.
- *Why:* it is the only section that shows the entire journey at once, and it does so by making the visitor scroll through it.

### 04 · Workshops & Events (Soft Charcoal, Yellow accent) — Learn
- This is the first dark beat. The eyebrow reads `[ 04 · Workshops & Events ]`, and the headline is `h1` in White with one AI Yellow word. ⚑ The copy is TBD. Keep the concept's cadence, e.g. "Learn it in the **room**."
- **The featured next event** is shown large: the date in `numeral-xl` White (e.g. "14"), the month as a `label`, the title in `h2`, format and location, and a Primary "Register now" button. The concept highlights Register Now here [C‑12]. A real photo of a past session sits alongside.
- Below it, the **upcoming list** uses event rows with hairlines at White 14%. There is a text link "See all events →".
- *Why:* this is the first real thing a visitor can do, so it gets the strongest contrast on the page.

### 05 · Resources (Works White, Pink Ink accent) — Learn
- A headline in `h1`, filter chips (All · AI · Business · Leadership · Lifestyle · Faith & Purpose) [C‑14], and 3–6 resource cards. Example titles from the concept: "What AI actually does in a real business", "Systems the business can run on", "A conversation on purpose & work".
- It ends with the **Next‑step bar**: "Ready to apply this? → Implement" and a "Continue" button [C‑14]. This closes the Learn chapter.

### 06 · Programs (Faith Pink, Charcoal accent) — Implement
- The Implement chapter opens with an eyebrow, the headline in `h1`, and the concept's description of Programs: "Deeper, structured learning and transformation." [C‑10]
- Programs are an **index list** of large Poppins rows. Each row shows the program name, format and duration meta on the right, and an `→`. Hovering a row reveals a small photo that follows the row. It is clipped, not floating. ⚑ Program names, formats and durations are TBD.
- The primary action is a Dark button, "View programs".

### 07 · Faith AI (AI Yellow spotlight, Charcoal accent) — Implement
- The page's single yellow room. The wordmark's `[ ai ]` bracket device is set in Charcoal at `numeral-xl` size as the section's graphic, left‑aligned. The headline is `display-l` in Charcoal.
- There is a short explanation, one real image or screen recording of Faith AI in use by a real person, and a Dark primary button.
- ⚑ The concept names Faith AI but does not define it. This document assumes it is a Faith Works AI tool or assistant for putting learning into practice. The copy and the product visual are TBD. **Do not mock up a fake chat UI.**
- It ends with the Next‑step bar in reversed form (Charcoal band, Yellow edge, White text): "Ready to make it last? → Scale".

### 08 · Community (Works White, Pink Ink accent) — Scale
- **"Community can feel warm."** [C‑17] The section leads with the photo mosaic [C‑09] of real rooms and real people.
- The headline is `h1` with one Pink Ink word. The three community pillars (Events · Connection · Participation [C‑11]) appear as a three‑row index list.
- The primary action is the Join button (Yellow is not this section's accent, so it uses Secondary, or links to the Join flow). ⚑ Exact CTA label TBD, e.g. "Join the community".

### 09 · Lifestyle & Founder Socials (Soft Charcoal, Pink Mid accent) — Supporting
- A direct translation of [C‑15]. On the left, the headline "A **human layer**, kept light." style (⚑ final copy TBD) with "human layer" in Pink Mid, a short paragraph, and the yellow `label` "FOLLOW & WATCH ON SOCIAL AND VIDEO CHANNELS" followed by text links to each channel.
- On the right, the founder portrait on its pink backdrop, full‑bleed to the viewport edge.
- It is deliberately shorter than the other sections (about 70vh). *Why:* the concept labels it "Supporting" [C‑12] and "kept light" [C‑15]. **Do not embed social feeds.** They are heavy, off‑brand and break the one‑accent rule.

### 10 · Final CTA (Pink Tint, Yellow accent) — Scale / continue
- A mirror of the closing page [C‑18]. It is centred, with circuit lines drawn in from the corners. "Learn. Implement. Scale." is set in `display-xl`, followed by the F[ai]th Works wordmark and the line "A clearer digital home for practical education, business transformation, and purposeful growth." It ends with the Primary button "Explore Learning" and the Secondary "See upcoming events".
- *Why:* the page ends where it began, but centred and at rest. The staircase has arrived, and the visitor gets a real next action before the footer [C‑12].

### Footer (Soft Charcoal)
- The reversed wordmark, the six nav items with their sub‑items as a quiet index, social links, and a newsletter or Join field (⚑). The legal line reads "Faith Works · part of the Faith Works PH ecosystem." Text is White‑72, and the one accent is AI Yellow on the Join button.

---

## 19. Component Rules

| Component | Rules |
|---|---|
| `SectionShell` | Props: `surface` (`white` / `pink` / `charcoal` / `yellow` / `pinkTint`) and `accent`. It sets CSS variables `--surface`, `--ink`, `--ink-muted`, `--accent` and `--rule`, so children never hard‑code colours. Padding follows §6. It sets `data-surface` so the header can adapt. |
| `Eyebrow` | `[ NN · Label ]`. Bracket colours follow §4.4, the brackets are `aria-hidden`, and the number is optional. |
| `DisplayHeading` | Levels `display-xl`, `display-l`, `h1`, `h2`. An optional `highlight` prop wraps **one** span in the accent colour. Line‑mask reveal is built in and respects reduced motion. |
| `VoiceLine` | Poppins 500 italic in Pink Ink (on light) or Pink Mid (on dark). At most one per section. |
| `Button` | Variants `primary`, `secondary`, `dark`, `reversed`, `link`. Pill radius, sizes `md` (48px) and `lg` (52px), and an optional trailing `→` glyph. |
| `IndexList` / `IndexRow` | Number, title, meta and link. Hairline top and bottom. Hover indents the title 12px and reveals the `→`. On mobile the meta moves under the title. |
| `OfferingColumns` | 2–4 columns with vertical hairlines. The accent bar colour alternates only if the section's accent allows it, otherwise it uses the single accent. |
| `RoleGrid` | 3 columns with a hairline above each item. Title in `h4`, one‑liner in `body-s` grey. |
| `ResourceCard` | 3:2 image with 6px radius, category `label`, `h4` title. The whole card is a link. Hover follows §12. |
| `EventFeature` / `EventRow` | Date numeral in Poppins 800. The Register button is the Primary variant only on charcoal sections. |
| `FilterChips` | Outline pills. The active chip is a Charcoal fill. Render as a `role="group"` of `button`s with `aria-pressed`. |
| `NextStepBar` | A Faith Pink band with a 4px Yellow left edge, a `label` "NEXT STEP", an `h4` line and a Dark button. The reversed variant is for dark and yellow contexts. |
| `JourneyStage` | Numeral, word, voice line, motif (`circuit` / `photo` / `ascend`), topic list. Used by the homepage §03 and by the stage landing pages. |
| `CircuitLine` | An SVG path with rounded 16px corners, 1.5px stroke in Pink Mid and 4px node dots. It draws on scroll and is `aria-hidden`. Allowed only in the hero, Learn stage and final CTA. |
| `AscendLine` | An SVG polyline in AI Yellow (3px) with Charcoal nodes, ending in an arrow. Scale contexts only. |
| `PhotoMosaic` | The [C‑09] layout. 12px gaps, 6px radius, clip‑reveal staggered at 70ms. |
| `FounderSplit` | The [C‑15] layout: text on Charcoal, full‑bleed portrait on a pink backdrop. |
| `Header` / `NavPanel` / `MobileMenu` | See §10. |
| `JourneyIndicator` | Homepage header only. Three labels. The active one uses weight plus a 2px accent underline and is announced via `aria-current="step"`. |
| `SectionFolio` | Optional chapter/section folio at the bottom of chapter openers (§4.5). |

**Every component** reads colours only from `SectionShell` variables, uses only the spacing and type tokens, and must render correctly on every surface it is allowed on.

---

## 20. Implementation Notes

**Stack (recommendation, framework‑agnostic)**
- Semantic HTML with CSS custom properties. Any component framework works (e.g. Astro or Next.js). The system does not depend on a UI library, so don't import shadcn or Material styling. Their defaults (radius, shadows, grey palettes) contradict this document.
- Motion: CSS transitions plus `IntersectionObserver` for reveals and stage changes. Use CSS scroll‑driven animations (`animation-timeline: view()`) for path draws and parallax, with an IntersectionObserver fallback. GSAP ScrollTrigger is acceptable **only** if needed for the Journey section's sticky timing. **Do not use smooth‑scroll libraries** (Lenis and similar), because they conflict with the no‑scroll‑jacking rule.

**Fonts**
- Poppins 500 italic, 600, 700 and 800, plus Inter 400, 500 and 600. Self‑host WOFF2 subsets (Latin plus Latin Extended for Filipino names and diacritics) with `font-display: swap`. Preload Poppins 800 and Inter 400.
- Tune the fallback metrics (`size-adjust`, `ascent-override`) on a local Arial fallback to avoid layout shift from the huge hero type.

**Token starter**
```css
:root {
  /* brand (C-08) */
  --fw-pink: #F8D8E0;
  --fw-yellow: #FBC522;
  --fw-white: #FAF8F4;
  --fw-charcoal: #1A1A1A;
  /* supporting (sampled from concept) */
  --fw-pink-tint: #FBEEF2;
  --fw-pink-mid: #EFACBA;
  --fw-pink-ink: #E85D8A;
  --fw-pink-ink-deep: #B8305F; /* ⚑ accessible small text */
  --fw-hairline: #E8D2D9;
  --fw-grey: #5B5E66;
  --fw-white-72: rgba(250, 248, 244, 0.72);
  --fw-rule-dark: rgba(250, 248, 244, 0.14);
  --fw-yellow-hover: #EDB710;

  --font-display: "Poppins", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;

  --margin: clamp(20px, 6.25vw, 96px);
  --gutter: clamp(16px, 1.7vw, 24px);
  --section-y: clamp(96px, 12vw, 176px);

  --radius-media: 6px;
  --radius-card: 8px;
  --radius-pill: 999px;

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}

[data-surface="white"]    { --surface: var(--fw-white);    --ink: var(--fw-charcoal); --ink-muted: var(--fw-grey);     --rule: var(--fw-hairline); }
[data-surface="pink"]     { --surface: var(--fw-pink);     --ink: var(--fw-charcoal); --ink-muted: var(--fw-grey);     --rule: rgba(26,26,26,.15); --accent: var(--fw-charcoal); }
[data-surface="pinkTint"] { --surface: var(--fw-pink-tint); --ink: var(--fw-charcoal); --ink-muted: var(--fw-grey);    --rule: var(--fw-hairline); --accent: var(--fw-yellow); }
[data-surface="charcoal"] { --surface: var(--fw-charcoal); --ink: var(--fw-white);    --ink-muted: var(--fw-white-72); --rule: var(--fw-rule-dark); }
[data-surface="yellow"]   { --surface: var(--fw-yellow);   --ink: var(--fw-charcoal); --ink-muted: var(--fw-charcoal); --rule: rgba(26,26,26,.2);  --accent: var(--fw-charcoal); }
/* white and charcoal set --accent per section: yellow OR pink (never both) */
```

**Content model (for a CMS later)**
Event (title, date, format, location, register URL, image, stage), Resource (title, category, type, stage, image, body), Program (name, format, duration, stage, summary). Every item carries a `stage` (learn / implement / scale). *Why:* Next‑step bars and stage colours can then be generated rather than hand‑placed.

**Performance budget:** hero LCP under 2.0s on 4G. The LCP element is the `h1` text, not the image, so render the type first. Keep under 60KB of JavaScript on the homepage, excluding the framework runtime. CLS must be 0 for hero type.

**QA checklist before any section ships**
- [ ] One surface and one accent (system marks excepted)
- [ ] Headline uses the token scale, with at most one highlight
- [ ] No horizontal overflow at 320, 375, 768, 1024, 1280 and 1440px
- [ ] Contrast pairs match the §16 table
- [ ] Reduced‑motion mode shows all content immediately
- [ ] Real photography only, with alt text written
- [ ] One primary CTA with a specific verb label

---

## Appendix A — Open assumptions (⚑) to confirm with Faith Works

1. `--fw-pink-ink-deep #B8305F`: a darker step of the concept pink, added only for accessible small text.
2. `#1A1A1A` is used over the `#1A1E24` rendered on the concept's dark pages.
3. Faith AI gets the page's one AI Yellow surface.
4. Community uses Works White instead of the concept's pink tint, for pacing.
5. Faith AI's nature (a tool or assistant) and all of its copy.
6. Whether the founder cut‑out is part of the header logo lockup.
7. What the Join CTA leads to (community sign‑up or newsletter).
8. Section headline copy for 04, 06, 08 and 09, and program names and details. The concept provides structure but not final website copy for these.
9. The homepage journey indicator in the header, a direct expression of [C‑12] that the concept does not draw.
10. Footer contents.

## Appendix B — Concept copy that is ready for the site
- "Learn. Implement. Scale." · "Practical education & business transformation" · "Practical education, business transformation, AI, leadership and purposeful growth, in one clear place." · "Explore Learning" / "See upcoming events" [C‑13]
- "I want to understand this." / "I want to apply this." / "I want this to last." [C‑04]
- "Faith Works is the education and business transformation arm of the Faith Works PH ecosystem." + lead [C‑03]
- Audience roles and one‑liners, and "No technical background required." [C‑07]
- "Four ways to learn. One system." plus the four offering descriptions [C‑10]
- "Ready to apply this? → Implement" [C‑14]
- "A clearer digital home for practical education, business transformation, and purposeful growth." [C‑18]

*Presentation‑only copy that should not go on the site:* "One clear home for practical learning." (pitch framing), "Simple on the surface, rich underneath.", "The homepage doesn't describe the journey. It is the journey.", "One brand. Many expressions." These are design principles, not visitor‑facing messages. "Many entry points. One journey." and "Real people. Real work. Real learning." *may* be used on the About page.
