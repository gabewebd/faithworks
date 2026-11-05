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

for name, color, fn in [("icon-clock-pink.png", "pink", clock), ("icon-pin-yellow.png", "yellow", pin), ("icon-book-yellow.png", "yellow", book)]:
    im = tile(color); d = ImageDraw.Draw(im)
    fn(d, TILES[color]) if fn is pin else fn(d); save(im, name)
