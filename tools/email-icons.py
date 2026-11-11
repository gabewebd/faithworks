# Draws the newsletter's meta icons in the style of assets/email/icon-calendar-pink.png:
# 168px rounded tile (pink #EFACBA or yellow #FBC522) with a black line icon. Run: python tools/email-icons.py
import math, os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "email")
K = 4                      # supersample factor
N = 168 * K
INK = (26, 26, 26, 255)
W = 9 * K                  # stroke width
TILES = {"pink": (239, 172, 186, 255), "yellow": (251, 197, 34, 255)}

def tile(color):
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, N - 1, N - 1], radius=40 * K, fill=TILES[color])
    return im

def save(im, name):
    im.resize((168, 168), Image.LANCZOS).save(os.path.join(OUT, name))
    print("wrote", name)

def p(x, y): return (x * K, y * K)

def clock(d):
    c, r = 84, 38
    d.ellipse([p(c - r, c - r), p(c + r, c + r)], outline=INK, width=W)
    d.line([p(c, c), p(c, c - 22)], fill=INK, width=W)
    d.line([p(c, c), p(c + 16, c + 10)], fill=INK, width=W)
    d.ellipse([p(c - 6, c - 6), p(c + 6, c + 6)], fill=INK)

def pin_shape(d, cx, cy, r, ty, fill):
    phi = math.acos(r / (ty - cy))
    d.ellipse([p(cx - r, cy - r), p(cx + r, cy + r)], fill=fill)
    d.polygon([p(cx + r * math.cos(math.pi / 2 + phi), cy + r * math.sin(math.pi / 2 + phi)),
               p(cx + r * math.cos(math.pi / 2 - phi), cy + r * math.sin(math.pi / 2 - phi)), p(cx, ty)], fill=fill)

def pin(d, bg):
    pin_shape(d, 84, 70, 34, 132, INK)
    pin_shape(d, 84, 70, 25, 118, bg)
    d.ellipse([p(73, 59), p(95, 81)], fill=INK)

def book(d):
    # open book: two pages meeting at a spine
    d.line([p(84, 58), p(84, 122)], fill=INK, width=W)
    d.line([p(84, 58), p(48, 50), p(40, 52), p(40, 114), p(84, 122), p(128, 114), p(128, 52), p(120, 50), p(84, 58)], fill=INK, width=W, joint="curve")
    for y in (72, 88):
        d.line([p(52, y - 6), p(72, y - 2)], fill=INK, width=6 * K)
        d.line([p(96, y - 2), p(116, y - 6)], fill=INK, width=6 * K)

def video(d):
    # camera: rounded body + lens triangle
    d.rounded_rectangle([p(36, 58), p(106, 112)], radius=12 * K, outline=INK, width=W)
    d.polygon([p(114, 78), p(136, 62), p(136, 108), p(114, 92)], fill=INK)

def calendar_line(d):
    # simple outline calendar: no white fill, no inner square
    d.rounded_rectangle([p(38, 46), p(130, 128)], radius=14 * K, outline=INK, width=W)
    d.line([p(38, 76), p(130, 76)], fill=INK, width=W)
    for x in (62, 106):
        d.line([p(x, 34), p(x, 58)], fill=INK, width=W)

for name, color, fn in [("icon-calendar-line-pink.png", "pink", calendar_line), ("icon-video-pink.png", "pink", video), ("icon-clock-pink.png", "pink", clock), ("icon-pin-yellow.png", "yellow", pin), ("icon-book-yellow.png", "yellow", book)]:
    im = tile(color); d = ImageDraw.Draw(im)
    fn(d, TILES[color]) if fn is pin else fn(d); save(im, name)

# Poster-style burst of three dashes (Build Your Breakthrough 2027 emails): transparent 88x88, pink strokes
def sparkle():
    n, k = 88, 4
    im = Image.new("RGBA", (n * k, n * k), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    ox, oy = 14, 74                      # burst origin (lower left)
    for ang, r0, r1 in [(8, 26, 62), (42, 24, 58), (76, 22, 52)]:
        a = math.radians(ang)
        d.line([((ox + r0 * math.cos(a)) * k, (oy - r0 * math.sin(a)) * k), ((ox + r1 * math.cos(a)) * k, (oy - r1 * math.sin(a)) * k)],
               fill=TILES["pink"], width=9 * k)
        for r in (r0, r1):
            x, y = (ox + r * math.cos(a)) * k, (oy - r * math.sin(a)) * k
            d.ellipse([x - 4.5 * k, y - 4.5 * k, x + 4.5 * k, y + 4.5 * k], fill=TILES["pink"])
    im.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, "bbyb-sparkle-pink.png")); print("wrote bbyb-sparkle-pink.png")
sparkle()
