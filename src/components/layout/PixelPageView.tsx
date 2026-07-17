import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/pixel";

export function PixelPageView() {
  const { pathname } = useLocation();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    const isFirstRender = prevPathname.current === null;
    prevPathname.current = pathname;
    if (isFirstRender || pathname.startsWith("/admin")) return;
    trackPageView();
  }, [pathname]);

  return null;
}
