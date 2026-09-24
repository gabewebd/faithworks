# GoHighLevel handoff

The site is six HTML pages (`index`, `learn`, `implement`, `scale`, `community`, `about`) plus one `css/style.css`, one `js/main.js` and `assets/`. Every page uses the same CSS and JS.

## Steps
1. **Upload `css/style.css` to the CDN.**
2. **Upload `js/main.js` to the CDN.**
3. **Upload the assets.** Put `assets/images/*` and `assets/icons/*` on the CDN or in the GHL media library.
4. **Add the stylesheets** to GHL's site-wide **head** code:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:ital,wght@0,600;0,700;0,800;1,500&display=swap">
   <link rel="stylesheet" href="CDN_URL/style.css">
   ```
5. **Add the script** to the head code as well:
   ```html
   <script src="CDN_URL/main.js" defer></script>
   ```
6. **Copy the sections, page by page.**
   - The `<header>` and `<footer>` are identical on every page, so make each one a GHL global section once.
   - On each page, mark the current page by adding `aria-current="page"` to that page's nav link.
   - For each `<section class="fw-…">…</section>`, add a full-width GHL section containing a Custom HTML element and paste the markup in. Sections are independent, so any order works.
7. **Replace placeholders.**
   - Change image paths (`assets/images/…`, `assets/icons/…`) to their CDN or GHL URLs.
   - Swap in real content wherever there's a placeholder. Open the page with `?placeholders` to see them all outlined.
8. **Replace links and forms.**
   - Update CTA `href`s. Pages link to each other as `learn.html`, `implement.html#programs` and so on; swap these for your GHL page URLs, keeping the `#anchors`.
   - Replace the "Register" links with GHL forms or calendars.
   - Replace the footer `<form>` with a GHL form, but keep the `fw-footer__join` wrapper.

## Good to know
- **Each section's banner comment** in `index.html` says what it needs and what's still a placeholder.
- **JavaScript is optional per section.** Without it, content shows without animation, and "Menu" jumps to the footer links.
- **If the CDN is slow,** content can briefly appear and then animate in once `main.js` loads. To avoid that, also add `<script>document.documentElement.classList.add("fw-js")</script>` to the head.
- **Picture elements:** if GHL strips `<picture>`, a single `<img src="…">` is fine.
