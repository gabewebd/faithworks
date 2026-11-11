# Build Your Breakthrough 2027 email header, styled after assets/images/events/build-your-breakthrough-2027.jpg.
# Writes the SVG source (email-templates/headers/13-bbyb-header.svg), then exports
# assets/email/bbyb-header.png at 1200px wide (shown at 600px in the emails) with headless Chromium.
# Run: python tools/email-header-bbyb.py            (needs Python Playwright + network for Google Fonts)
import os, re
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SVG_OUT = os.path.join(ROOT, "email-templates", "headers", "13-bbyb-header.svg")
PNG_OUT = os.path.join(ROOT, "assets", "email", "bbyb-header.png")

W = 1200
# Lockup is laid out in design units (content spans y 44..760, card x 110..1090), then scaled by S
S, TOP = 1.15, 34
H = round(TOP + 716 * S + 46)
HOT, PINK, YEL, INK = "#E8157F", "#EFACBA", "#FBC522", "#1A1A1A"

# Official wordmark paths (assets/icons/wordmark.svg), nested so it keeps its own viewBox
wm = open(os.path.join(ROOT, "assets", "icons", "wordmark.svg"), encoding="utf-8").read()
wm_paths = "\n".join(re.findall(r"<(?:path|rect)[^>]*/>", wm))
WM_W = 330
WM_H = round(WM_W * 385 / 1906)


def burst(x, y, rot, scale=1.0):
    # three rounded dashes fanning out, like the poster's pink accents
    s = scale
    return f'''<g transform="translate({x} {y}) rotate({rot}) scale({s})" stroke="{HOT}" stroke-width="9" stroke-linecap="round" fill="none">
      <line x1="0" y1="-34" x2="10" y2="-62"/><line x1="12" y1="-4" x2="44" y2="-14"/><line x1="10" y1="22" x2="38" y2="36"/></g>'''

F = "font-family:Poppins,'Helvetica Neue',Arial,sans-serif;font-style:italic;"
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="Build Your Breakthrough 2027: 5 Practical Steps to Grow with AI">
  <title>Build Your Breakthrough 2027</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@1,600;1,700;1,800;1,900&amp;display=swap');</style>
  <defs>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FDF0F4"/></linearGradient>
    <!-- background: the card's white-to-blush gradient, a touch stronger and on the diagonal so the frame isn't flat -->
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCE8EF"/><stop offset="0.5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FBE2EA"/></linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="{INK}" flood-opacity="0.08"/></filter>
    <clipPath id="frame"><rect width="{W}" height="{H}"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="{W}" height="{H}" fill="url(#bg)"/>
    <g transform="translate({W / 2} {TOP}) scale({S}) translate({-W / 2} -44)">
    <!-- wordmark -->
    <svg x="{(W - WM_W) / 2}" y="44" width="{WM_W}" height="{WM_H}" viewBox="0 70 1906 385">{wm_paths}</svg>

    <!-- tagline -->
    <text x="{W / 2}" y="190" text-anchor="middle" style="{F}font-weight:600;font-size:28px;" fill="{INK}">Stop collecting AI prompts. Start applying AI to real work.</text>

    <!-- title card -->
    <rect x="110" y="262" width="980" height="498" rx="44" fill="url(#card)" stroke="#F6C9D7" stroke-width="3" filter="url(#shadow)"/>
    <!-- coach pill straddling the card's top edge -->
    <rect x="{W / 2 - 236}" y="234" width="472" height="56" rx="28" fill="{HOT}"/>
    <text x="{W / 2}" y="272" text-anchor="middle" style="{F}font-weight:700;font-size:25px;letter-spacing:0.3px;" fill="#FFFFFF">with Coach Faith Natividad</text>
    <text x="{W / 2}" y="388" text-anchor="middle" style="{F}font-weight:800;font-size:84px;letter-spacing:-2px;" fill="{INK}">BUILD YOUR</text>
    <text x="{W / 2}" y="478" text-anchor="middle" style="{F}font-weight:800;font-size:96px;letter-spacing:-2.5px;" fill="{INK}">BREAKTHROUGH</text>

    <!-- 2027 pill + burst -->
    <rect x="{W / 2 - 190}" y="504" width="380" height="132" rx="66" fill="{YEL}"/>
    <text x="{W / 2 - 4}" y="610" text-anchor="middle" style="{F}font-weight:800;font-size:116px;letter-spacing:-3px;" fill="{INK}">2027</text>
    {burst(W / 2 + 200, 566, 0)}

    <!-- subtitle + pink swoosh -->
    <text x="{W / 2}" y="690" text-anchor="middle" style="{F}font-weight:600;font-size:34px;" fill="{INK}">5 Practical Steps to Grow with AI</text>
    <path d="M410 726 Q 600 706 800 720" fill="none" stroke="{HOT}" stroke-width="7" stroke-linecap="round"/>
    </g>
  </g>
</svg>
'''

os.makedirs(os.path.dirname(SVG_OUT), exist_ok=True)
with open(SVG_OUT, "w", encoding="utf-8") as f:
    f.write(svg)
print("wrote", os.path.relpath(SVG_OUT, ROOT))

html = f'<!doctype html><html><head><style>html,body{{margin:0;padding:0;background:#fff}}svg{{display:block}}</style></head><body>{svg}</body></html>'
with sync_playwright() as pw:
    br = pw.chromium.launch(channel="chrome")  # the installed Google Chrome
    pg = br.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    pg.set_content(html, wait_until="networkidle")
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(300)
    loaded = pg.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight + ' ' + f.style)")
    print("fonts:", loaded)
    pg.locator("svg").first.screenshot(path=PNG_OUT)
    br.close()
print("wrote", os.path.relpath(PNG_OUT, ROOT))
