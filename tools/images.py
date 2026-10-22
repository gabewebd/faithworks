"""Faith Works web images, made from the originals listed in src/data/gallery.json.

    python tools/images.py            make anything missing or older than its original
    python tools/images.py --force    remake everything

Each photo gets two WebP files in assets/images/web/: <id>-640.webp (phones, small slots) and
<id>-1280.webp (everything larger), never wider than the (cropped) original. Photos marked
"social" also get <id>-1200.jpg, a 1200x630 link-preview image. The originals stay untouched in
assets/images/; the site only ever loads the web versions. src/data/gallery.lock.json records each
photo's final size and the real width of each file (listed in the order 640, 1280), so the build can reserve its space (width/height) without opening the file.
Needs Pillow (pip install pillow). The web versions are committed, so builds (Vercel) need nothing.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "src" / "data" / "gallery.json"
LOCK = ROOT / "src" / "data" / "gallery.lock.json"
OUT = ROOT / "assets" / "images" / "web"
WIDTHS = (640, 1280)
WEBP_QUALITY = 78
SOCIAL = (1200, 630)


def load(src):
    im = ImageOps.exif_transpose(Image.open(src))
    if im.mode in ("RGBA", "LA", "P"):
        # Photos only: flatten any alpha onto Works White rather than black
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (250, 248, 244))
        bg.paste(im, mask=im.getchannel("A"))
        return bg
    return im.convert("RGB")


def crop(im, box):
    if not box:
        return im
    w, h = im.size
    l, t, r, b = box
    return im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))


def focal(position):
    # "40% 30%" -> (0.4, 0.3); anything else is the centre
    try:
        x, y = (float(p.rstrip("%")) / 100 for p in position.split())
        return x, y
    except (AttributeError, ValueError):
        return 0.5, 0.5


def social_crop(im, position):
    tw, th = SOCIAL
    w, h = im.size
    scale = max(tw / w, th / h)
    im = im.resize((max(tw, round(w * scale)), max(th, round(h * scale))), Image.LANCZOS)
    fx, fy = focal(position)
    left = round((im.width - tw) * fx)
    top = round((im.height - th) * fy)
    return im.crop((left, top, left + tw, top + th))


def main():
    force = "--force" in sys.argv
    reg = json.loads(REGISTRY.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    lock, made, problems = {}, 0, []
    for key, spec in reg["images"].items():
        src = ROOT / spec["src"]
        if not src.is_file():
            problems.append(f"{key}: original not found ({spec['src']})")
            continue
        targets = [OUT / f"{key}-{w}.webp" for w in WIDTHS]
        if spec.get("social"):
            targets.append(OUT / f"{key}-1200.jpg")
        stale = force or any(not t.is_file() or t.stat().st_mtime < src.stat().st_mtime for t in targets)
        old = None
        if not stale and LOCK.is_file():
            old = json.loads(LOCK.read_text(encoding="utf-8")).get(key)
            stale = not old or old.get("crop") != spec.get("crop")
        if not stale:
            lock[key] = old
            continue
        im = crop(load(src), spec.get("crop"))
        widths = []
        for w in WIDTHS:
            # never upscale: a small original gets one file at its own width
            size = min(w, im.width)
            out = im if size == im.width else im.resize((size, round(im.height * size / im.width)), Image.LANCZOS)
            out.save(OUT / f"{key}-{w}.webp", "WEBP", quality=WEBP_QUALITY, method=6)
            widths.append(size)
        if spec.get("social"):
            social_crop(im, spec.get("position")).save(OUT / f"{key}-1200.jpg", "JPEG", quality=82, optimize=True, progressive=True)
        big = min(WIDTHS[-1], im.width)
        lock[key] = {"width": big, "height": round(im.height * big / im.width), "widths": widths, "crop": spec.get("crop")}
        made += 1
        print(f"  {key}: {spec['src']} -> {big}x{lock[key]['height']}")
    # Web files whose photo left the registry are removed (only inside assets/images/web/)
    keep = {f"{k}-{w}.webp" for k in lock for w in WIDTHS} | {f"{k}-1200.jpg" for k, s in reg["images"].items() if s.get("social")}
    for f in OUT.iterdir():
        if f.is_file() and f.name not in keep:
            f.unlink()
            print(f"  removed {f.name} (no longer in the registry)")
    LOCK.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    print(f"Images: {made} made, {len(lock) - made} up to date, {len(problems)} problems.")
    for p in problems:
        print("  PROBLEM " + p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
