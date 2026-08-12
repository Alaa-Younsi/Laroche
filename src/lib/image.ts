const MAX_EDGE = 1400;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.82;

const SRCSET_WIDTHS = [400, 700, 1000, 1400];

/**
 * Unsplash serves any width via the `w` param (with auto=format → AVIF/WebP),
 * so a srcset costs nothing and lets small viewports pull far lighter files
 * than the fixed editorial width. Non-Unsplash URLs get no srcset.
 */
export function unsplashSrcSet(src: string): string | undefined {
  if (!src.startsWith("https://images.unsplash.com/")) return undefined;
  const url = new URL(src);
  const baseWidth = Number(url.searchParams.get("w"));
  if (!baseWidth) return undefined;
  const widths = SRCSET_WIDTHS.filter((w) => w <= baseWidth * 2);
  if (!widths.includes(baseWidth)) widths.push(baseWidth);
  return widths
    .sort((a, b) => a - b)
    .map((w) => {
      const u = new URL(src);
      u.searchParams.set("w", String(w));
      return `${u.toString()} ${w}w`;
    })
    .join(", ");
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * canvas.toBlob does NOT fail when it can't encode the requested type — the
 * spec makes it silently produce PNG instead. Safari did exactly that for
 * image/webp until 17, so uploads from the client's iPhone were 1400px lossless
 * PNGs stored under a .webp name with a webp content-type: ~10x the bytes, and
 * invisible because PNG decodes fine in every browser.
 *
 * Returning null unless the blob is really the type we asked for lets the
 * caller fall through to the next candidate instead of shipping that.
 */
async function encodeAs(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
  return blob && blob.type === type ? blob : null;
}

// JPEG has no alpha channel — flattening a transparent PNG onto it turns the
// transparent pixels black. Only worth checking when the source could have
// alpha at all.
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    // WebP first; JPEG is the fallback every engine can encode, and unlike the
    // browser's own PNG fallback it actually shrinks a photo.
    let blob = await encodeAs(canvas, "image/webp", WEBP_QUALITY);
    if (!blob && !hasTransparency(ctx, width, height)) {
      blob = await encodeAs(canvas, "image/jpeg", JPEG_QUALITY);
    }
    if (!blob || blob.size >= file.size) return file;

    // Name and type from what was actually encoded, never from what was asked.
    const extension = EXTENSION_BY_TYPE[blob.type];
    if (!extension) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + "." + extension;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}
