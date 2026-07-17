declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

interface PixelParams {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  contents?: { id: string; quantity: number }[];
  num_items?: number;
  [key: string]: unknown;
}

function hasValidValue(params?: PixelParams): boolean {
  if (!params || !("value" in params)) return true;
  const value = params.value;
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function track(event: string, params?: PixelParams): void {
  if (!hasValidValue(params)) {
    if (import.meta.env.DEV) {
      console.warn(`[pixel] skipped "${event}" — invalid value`, params);
    }
    return;
  }
  window.fbq?.("track", event, params);
}

export function trackPageView(): void {
  window.fbq?.("track", "PageView");
  window.gtag?.("event", "page_view");
}

export function trackViewContent(params: PixelParams): void {
  track("ViewContent", params);
}

export function trackAddToCart(params: PixelParams): void {
  track("AddToCart", params);
}

export function trackInitiateCheckout(params: PixelParams): void {
  track("InitiateCheckout", params);
}

export function trackPurchase(params: PixelParams): void {
  track("Purchase", params);
}

export {};
