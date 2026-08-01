// Injects GA4 only when its ID is configured. Everything no-ops without it.
// The canonical vendor snippet is used verbatim (as an inline script) because
// the library requires the queue stub to push the literal `arguments` object —
// a hand-rolled rest-param stub silently drops events.
//
// The Meta Pixel is NOT loaded here any more: pixels are managed in
// /admin/pixels and loaded from the database at runtime (src/lib/metaPixel.ts +
// src/components/MetaPixelProvider.tsx), so the owner can run several campaign
// pixels with different targeting without a redeploy.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

function inject(js: string) {
  const script = document.createElement("script");
  script.textContent = js;
  document.head.appendChild(script);
}

function loadGa4(id: string) {
  if (!/^[A-Za-z0-9-]+$/.test(id)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  inject(
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${id}',{send_page_view:false});`,
  );
}

export function initAnalytics(): void {
  if (import.meta.env.DEV) return;
  if (GA_ID) loadGa4(GA_ID);
}

export function trackGaPageView(): void {
  window.gtag?.("event", "page_view");
}
