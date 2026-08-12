#!/usr/bin/env python3
"""Re-encode the product-images bucket to real WebP, in place.

Why this exists: src/lib/image.ts used to name every compressed upload ".webp"
and tag it image/webp regardless of what canvas.toBlob actually produced. Safari
can't encode WebP (before 17) and silently returns PNG instead, so uploads from
the client's iPhone landed as 1400px lossless PNGs wearing a WebP label —
roughly 10x the bytes they should be. That is what burned through the Supabase
free-tier egress allowance. image.ts is fixed for new uploads; this script
repairs the files already in the bucket.

Objects are overwritten AT THE SAME PATH, so every URL already stored in the
database keeps working and no rows need touching. Originals are copied to the
backup directory first.

Usage:
  python scripts/reencode-storage-images.py            # dry run, changes nothing
  python scripts/reencode-storage-images.py --apply    # download, re-encode, overwrite
"""

import io
import json
import os
import sys
import urllib.request
from pathlib import Path

MAX_EDGE = 1400
WEBP_QUALITY = 82
BUCKET = "product-images"
# Only replace a file when the saving is worth the CDN cache purge.
MIN_SAVING_RATIO = 0.15

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  python -m pip install Pillow")


def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def request(url: str, method="GET", data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def main() -> None:
    apply_changes = "--apply" in sys.argv
    root = Path(__file__).resolve().parent.parent
    env = load_env(root / ".env")

    base = env.get("VITE_SUPABASE_URL", "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        sys.exit("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")

    auth = {"apikey": key, "Authorization": f"Bearer {key}"}
    backup_dir = root / ".image-backup"

    listing = json.loads(
        request(
            f"{base}/storage/v1/object/list/{BUCKET}",
            method="POST",
            data=json.dumps({"prefix": "", "limit": 10000}).encode(),
            headers={**auth, "Content-Type": "application/json"},
        )
    )
    objects = [o for o in listing if (o.get("metadata") or {}).get("size")]
    print(f"{len(objects)} objects in {BUCKET}\n")

    if apply_changes:
        backup_dir.mkdir(exist_ok=True)
        print(f"originals -> {backup_dir}\n")

    before_total = after_total = 0
    rewritten = skipped = failed = 0

    for i, obj in enumerate(sorted(objects, key=lambda o: -(o["metadata"]["size"])), 1):
        name = obj["name"]
        before = obj["metadata"]["size"]
        before_total += before

        try:
            raw = request(f"{base}/storage/v1/object/public/{BUCKET}/{name}", headers=auth)
            image = Image.open(io.BytesIO(raw))
            image.load()
        except Exception as err:  # not an image, or unreadable — leave it alone
            print(f"[{i:>3}] SKIP  {name[:52]:<52} ({err})")
            after_total += before
            failed += 1
            continue

        # Preserve alpha only if the source actually uses it.
        has_alpha = image.mode in ("RGBA", "LA", "P") and "transparency" in image.info
        image = image.convert("RGBA" if has_alpha else "RGB")

        longest = max(image.size)
        if longest > MAX_EDGE:
            ratio = MAX_EDGE / longest
            image = image.resize(
                (round(image.width * ratio), round(image.height * ratio)),
                Image.LANCZOS,
            )

        buffer = io.BytesIO()
        image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=6)
        encoded = buffer.getvalue()
        after = len(encoded)

        if after >= before * (1 - MIN_SAVING_RATIO):
            print(f"[{i:>3}] keep  {name[:52]:<52} {before/1024:>7.0f} KB (already lean)")
            after_total += before
            skipped += 1
            continue

        pct = (1 - after / before) * 100
        print(
            f"[{i:>3}] {'WRITE' if apply_changes else 'would'} {name[:52]:<52} "
            f"{before/1024:>7.0f} KB -> {after/1024:>6.0f} KB  (-{pct:.0f}%)"
        )

        if apply_changes:
            (backup_dir / name).write_bytes(raw)
            request(
                f"{base}/storage/v1/object/{BUCKET}/{name}",
                method="PUT",
                data=encoded,
                headers={
                    **auth,
                    "Content-Type": "image/webp",
                    "Cache-Control": "max-age=31536000",
                    "x-upsert": "true",
                },
            )

        after_total += after
        rewritten += 1

    print(
        f"\n{'rewritten' if apply_changes else 'would rewrite'}: {rewritten}   "
        f"already lean: {skipped}   unreadable: {failed}"
    )
    print(f"bucket: {before_total/1048576:.1f} MB -> {after_total/1048576:.1f} MB "
          f"(-{(1 - after_total/before_total)*100:.0f}%)")
    if not apply_changes:
        print("\nDry run — nothing changed. Re-run with --apply to write.")


if __name__ == "__main__":
    main()
