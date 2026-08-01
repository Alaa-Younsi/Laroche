import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useActivePixels } from "@/hooks/useMetaPixels";
import { initPixels, matchPixels, trackEvent, type PixelParams } from "@/lib/metaPixel";
import type { PixelEventKey } from "@/types/db";

// DB-driven multi-pixel layer. Sits inside <BrowserRouter> and outside the
// pages, so every route can report events through usePixel() without knowing
// which pixels exist.

interface PixelApi {
  /** Send an event to every pixel whose scope matches the current route. */
  track: (key: PixelEventKey, params?: PixelParams, eventId?: string) => void;
  /** A route declaring what it is (product slug, landing slug, forced pixels). */
  setContext: (next: {
    productSlug?: string | null;
    landingSlug?: string | null;
    extraPixelIds?: string[];
  }) => void;
}

const NO_IDS: string[] = [];

const PixelApiContext = createContext<PixelApi>({
  track: () => undefined,
  setContext: () => undefined,
});

export function usePixel(): PixelApi {
  return useContext(PixelApiContext);
}

interface RouteState {
  path: string;
  productSlug: string | null;
  landingSlug: string | null;
  extraPixelIds: string[];
}

interface QueuedEvent {
  key: PixelEventKey;
  params?: PixelParams;
  eventId?: string;
  ctx: { pathname: string; productSlug: string | null; landingSlug: string | null; extraPixelIds: string[] };
}

const MAX_QUEUED = 20;

export function MetaPixelProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Firing conversions while the owner clicks around their own dashboard
  // poisons every campaign's data with staff traffic.
  const isAdmin = pathname.startsWith("/admin");

  const { data, isFetched } = useActivePixels();
  const pixels = useMemo(() => data ?? [], [data]);

  const [route, setRoute] = useState<RouteState>({
    path: pathname,
    productSlug: null,
    landingSlug: null,
    extraPixelIds: NO_IDS,
  });

  // The route context carries the path it was set for, so a stale slug left by
  // the previous route is ignored by comparison instead of needing a reset
  // effect — a reset effect would run AFTER the new page's own effects (React
  // runs child effects first) and wipe the slug it had just registered.
  const current: RouteState =
    route.path === pathname
      ? route
      : { path: pathname, productSlug: null, landingSlug: null, extraPixelIds: NO_IDS };

  const ctx = useMemo(
    () => ({
      pathname,
      productSlug: current.productSlug,
      landingSlug: current.landingSlug,
      extraPixelIds: current.extraPixelIds,
    }),
    [pathname, current.productSlug, current.landingSlug, current.extraPixelIds],
  );

  const active = useMemo(
    () => (isAdmin ? [] : matchPixels(pixels, ctx)),
    [isAdmin, pixels, ctx],
  );

  // Refs mirror render state so `track` keeps ONE identity for the life of the
  // provider. Without that it gets a new identity every time the matched pixel
  // set widens, and any effect listing it as a dependency re-fires.
  const pixelsRef = useRef(pixels);
  pixelsRef.current = pixels;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  const readyRef = useRef(false);
  const queueRef = useRef<QueuedEvent[]>([]);

  // Pixel config arrives from Supabase a moment after the first render, so an
  // event fired on mount (ViewContent, a fast InitiateCheckout) would otherwise
  // be sent to an empty pixel list and lost. Queue until the config lands.
  useEffect(() => {
    if (isAdmin || !isFetched) return;
    initPixels(active);
    readyRef.current = true;

    const queued = queueRef.current;
    if (queued.length === 0) return;
    queueRef.current = [];
    for (const item of queued) {
      const matched = matchPixels(pixelsRef.current, item.ctx);
      initPixels(matched);
      trackEvent(matched, item.key, item.params, item.eventId);
    }
  }, [active, isAdmin, isFetched]);

  // PageView bookkeeping is per (path, pixel id), not per path: a product page
  // registers its slug one render AFTER it mounts, which widens the matched set.
  // A plain "already sent for this path" flag either double-fires the first
  // batch or never fires the newly-matched pixels.
  const sentPageView = useRef<{ path: string; ids: Set<string> }>({ path: "", ids: new Set() });

  useEffect(() => {
    if (isAdmin || active.length === 0) return;
    if (sentPageView.current.path !== pathname) {
      sentPageView.current = { path: pathname, ids: new Set() };
    }
    const fresh = active.filter((p) => !sentPageView.current.ids.has(p.pixel_id));
    if (fresh.length === 0) return;
    for (const p of fresh) sentPageView.current.ids.add(p.pixel_id);
    initPixels(fresh);
    trackEvent(fresh, "page_view");
  }, [active, isAdmin, pathname]);

  const track = useCallback<PixelApi["track"]>((key, params, eventId) => {
    if (isAdminRef.current) return;
    if (!readyRef.current) {
      if (queueRef.current.length < MAX_QUEUED) {
        queueRef.current.push({ key, params, eventId, ctx: ctxRef.current });
      }
      return;
    }
    const matched = matchPixels(pixelsRef.current, ctxRef.current);
    initPixels(matched);
    trackEvent(matched, key, params, eventId);
  }, []);

  // Routes call this from an effect whose deps are recreated each render, so it
  // MUST bail out when nothing changed or it is an infinite re-render loop.
  const setContext = useCallback<PixelApi["setContext"]>((next) => {
    const path = window.location.pathname;
    const productSlug = next.productSlug ?? null;
    const landingSlug = next.landingSlug ?? null;
    const extraPixelIds = next.extraPixelIds ?? NO_IDS;

    // Apply to the ref immediately, not just to state: a page registers its slug
    // and fires ViewContent in the SAME commit, and a state update would not be
    // visible until the next render — the event would then be matched against a
    // context with no slug and miss every product-scoped pixel.
    ctxRef.current = { pathname: path, productSlug, landingSlug, extraPixelIds };

    setRoute((prev) => {
      if (
        prev.path === path &&
        prev.productSlug === productSlug &&
        prev.landingSlug === landingSlug &&
        prev.extraPixelIds.join("|") === extraPixelIds.join("|")
      ) {
        return prev;
      }
      return { path, productSlug, landingSlug, extraPixelIds };
    });
  }, []);

  const api = useMemo<PixelApi>(() => ({ track, setContext }), [track, setContext]);

  return <PixelApiContext.Provider value={api}>{children}</PixelApiContext.Provider>;
}
