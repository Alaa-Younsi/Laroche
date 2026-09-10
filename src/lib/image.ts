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

// ---- Supabase Storage responsive delivery ---------------------------------
//
// Every product photo used to be served at its stored size no matter how small
// it rendered: a card in a 3-column grid is ~350 CSS px but was pulling the
// full 1024–1400px file. That is what burns the Supabase egress allowance,
// because egress is billed on bytes SENT, not on bytes stored.
//
// Supabase's render/image endpoint resizes on the fly and negotiates WebP from
// the Accept header. Measured on this project's own bucket:
//   1024x1024 PNG   627 KB  ->  4 KB at 400px
//   2190x2920 JPEG  750 KB  -> 16 KB at 400px, 41 KB at 800px
//
// ⚠ `resize=contain` is NOT optional. With `width` alone the endpoint returns
// the requested width at the ORIGINAL height (400x2920 for that second file) —
// a silently squashed image that still costs 38 KB.

const SUPABASE_PUBLIC_MARKER = "/storage/v1/object/public/";
const SUPABASE_RENDER_MARKER = "/storage/v1/render/image/public/";

/** Widths capped at MAX_EDGE — the stored originals are never larger, and
 *  asking for more just re-encodes an upscale. */
const STORAGE_SRCSET_WIDTHS = [200, 400, 600, 900, 1400];

// Quality is tiered by width, not flat. The 200/400px variants are Shop-grid
// cards and thumbnails: ~100 of them per page load (the bulk of egress volume)
// and far too small to show facet/chain detail, so they stay aggressively
// compressed. The 600px+ variants are the product gallery, its zoom, and the
// parallax blocks — one per product-page view, not per visit, and the place a
// jewellery photo has to hold up. Supabase's own default quality is 80.
const STORAGE_QUALITY_SMALL = 72;
const STORAGE_QUALITY_LARGE = 82;
const STORAGE_QUALITY_BREAKPOINT = 500;

function storageQuality(width: number): number {
  return width <= STORAGE_QUALITY_BREAKPOINT ? STORAGE_QUALITY_SMALL : STORAGE_QUALITY_LARGE;
}

export function isSupabaseStorageUrl(src: string): boolean {
  return src.includes(SUPABASE_PUBLIC_MARKER);
}

/** One resized variant of a public Storage object. */
export function supabaseRenderUrl(
  src: string,
  width: number,
  quality: number = storageQuality(width),
): string {
  const base = src.replace(SUPABASE_PUBLIC_MARKER, SUPABASE_RENDER_MARKER);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}width=${width}&resize=contain&quality=${quality}`;
}

export function supabaseSrcSet(src: string): string | undefined {
  if (!isSupabaseStorageUrl(src)) return undefined;
  return STORAGE_SRCSET_WIDTHS.map((w) => `${supabaseRenderUrl(src, w)} ${w}w`).join(", ");
}

/** srcset for whichever host this image lives on, or undefined for neither. */
export function responsiveSrcSet(src: string): string | undefined {
  return unsplashSrcSet(src) ?? supabaseSrcSet(src);
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
