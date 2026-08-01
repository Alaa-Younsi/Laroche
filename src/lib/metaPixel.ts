import type { MetaPixel, PixelEventKey } from "@/types/db";

// Meta Pixel runtime for the DB-driven multi-pixel setup (0017_meta_pixels.sql).
//
// Two rules shape everything here:
//
// 1. Every event goes through `trackSingle`, NEVER plain `track`. `track`
//    broadcasts to every initialised pixel, which files one campaign's
//    conversions into another campaign's pixel and makes both sets of numbers
//    wrong.
// 2. Which pixels are live is decided from the database (scope + match values),
//    never hardcoded.
//
// Nothing in this module throws, and everything returns early when `window` or
// `fbq` is missing: an ad blocker is the normal case for a real share of
// Algerian visitors and must never break the checkout.

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
  }
}

const FBEVENTS_SRC = "https://connect.facebook.net/en_US/fbevents.js";

export const EVENT_NAMES: Record<PixelEventKey, string> = {
  page_view: "PageView",
  view_content: "ViewContent",
  add_to_cart: "AddToCart",
  initiate_checkout: "InitiateCheckout",
  purchase: "Purchase",
  lead: "Lead",
  search: "Search",
};

export interface PixelParams {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  contents?: { id: string; quantity: number }[];
  num_items?: number;
  [key: string]: unknown;
}

export interface PixelContext {
  pathname: string;
  productSlug?: string | null;
  landingSlug?: string | null;
  /** pixels a page force-loads regardless of scope rules */
  extraPixelIds?: string[];
}

// --- loader ---------------------------------------------------------------

// Installs Meta's own stub (the queue that buffers calls made before the script
// finishes downloading) and appends the script tag exactly once.
function ensureFbq(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  if (!window.fbq) {
    const stub = function (this: unknown, ...args: unknown[]) {
      const self = stub as unknown as {
        callMethod?: (...a: unknown[]) => void;
        queue: unknown[];
      };
      if (self.callMethod) self.callMethod.apply(this, args);
      else self.queue.push(args);
    } as unknown as Window["fbq"] & { queue: unknown[]; push: unknown; version: string };

    stub.queue = [];
    stub.push = stub;
    stub.loaded = true;
    stub.version = "2.0";
    window.fbq = stub as Window["fbq"];
    window._fbq = window._fbq ?? stub;
  }

  if (!document.querySelector(`script[src="${FBEVENTS_SRC}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = FBEVENTS_SRC;
    document.head.appendChild(script);
  }

  return true;
}

// --- init -----------------------------------------------------------------

const initialised = new Set<string>();

/**
 * Initialises any pixel not yet initialised. Idempotent per pixel id: calling it
 * again on every route change would re-register the pixel and, on some versions,
 * re-fire an automatic PageView nobody asked for.
 */
export function initPixels(pixels: MetaPixel[]): void {
  if (pixels.length === 0) return;
  if (!ensureFbq()) return;
  const fbq = window.fbq;
  if (!fbq) return;

  const fresh = pixels.filter((p) => !initialised.has(p.pixel_id));
  if (fresh.length === 0) return;

  // The pixel's own automatic PageView ignores the per-pixel event toggles and
  // doubles up with the one the router sends.
  fbq("set", "autoConfig", false, "all");

  for (const pixel of fresh) {
    fbq("init", pixel.pixel_id);
    initialised.add(pixel.pixel_id);
  }
}

export function isInitialised(pixelId: string): boolean {
  return initialised.has(pixelId);
}

// --- targeting ------------------------------------------------------------

/**
 * The pixels that should receive events for the current context.
 *
 * An EMPTY `match_values` on a scoped pixel means "every page of that kind"
 * (one pixel covering all product pages) — not "no pages", which is the
 * intuitive-but-wrong reading that makes the row useless.
 */
export function matchPixels(pixels: MetaPixel[], ctx: PixelContext): MetaPixel[] {
  const extra = new Set(ctx.extraPixelIds ?? []);

  return pixels.filter((pixel) => {
    if (!pixel.active) return false;
    if (extra.has(pixel.id)) return true;

    switch (pixel.scope) {
      case "all":
        return true;
      case "paths":
        return (
          pixel.match_values.length === 0 ||
          pixel.match_values.some(
            (prefix) => ctx.pathname === prefix || ctx.pathname.startsWith(`${prefix}/`),
          )
        );
      case "products":
        if (!ctx.productSlug) return false;
        return pixel.match_values.length === 0 || pixel.match_values.includes(ctx.productSlug);
      case "landing":
        if (!ctx.landingSlug) return false;
        return pixel.match_values.length === 0 || pixel.match_values.includes(ctx.landingSlug);
      default:
        return false;
    }
  });
}

// --- events ---------------------------------------------------------------

// A value that resolves to undefined/NaN/0 (product data still loading, or a
// Postgres numeric arriving over PostgREST as a string) is still accepted by
// Meta as a "successful" event and silently corrupts ROAS reporting. Drop it
// here rather than at each call site.
function hasValidValue(params?: PixelParams): boolean {
  if (!params || !("value" in params)) return true;
  const value = params.value;
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function trackEvent(
  pixels: MetaPixel[],
  key: PixelEventKey,
  params?: PixelParams,
  eventId?: string,
): void {
  if (pixels.length === 0) return;
  if (typeof window === "undefined") return;
  const fbq = window.fbq;
  if (!fbq) return;

  if (!hasValidValue(params)) {
    if (import.meta.env.DEV) {
      console.warn(`[pixel] skipped "${key}" — invalid value`, params);
    }
    return;
  }

  for (const pixel of pixels) {
    if (pixel.events[key] === false) continue;
    if (!initialised.has(pixel.pixel_id)) continue;

    const payload: PixelParams | undefined = params
      ? { currency: pixel.currency, ...params }
      : undefined;

    // 4th arg is fbq's options object; `eventID` is Meta's dedup key, so the
    // same conversion later sent server-side collapses into one.
    const options: Record<string, string> = {};
    if (eventId) options.eventID = eventId;
    if (pixel.test_event_code) options.test_event_code = pixel.test_event_code;

    if (Object.keys(options).length > 0) {
      fbq("trackSingle", pixel.pixel_id, EVENT_NAMES[key], payload ?? {}, options);
    } else if (payload) {
      fbq("trackSingle", pixel.pixel_id, EVENT_NAMES[key], payload);
    } else {
      fbq("trackSingle", pixel.pixel_id, EVENT_NAMES[key]);
    }
  }
}
