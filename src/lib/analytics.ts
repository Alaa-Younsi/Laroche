// Injects Meta Pixel / GA4 only when their IDs are configured — pixel.ts
// calls window.fbq / window.gtag optionally, so with no IDs everything no-ops.
// The canonical vendor snippets are used verbatim (as inline scripts) because
// both libraries require the queue stub to push the literal `arguments`
// object — hand-rolled rest-param stubs silently drop events.

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

function inject(js: string) {
  const script = document.createElement("script");
  script.textContent = js;
  document.head.appendChild(script);
}

function loadMetaPixel(id: string) {
  if (!/^\d+$/.test(id)) return;
  inject(
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`,
  );
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
  if (PIXEL_ID) loadMetaPixel(PIXEL_ID);
  if (GA_ID) loadGa4(GA_ID);
}
