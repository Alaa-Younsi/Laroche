#!/usr/bin/env python3
"""Re-encode the hero carousel posters from PNG to WebP.

The client drops the category posters into public/hero-slider as PNGs
(~270-380 KB each). Three of them are mounted on the 3D stage at once and the
carousel advances every 2s, so on a phone the browser is decoding several
hundred KB of lossless PNG while animating — the posters are photographs, which
is exactly the case WebP is built for.

The PNGs stay on disk as the editable source; the .webp files sit next to them
and are what the site actually loads (see src/lib/heroSlides.ts). Re-run this
whenever the posters are replaced or re-exported:

    python scripts/optimize-hero-slider.py
"""

from pathlib import Path

from PIL import Image

FOLDER = Path(__file__).resolve().parent.parent / "public" / "hero-slider"
QUALITY = 82


def main() -> None:
    sources = sorted(FOLDER.glob("*.png"))
    if not sources:
        print(f"no PNGs found in {FOLDER}")
        return

    before = after = 0
    for src in sources:
        dest = src.with_suffix(".webp")
        with Image.open(src) as im:
            im.convert("RGB").save(dest, "WEBP", quality=QUALITY, method=6)

        src_kb = src.stat().st_size / 1024
        dest_kb = dest.stat().st_size / 1024
        before += src_kb
        after += dest_kb
        saved = 100 - (dest_kb / src_kb * 100)
        print(f"{src.name:24} {src_kb:7.1f} KB -> {dest.name:26} {dest_kb:6.1f} KB  (-{saved:.0f}%)")

    print(f"\ntotal {before:.0f} KB -> {after:.0f} KB  (-{100 - after / before * 100:.0f}%)")


if __name__ == "__main__":
    main()
