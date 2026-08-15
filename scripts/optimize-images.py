#!/usr/bin/env python3
"""Re-encode the bundled site photography from PNG to WebP.

The client supplies photographs as lossless PNGs. `public/images/` alone was
23.3 MB, of which the landing page pulled ~6.1 MB on every visit — that, not
the animations, is what made the site feel slow on a phone (measured: the hero
carousel held ~53fps under 4x CPU throttle with every effect enabled).

The PNGs stay on disk as the editable source; the .webp files sit next to them
and are what the site actually loads:
  - public/images        -> src/lib/editorialImages.ts swaps the extension
  - public/hero-slider   -> src/lib/heroSlides.ts references .webp directly

Re-run this whenever the client replaces or adds a photo:

    python scripts/optimize-images.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = [ROOT / "public" / "images", ROOT / "public" / "hero-slider"]
QUALITY = 82
# Nothing on the site renders wider than ~1000 CSS px, so 1600 still leaves
# headroom for high-DPI screens without shipping pixels no one can see.
MAX_EDGE = 1600


def convert(folder: Path) -> tuple[float, float]:
    sources = sorted(folder.glob("*.png"))
    if not sources:
        print(f"  (no PNGs in {folder.relative_to(ROOT)})")
        return 0.0, 0.0

    before = after = 0.0
    for src in sources:
        dest = src.with_suffix(".webp")
        with Image.open(src) as im:
            im = im.convert("RGB")
            if max(im.size) > MAX_EDGE:
                im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
            im.save(dest, "WEBP", quality=QUALITY, method=6)

        src_kb = src.stat().st_size / 1024
        dest_kb = dest.stat().st_size / 1024
        before += src_kb
        after += dest_kb
        print(f"  {src.name:26} {src_kb:8.1f} KB -> {dest_kb:7.1f} KB  (-{100 - dest_kb / src_kb * 100:.0f}%)")

    return before, after


def main() -> None:
    grand_before = grand_after = 0.0
    for folder in FOLDERS:
        print(f"\n{folder.relative_to(ROOT)}")
        before, after = convert(folder)
        grand_before += before
        grand_after += after

    if grand_before:
        print(
            f"\ntotal {grand_before / 1024:.1f} MB -> {grand_after / 1024:.2f} MB "
            f"(-{100 - grand_after / grand_before * 100:.0f}%)"
        )


if __name__ == "__main__":
    main()
