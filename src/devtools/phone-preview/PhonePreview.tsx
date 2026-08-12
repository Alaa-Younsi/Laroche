import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Maximize2, RotateCw, X } from "lucide-react";
import { DEVICES, FRAME_NAME, FRAME_TITLE, IN_PHONE_FRAME, usePhonePreview } from "./state";
import type { DeviceKey } from "./state";

/**
 * TEMPORARY — recording rig. See ./README.md for how to delete it.
 *
 * Puts the real site inside a phone on a desktop screen, at the real device's
 * real CSS size, so it can be screen-recorded without a phone in shot.
 *
 * It is an <iframe>, and that is the entire trick. Scaling a <div> down to
 * 393px would have got the desktop layout drawn small: `@media (max-width:
 * 767px)` resolves against the window, `100vh` resolves against the window,
 * `position: fixed` escapes to the window, and `useMediaFlags` asks the window
 * whether it is a phone. An iframe IS a window — so every one of those answers
 * the way it would on the device, and what gets recorded is the mobile site
 * rather than an impression of it.
 *
 * The outer app is unmounted while the preview is up, not hidden: two live
 * copies of a page mean two of everything expensive it runs (a WebGL canvas, a
 * video, a scroll engine) competing with the copy being filmed.
 */
export function PhonePreview({ children }: { children: ReactNode }) {
  const on = usePhonePreview((s) => s.on);

  // inside the glass we are simply the site — never nest a second rig
  if (IN_PHONE_FRAME) return <>{children}</>;
  if (!on) return <>{children}</>;
  return <PhoneStage />;
}

function PhoneStage() {
  const device = usePhonePreview((s) => s.device);
  const setDevice = usePhonePreview((s) => s.setDevice);
  const close = usePhonePreview((s) => s.close);
  const spec = DEVICES[device];

  const [landscape, setLandscape] = useState(false);
  const width = landscape ? spec.height : spec.width;
  const height = landscape ? spec.width : spec.height;

  /*
    The iframe opens on whatever page the desktop was showing, so toggling from
    /boutique previews /boutique. Captured once, on mount: making it follow the
    outer location afterwards would reload the frame — and losing the shot to a
    reload is worse than the frame being one route stale, which it cannot be,
    because the outer app is not mounted to navigate.
  */
  const [initialPath] = useState(() => window.location.pathname + window.location.search);

  /*
    Fit the phone to the window without touching its viewport: the transform
    scales the rendered pixels, and the iframe's own CSS width stays 393.

    Measured off the stage element with a ResizeObserver rather than computed
    from `window.innerHeight`, because the stage is the box the phone actually
    has to fit inside and the window is only sometimes the same thing — it is
    not in fullscreen, and it is not once the browser's own chrome changes
    height. A guessed margin got this wrong and the phone ran off the bottom of
    the screen, losing the home indicator and the lower bezel from the shot.
  */
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const BEZEL = 13;
  /** the lane the control rail lives in, kept clear of the phone — see fit() */
  const RAIL = 92;
  const bodyW = width + BEZEL * 2;
  const bodyH = height + BEZEL * 2;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      /*
        Barely any vertical margin: this is a recording, and every pixel not
        spent on the phone is a pixel of empty backdrop to crop out later.

        Horizontally, the controls' lane is reserved on BOTH sides, because the
        phone is centred and only a symmetric reserve keeps it clear of a rail
        pinned to one edge. It is free in practice — a phone is ~430 px wide in
        a window that is thousands, so the height term wins every time — and it
        means the rail can never end up over the screen even in a narrow window.
      */
      const room = 24;
      const next = Math.min(
        (stage.clientHeight - room) / bodyH,
        (stage.clientWidth - room - RAIL * 2) / bodyW,
        2,
      );
      if (next > 0) setScale(next);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [bodyW, bodyH]);

  /*
    The biggest the phone can get on a given monitor is the browser without its
    chrome — worth ~15% on a 1080p screen, and it also removes the tab strip
    and the address bar from anything captured with a window recorder.
  */
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen().catch(() => {});
  }, []);

  /*
    How much of the screen the OS keeps for itself. Landscape gives it all
    back except the home indicator, which is what a phone actually does.
  */
  const statusBar = landscape ? 0 : spec.notch === "island" ? 54 : spec.notch === "punch" ? 40 : 22;
  const homeBar = spec.notch === "none" ? 0 : landscape ? 16 : 24;

  /*
    The safe-area strips are painted in the site's own colours, read out of the
    frame rather than hardcoded — the theme toggle is INSIDE the preview, and a
    status bar still glowing white above a dark page is the one thing that
    would give away that this is not a phone. Same origin, so the document is
    simply readable; a MutationObserver on `data-theme` catches the toggle.
    The initial pair below is only the pre-load fallback: this project's
    default (dark) `--c-bg` / `--c-ink`, so the first frame is not wrong.
  */
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<MutationObserver>(undefined);
  const [chrome, setChrome] = useState({ background: "rgb(13 13 13)", color: "rgb(244 244 245)" });

  const readChrome = useCallback(() => {
    const body = frameRef.current?.contentDocument?.body;
    if (!body) return;
    const style = getComputedStyle(body);
    setChrome({ background: style.backgroundColor, color: style.color });
  }, []);

  const handleFrameLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    readChrome();
    // `load` can beat the stylesheet in dev, where it is injected by the
    // bundle rather than linked — one late re-read costs nothing and covers it
    setTimeout(readChrome, 400);
    observerRef.current?.disconnect();
    const observer = new MutationObserver(readChrome);
    observer.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    observerRef.current = observer;
  }, [readChrome]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  /*
    The stage is the only thing mounted, so the outer document has nothing to
    scroll — but `scrollbar-gutter: stable` (if the project sets it in
    src/index.css) still reserves the lane, and a `fixed inset-0` element does
    not cover it. That left a strip of the site's page background down the edge
    of an otherwise black backdrop, in shot. Reclaim it while the preview is up.
  */
  useEffect(() => {
    const root = document.documentElement;
    const previous = [root.style.overflow, root.style.scrollbarGutter] as const;
    root.style.overflow = "hidden";
    root.style.scrollbarGutter = "auto";
    return () => {
      root.style.overflow = previous[0];
      root.style.scrollbarGutter = previous[1];
    };
  }, []);

  // Esc leaves — the exit chip is the obvious way out, this is the one that
  // works when the chip has faded itself out to stay off camera.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // in fullscreen, Escape belongs to the browser — leaving fullscreen and
      // leaving the preview in one keypress is one press too many
      if (event.key === "Escape" && !document.fullscreenElement) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const controls = useIdleHidden();

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, #241a12 0%, #14100c 45%, #0b0907 100%)",
      }}
    >
      {/*
        Two boxes, and they have to be two. A transform scales what is PAINTED
        and leaves the layout box its original size, so centring a scaled phone
        centres the box it used to occupy — which is how a phone that had been
        scaled to fit still hung off the bottom of the screen. The outer div is
        given the scaled dimensions so the layout box and the visible phone are
        the same rectangle, and `top left` makes the inner one grow from that
        box's corner instead of its middle.
      */}
      <div style={{ width: bodyW * scale, height: bodyH * scale }}>
        <div
          className="relative"
          style={{
            width: bodyW,
            height: bodyH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            padding: BEZEL,
            borderRadius: spec.radius + BEZEL,
            // brushed-titanium rail: a flat black rectangle reads as a mockup,
            // the two-stop gradient plus an inner hairline reads as a phone
            background: "linear-gradient(150deg, #55504b 0%, #1b1917 26%, #100f0e 62%, #45403b 100%)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.10) inset, 0 2px 1px rgba(255,255,255,0.16) inset, 0 40px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.6)",
          }}
        >
          {/* volume + wake, on the rail rather than drawn on the glass */}
          <SideButton side="start" top={112} length={26} />
          <SideButton side="start" top={158} length={48} />
          <SideButton side="start" top={218} length={48} />
          <SideButton side="end" top={176} length={74} />

          <div
            className="relative overflow-hidden bg-black"
            style={{ width, height, borderRadius: spec.radius }}
          >
            {/*
              Safe areas, exactly as iOS gives them to a full-screen web app —
              and the reason they are here rather than an island floating over
              the glass. Overlaid, the pill sat squarely on top of the header's
              language chip: the first thing in the video was a control with a
              black lozenge through it. Reserving the strip instead puts the
              status bar where a phone puts it, gives the page the shorter
              viewport it would really get, and leaves every pixel of the site
              visible. `chrome` paints them in the site's OWN colours, read
              live out of the frame, so the phone still reads as one device
              after the theme is toggled inside it.
            */}
            {statusBar > 0 && (
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-7 text-[13px] font-semibold"
                style={{ height: statusBar, background: chrome.background, color: chrome.color }}
              >
                <span>9:41</span>
                <span className="flex items-center gap-1.5 opacity-90">
                  <Bars />
                  <Battery />
                </span>
              </div>
            )}

            <iframe
              // the frame's identity, read back by state.ts inside the app
              name={FRAME_NAME}
              ref={frameRef}
              title={FRAME_TITLE}
              src={initialPath}
              width={width}
              height={height - statusBar - homeBar}
              // a hero/product video that autoplays muted needs this, or the
              // frame records a poster where the site shows a video
              allow="autoplay; fullscreen"
              onLoad={handleFrameLoad}
              style={{
                width,
                height: height - statusBar - homeBar,
                marginTop: statusBar,
                border: 0,
                display: "block",
              }}
            />

            {homeBar > 0 && (
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-[7px]"
                style={{ height: homeBar, background: chrome.background }}
              >
                <span
                  className="h-[5px] w-[36%] rounded-full"
                  style={{ background: chrome.color, opacity: 0.55 }}
                />
              </div>
            )}

            {!landscape && spec.notch === "island" && (
              <span
                aria-hidden
                className="pointer-events-none absolute start-1/2 top-[11px] z-20 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"
              />
            )}
            {!landscape && spec.notch === "punch" && (
              <span
                aria-hidden
                className="pointer-events-none absolute start-1/2 top-[13px] z-20 h-[11px] w-[11px] -translate-x-1/2 rounded-full bg-black"
              />
            )}

            {/* the sheen a real screen has under room light — kept faint so it
                does not sit on top of the thing being filmed */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 z-30"
              style={{
                borderRadius: spec.radius,
                background:
                  "linear-gradient(128deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 34%)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.07) inset",
              }}
            />
          </div>
        </div>
      </div>

      {/*
        The rig's own controls, which must not end up in the video.

        A rail down the side rather than a bar across the bottom, because the
        bar sat ON the phone: the stage is centred, the phone is as tall as the
        window allows, and there is simply no empty height under it to put
        anything in — but there are hundreds of pixels of unused width either
        side. Off the screen entirely beats translucent-over-the-screen, since
        the point of the preview is to see the whole phone.

        They still fade out after a few idle seconds and return on the first
        mouse move, so a recording longer than that catches only the phone.
      */}
      <div
        className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 transition-opacity duration-500"
        style={{ opacity: controls ? 1 : 0 }}
      >
        <div className="pointer-events-auto flex w-[72px] flex-col items-stretch gap-0.5 rounded-2xl border border-white/10 bg-black/70 p-1.5 text-[11px] text-white/70 backdrop-blur">
          {(Object.keys(DEVICES) as DeviceKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              title={DEVICES[key].label}
              className={`cursor-pointer rounded-lg px-1 py-1.5 text-center leading-tight transition-colors ${
                key === device ? "bg-white/15 text-white" : "hover:text-white"
              }`}
            >
              {DEVICES[key].short}
            </button>
          ))}
          <span className="mx-1 my-1 h-px bg-white/15" />
          <div className="flex justify-around">
            <button
              onClick={() => setLandscape((v) => !v)}
              title="Rotate"
              className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCw size={13} />
            </button>
            <button
              onClick={toggleFullscreen}
              title="Fullscreen — the biggest the phone gets"
              className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={close}
              title="Exit phone preview (Esc)"
              className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
  Signal and battery, drawn in currentColor so they inherit whatever the page's
  ink is. Cheap, and their absence is conspicuous: a status bar with a clock and
  nothing on the right reads as a mock-up of a phone rather than a phone.
*/
function Bars() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 4.4} y={8 - i * 2.4} width="3" height={3 + i * 2.4} rx="0.8" />
      ))}
    </svg>
  );
}

function Battery() {
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
      <rect
        x="0.6"
        y="0.6"
        width="21"
        height="10.8"
        rx="3"
        stroke="currentColor"
        strokeOpacity="0.45"
      />
      <rect x="2.4" y="2.4" width="16" height="7.2" rx="1.7" fill="currentColor" />
      <path d="M23 4.2v3.6a2 2 0 0 0 0-3.6Z" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}

/** A side button on the rail. Cosmetic — it is the silhouette that sells it. */
function SideButton({ side, top, length }: { side: "start" | "end"; top: number; length: number }) {
  return (
    <span
      aria-hidden
      className="absolute w-[3px] rounded-full"
      style={{
        top,
        height: length,
        [side === "start" ? "left" : "right"]: -2,
        background:
          side === "start"
            ? "linear-gradient(90deg,#6a635c,#2a2725)"
            : "linear-gradient(270deg,#6a635c,#2a2725)",
      }}
    />
  );
}

/** True while the pointer has moved recently; false after a few still seconds. */
function useIdleHidden(delay = 2600): boolean {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const bump = useCallback(() => {
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), delay);
  }, [delay]);

  useEffect(() => {
    // the controls start visible, so mount only has to start the clock —
    // calling bump() here would be a setState to the value already held
    timer.current = setTimeout(() => setVisible(false), delay);
    window.addEventListener("mousemove", bump);
    return () => {
      window.removeEventListener("mousemove", bump);
      clearTimeout(timer.current);
    };
  }, [bump, delay]);

  return visible;
}
