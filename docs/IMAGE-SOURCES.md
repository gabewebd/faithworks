# Image sources

Where every non-Faith Works image on the site comes from. Replace each temporary photo with a final Faith Works asset before launch.

## Faith Works photos (final)

From Faith Works sessions: `masterclass-batch3-*`, `masterclass-room-*`, `workshop-qa-*`, `participants-laptop-*`, `workshop-slides-*`, `speaker-pink-blazer-*`, `founder-portrait-*`, `ai-claude-masterclass-batch2.png`, `ai-linkedin-*` (AI + LinkedIn B2B Growth Accelerator poster).

Upcoming events without their own photo yet use one of these, labelled with `image.caption` in `events.json` ("Past session · …"). The draft success stories in `stories.json` also borrow these photos to hold the space; replace them with each story's own photo.

## Temporary stock photos (Unsplash, replace before launch)

In HTML the source sits on the `<picture>` as `data-image-source` with a comment. In JSON it's the image's `source` field, which the site outputs as the same attribute.

| File (`assets/images/…`) | Used in | Source |
| --- | --- | --- |
| `temp-ai-everyday-work-*` | insights.json: *AI Is Not Another Niche Skill* | https://unsplash.com/photos/a-man-sitting-at-a-table-using-a-laptop-computer-YF7iYfmF488 |
| `temp-full-day-*` | insights.json: *Your Day Is Already Full* | https://unsplash.com/photos/a-couple-of-men-sitting-at-a-table-with-laptops-A9qQ8vE1Bmw |
| `temp-learning-to-doing-*` | insights.json: *From Learning to Doing* | https://unsplash.com/photos/two-colleagues-collaborating-on-a-laptop-in-office-YDWdxElP3XI |
| `temp-leadership-*` | insights.json: *Where Human Judgment Still Matters* | https://unsplash.com/photos/a-group-of-people-sitting-around-a-table-with-laptops-cNGvcAvxHAo |
| `temp-growth-*` | insights.json: *Purpose Before Productivity*; scale.html | https://unsplash.com/photos/woman-in-black-long-sleeve-shirt-standing-near-brown-wooden-shelf-3BdlPx8sBPw |
| `temp-research-workflow-*` | insights.json: *How to Research Faster With AI*; resources.json: *AI-Assisted Research Workflow*; implement.html | https://unsplash.com/photos/person-holding-pencil-near-laptop-computer-5fNmWej4tAA |
| `temp-starter-kit-*` | resources.json: *Prompt Starter Kit & Tools Guide* | https://unsplash.com/photos/silver-laptop-computer-near-notebook-ck0i9Dnjtj0 |
| `temp-opportunity-map-*` | resources.json: *AI Opportunity Map*; implement.html | https://unsplash.com/photos/man-in-white-long-sleeve-shirt-writing-on-white-board-um1zVjVCtEY |
| `temp-team-systems-*` | resources.json: *AI Workforce Accelerator*; scale.html | https://unsplash.com/photos/team-collaborating-on-laptops-in-modern-office-N3Bf0ArT5J0 |
| `temp-transformation-*` | scale.html | https://unsplash.com/photos/man-presenting-charts-on-a-large-screen-to-audience-d80Nf1ptTfY |
| `temp-coaching-*` | implement.html (Program); resources.json: *30-Day AI Workforce Action Plan* | https://unsplash.com/photos/two-men-are-looking-at-a-laptop-on-a-table-3HduTMXyzFc |
| `temp-faith-ai-*` | index.html, implement.html (Faith AI); insights.json: *A Learning Rhythm That Fits Real Life* | https://unsplash.com/photos/a-man-sitting-at-a-table-with-a-laptop-KkLGj4515RU |
| `temp-talks-*` | learn.html (Talks) | https://unsplash.com/photos/black-condenser-microphone-UUPpu2sYV6E |
| `temp-speaker-*` | community.html (Stay connected) | https://unsplash.com/photos/a-woman-standing-on-a-stage-with-a-microphone-9zutjaUEN3Q |

## AI tool logos (`assets/icons/tools/`)

Listed in `tools.json` and shown on Implement as examples of tools used in practical workflows. Showing them doesn't imply a partnership or endorsement; the marks are the trademarks of their owners.

| File | Source |
| --- | --- |
| `claude.svg`, `chatgpt.svg` (OpenAI mark), `gemini.svg`, `notebooklm.svg`, `perplexity.svg` | [Simple Icons](https://simpleicons.org/) v16.32.0 (CC0), via `cdn.jsdelivr.net/npm/simple-icons/icons/`. Set to `fill="currentColor"`, title removed. |
| `claude-code.svg` | Simple Icons v16.32.0 (`claudecode`, CC0), same treatment. |
| `codex.svg` | Placeholder drawn for this site: a terminal prompt in a rounded frame. Simple Icons has no Codex or OpenAI mark. Swap for OpenAI's official Codex mark if needed. |
| `gamma.svg` | Placeholder drawn for this site: a simple "G" stroke. Simple Icons has no Gamma mark. Swap it for Gamma's official logo from their brand kit if one is needed. |

Logos are single-colour and drawn as a CSS mask, so they take the section's ink colour. Brand guidelines may still apply to how each mark is used.
