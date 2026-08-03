import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // The browser restores the previous scroll offset by itself on history
    // navigations, asynchronously and after our reset — take that over.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    // behavior:"instant" is required, not cosmetic: `html` carries
    // scroll-behavior:smooth (for the in-page anchors and scrollToCheckout), so
    // a plain scrollTo(0, 0) animates instead of jumping. The route swap then
    // remounts the tree mid-animation and the scroll lands wherever the
    // interrupted tween stopped — which is how you end up halfway down a page
    // you just opened.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
