// Product-video handling: validating/normalizing links so the storefront's
// bare <video> tag (see ProductVideo in Product.tsx) can actually play them,
// and compressing uploaded files client-side before they reach Supabase
// Storage — the same job compressImage() does for photos (src/lib/image.ts),
// but video has no canvas-based shortcut, so this drives ffmpeg compiled to
// WebAssembly instead.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Why the storefront can only take a direct media file, never a share link:
// a bare <video> tag fetches its `src` as a byte stream and expects it to BE
// the video. A share link to a social post (facebook.com/reel/…, a YouTube
// watch page, an Instagram permalink) is an HTML document — the tag loads
// nothing and the shopper is left staring at a dead poster frame. The only
// way to actually play one of those is to embed the platform's own player
// (an iframe), and that player ships its own controls/branding and refuses
// silent, hands-off, forced looping — exactly what this site requires (no
// controls, no sound, never stoppable). So the only link that can ever work
// here is one that resolves straight to a video file, whatever host serves
// it — this is checked before anything is rendered, in the storefront and
// again in the admin form where the mistake is actually made.
const PLAYABLE_EXTENSIONS = [".mp4", ".webm", ".ogv", ".ogg", ".mov", ".m4v"];

/**
 * Rewrites known share-link wrappers to the direct file URL behind them.
 * Dropbox's share link (`?dl=0`) serves an HTML preview page; `dl=1` serves
 * the file itself with its original extension intact, which is all
 * `isPlayableVideoUrl` needs — so a Dropbox link pasted as-is now works
 * instead of being rejected.
 *
 * Google Drive has an analogous trick (`uc?export=download`), but it drops
 * the extension and interstitials any file past ~25 MB ("Google Drive can't
 * scan this file for viruses") — not reliable enough for a product clip, so
 * it isn't attempted here. A Drive link still has to be downloaded and
 * uploaded as a file.
 */
export function normalizeVideoUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (/(^|\.)dropbox\.com$/.test(parsed.hostname)) {
      parsed.searchParams.set("dl", "1");
      return parsed.toString();
    }
    return trimmed;
  } catch {
    // Not an absolute URL (or not a URL at all) — let isPlayableVideoUrl's
    // own parse attempt reject it with the same message either way.
    return trimmed;
  }
}

export function isPlayableVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let pathname: string;
  try {
    // Relative URLs are fine too — they resolve against the current origin.
    pathname = new URL(normalizeVideoUrl(url), window.location.origin).pathname.toLowerCase();
  } catch {
    return false;
  }
  return PLAYABLE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

// ---- Client-side compression ----------------------------------------------

// Pinned to one specific single-threaded core build: it needs no
// cross-origin-isolation headers (unlike ffmpeg's multi-threaded core, which
// this project's Vercel deployment doesn't set up), and pinning means a CDN
// update can never silently change transcoding behavior under a future
// upload. Loaded from unpkg on first use only — this cost never reaches the
// storefront, just the admin's browser when they pick a video file.
const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

// Above this, in-browser transcoding is more likely to stall the tab or run
// the wasm build out of memory than to finish in a reasonable time — the
// admin is better served by an uncompressed upload than a frozen page.
export const MAX_COMPRESSIBLE_BYTES = 300 * 1024 * 1024; // 300 MB

// Nothing on the product page renders a clip wider than ~700 CSS px (the
// gallery column it sits under, see image.ts's own MAX_EDGE note) — 1080 on
// the long edge leaves headroom for high-DPI screens without shipping pixels
// no shopper can see.
const MAX_EDGE = 1080;
const CRF = 27;

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })().catch((err) => {
      // A failed load must not wedge every later attempt behind the same
      // rejected promise — let the next call retry from scratch.
      ffmpegPromise = null;
      throw err;
    });
  }
  return ffmpegPromise;
}

function extensionOf(name: string): string {
  return /\.[^./]+$/.exec(name)?.[0] ?? ".mp4";
}

/**
 * Re-encodes a product clip to a small, web-ready MP4. Mirrors compressImage
 * in spirit — best-effort, always returns something the caller can upload —
 * but needs an actual transcoder rather than a canvas: capped at MAX_EDGE on
 * the long edge, CRF-compressed H.264, and the audio track dropped entirely,
 * because the storefront (ProductVideo in Product.tsx) never plays a product
 * video with sound — keeping that track would only spend bytes on something
 * no shopper will ever hear.
 *
 * Falls back to the original file whenever compression can't run or would
 * not have helped (oversized input, a codec ffmpeg.wasm can't decode, or a
 * "compressed" result that came out no smaller) — it never blocks the
 * upload on it.
 */
export async function compressVideo(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  if (file.size > MAX_COMPRESSIBLE_BYTES) return file;

  let ffmpeg: FFmpeg;
  try {
    ffmpeg = await loadFFmpeg();
  } catch {
    return file;
  }

  const inputName = `in-${crypto.randomUUID()}${extensionOf(file.name)}`;
  const outputName = `out-${crypto.randomUUID()}.mp4`;
  const onFFmpegProgress = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  ffmpeg.on("progress", onFFmpegProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    const exitCode = await ffmpeg.exec([
      "-i",
      inputName,
      // Scale so the LONGER edge is capped at MAX_EDGE regardless of
      // orientation, preserving aspect ratio; -2 rounds the other edge to
      // the nearest even number, which yuv420p requires.
      "-vf",
      `scale='if(gt(iw,ih),min(${MAX_EDGE},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_EDGE},ih))'`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      String(CRF),
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      outputName,
    ]);
    if (exitCode !== 0) return file;

    const data = await ffmpeg.readFile(outputName);
    // readFile is typed as Uint8Array<ArrayBufferLike>; Blob wants a view over a
    // plain ArrayBuffer, so copy the bytes into one rather than cast.
    const bytes = new Uint8Array(data as Uint8Array);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "video/mp4" });
    if (blob.size === 0 || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".mp4";
    return new File([blob], name, { type: "video/mp4" });
  } catch {
    return file;
  } finally {
    ffmpeg.off("progress", onFFmpegProgress);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
