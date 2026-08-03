// The storefront plays product clips in a bare <video> tag, which can only
// read a direct media file. A share link to a social post (facebook.com/reel/…,
// a YouTube watch page, an Instagram permalink) is an HTML document: the tag
// loads nothing, and the shopper is left staring at a dead poster frame. So the
// URL is checked before anything is rendered, in the storefront and again in
// the admin form where the mistake is actually made.
const PLAYABLE_EXTENSIONS = [".mp4", ".webm", ".ogv", ".ogg", ".mov", ".m4v"];

export function isPlayableVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let pathname: string;
  try {
    // Relative URLs are fine too — they resolve against the current origin.
    pathname = new URL(url, window.location.origin).pathname.toLowerCase();
  } catch {
    return false;
  }
  return PLAYABLE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}
