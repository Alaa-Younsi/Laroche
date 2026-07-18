const MAX_EDGE = 1400;
const WEBP_QUALITY = 0.82;

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

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const webpName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], webpName, { type: "image/webp" });
  } catch {
    return file;
  }
}
