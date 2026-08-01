import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackGaPageView } from "@/lib/analytics";

// GA4 route-change page views (Meta's are handled by MetaPixelProvider).
// Guarded with a value-compared ref rather than a boolean "first render" flag:
// React StrictMode double-invokes effects in dev, and only a "did I already
// track this exact value" comparison survives that.
export function GaPageView() {
  const { pathname } = useLocation();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    const isFirstRender = prevPathname.current === null;
    prevPathname.current = pathname;
    // gtag('config') already counted the initial load; /admin is staff traffic.
    if (isFirstRender || pathname.startsWith("/admin")) return;
    trackGaPageView();
  }, [pathname]);

  return null;
}
