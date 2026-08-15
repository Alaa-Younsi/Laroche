import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { HERO_SLIDE_DURATION, HERO_SLIDES } from "@/lib/heroSlides";
import { cn } from "@/lib/utils";

/**
 * 3D coverflow hero carousel. Slide 0 is the original editorial photograph
 * (→ /boutique); the rest are the category posters, each linking to its own
 * filtered shop page.
 *
 * The stage is a real 3D scene: the neighbouring slides sit behind the active
 * one on the Z axis and are turned toward the centre, the whole rig tilts with
 * the pointer on desktop, and the gold stamp floats above the plane. Pauses on
 * hover/focus and while the tab is hidden; swipe, arrow keys, dots and the
 * side slides all navigate. Reduced-motion visitors get a flat crossfade with
 * no rotation, no parallax and no auto-advance surprises.
 */

/** Where a slide sits relative to the active one. Transform + opacity only:
 * both are composited on the GPU, so the stage stays smooth on phones. An
 * animated `filter: blur()` here looked good and cost ~15fps on mobile. */
const SIDE = { x: 68, z: -170, rotateY: 34, scale: 0.82, opacity: 0.4 };

const ARROW =
  "absolute top-1/2 z-40 -mt-5 flex h-10 w-10 items-center justify-center rounded-full border border-brand/40 text-brand transition-all duration-300 hover:scale-110 hover:bg-bg";

export function HeroCarousel() {
  const { lang } = useLanguage();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [canHover] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  // a swipe ends with a click event on the <Link>; this suppresses that one
  const swipedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const count = HERO_SLIDES.length;

  // pointer-driven tilt of the whole stage (desktop only)
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 150, damping: 20, mass: 0.6 };
  const tiltX = useSpring(useTransform(py, [0, 1], [7, -7]), spring);
  const tiltY = useSpring(useTransform(px, [0, 1], [-9, 9]), spring);
  // `rich` gates the effects that cost real frames on a phone GPU — the shine
  // sweep, the ken-burns zoom, the backdrop blurs and the full sparkle field.
  // Desktop keeps all of it; touch devices get the 3D stage without the paint.
  const rich = canHover && !reducedMotion;
  const tilting = rich;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // auto-advance — restarts from full duration on slide change or resume
  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setTimeout(next, HERO_SLIDE_DURATION);
    return () => window.clearTimeout(id);
  }, [count, next, paused]);

  // don't burn through the deck while the tab is in the background
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // warm the next poster so the transition never lands on a blank frame
  useEffect(() => {
    const upcoming = HERO_SLIDES[(index + 1) % count];
    const img = new Image();
    img.src = upcoming.src;
  }, [count, index]);

  // the three slides on stage: previous, active, next
  const visible = [-1, 0, 1].map((offset) => ({
    offset,
    slide: HERO_SLIDES[(((index + offset) % count) + count) % count],
  }));

  function targetFor(offset: number) {
    if (offset === 0 || reducedMotion) {
      return { x: "0%", z: 0, rotateY: 0, scale: 1, opacity: offset === 0 ? 1 : 0 };
    }
    return {
      x: `${offset * SIDE.x}%`,
      z: SIDE.z,
      // left slide turns its face toward the centre, right slide mirrors it
      rotateY: -offset * SIDE.rotateY,
      scale: SIDE.scale,
      opacity: SIDE.opacity,
    };
  }

  return (
    <div
      className="relative flex w-full flex-col items-center justify-center py-6 sm:py-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        px.set(0.5);
        py.set(0.5);
      }}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerMove={
        tilting
          ? (e) => {
              const rect = stageRef.current?.getBoundingClientRect();
              if (!rect) return;
              px.set((e.clientX - rect.left) / rect.width);
              py.set((e.clientY - rect.top) / rect.height);
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={lang === "ar" ? "تشكيلات لاروش" : "Collections Laroche"}
    >
      {/* glow + rotating gold orbit lines behind the stage */}
      <div className="pointer-events-none absolute aspect-square w-[112%] max-w-[34rem] rounded-full bg-radial-glow blur-2xl" />
      <div
        className={cn(
          "pointer-events-none absolute aspect-square w-[125%] max-w-[36rem] rounded-full border border-brand/25 [border-style:dashed]",
          !reducedMotion && "animate-spin-slow",
        )}
      />
      <div className="pointer-events-none absolute aspect-square w-[104%] max-w-[30rem] rounded-full border border-brand/15" />

      {/* ---------------------------- 3D stage ---------------------------- */}
      <motion.div
        ref={stageRef}
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        style={tilting ? { rotateX: tiltX, rotateY: tiltY } : undefined}
        className="relative w-[72vw] max-w-[19rem] [aspect-ratio:3/4] [perspective:1500px] [transform-style:preserve-3d] sm:w-[19rem] md:w-[20.5rem] lg:w-[22rem]"
        onTouchStart={(e) => {
          const touch = e.touches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          swipedRef.current = false;
        }}
        onTouchEnd={(e) => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          if (!start) return;
          const touch = e.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          // horizontal intent only — a vertical drag is the page scrolling
          if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
          swipedRef.current = true;
          if (dx < 0) next();
          else prev();
        }}
      >
        {visible.map(({ offset, slide }) => {
          const label = lang === "ar" ? slide.labelAr : slide.labelFr;
          const isActive = offset === 0;
          return (
            <motion.div
              key={slide.id}
              animate={targetFor(offset)}
              transition={{ duration: reducedMotion ? 0.35 : 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: "preserve-3d", zIndex: isActive ? 30 : 10 }}
              className={cn("absolute inset-0", isActive && "will-change-transform")}
              aria-hidden={!isActive}
            >
              {/* soft contact shadow grounding the card — active only: a blurred
                  layer inside a scaling element gets re-rastered every frame */}
              {isActive && (
                <div className="pointer-events-none absolute -bottom-5 left-1/2 h-8 w-[72%] -translate-x-1/2 rounded-[50%] bg-black/25 blur-xl" />
              )}

              <Link
                to={slide.to}
                aria-label={label}
                tabIndex={isActive ? 0 : -1}
                onClick={(e) => {
                  // a side slide brings itself to the front instead of navigating
                  if (!isActive) {
                    e.preventDefault();
                    go(index + offset);
                    return;
                  }
                  if (swipedRef.current) {
                    swipedRef.current = false;
                    e.preventDefault();
                  }
                }}
                className="fx-frame group relative block h-full w-full overflow-hidden border border-line bg-panel shadow-panel"
              >
                <SmartImage
                  src={slide.src}
                  alt={label}
                  width={slide.width}
                  height={slide.height}
                  loading={isActive ? "eager" : "lazy"}
                  fetchPriority={isActive ? "high" : undefined}
                  sizes="(max-width: 640px) 84vw, 25rem"
                  className={cn(
                    // object-bottom, not centre: the posters carry their caption
                    // and CTA across the bottom edge, and they are narrower than
                    // the 3:4 frame — a centred crop shaves the button off
                    "h-full w-full object-cover object-bottom transition-transform duration-700",
                    isActive && rich && "fx-kenburns group-hover:scale-105",
                  )}
                />

                {/* gold rim that lights up on the active card */}
                <span
                  className={cn(
                    "pointer-events-none absolute inset-0 border transition-colors duration-700",
                    isActive ? "border-brand/45" : "border-transparent",
                  )}
                />

                {/* slow diagonal shine pass across the active poster */}
                {isActive && rich && (
                  <motion.span
                    aria-hidden
                    initial={{ x: "-140%" }}
                    animate={{ x: "140%" }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatDelay: 3.4,
                      ease: "easeInOut",
                    }}
                    className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                )}

                {/* side slides sit behind a scrim so the active one reads first */}
                {!isActive && (
                  <span className="pointer-events-none absolute inset-0 bg-bg/35" />
                )}
              </Link>
            </motion.div>
          );
        })}

        {/* rotating circular stamp, floating above the plane in 3D */}
        <div
          style={{ transform: "translateZ(70px)" }}
          className={cn(
            "pointer-events-none absolute -top-5 end-[-1.5rem] z-40 flex h-16 w-16 items-center justify-center rounded-full border border-brand/40 sm:h-20 sm:w-20",
            rich ? "bg-bg/85 backdrop-blur-sm" : "bg-bg",
          )}
        >
          <svg
            viewBox="0 0 100 100"
            className={cn("h-14 w-14 sm:h-16 sm:w-16", !reducedMotion && "animate-spin-slow")}
          >
            <defs>
              <path id="hero-stamp" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
            </defs>
            <text className="fill-brand" fontSize="8.5" letterSpacing="3.2">
              <textPath href="#hero-stamp">ARGENT 925 • LAROCHE BIJOUX •</textPath>
            </text>
          </svg>
          <span className="absolute font-display text-base text-brand">✦</span>
        </div>

        {/* prev / next — physical left/right in both writing directions */}
        <button
          type="button"
          onClick={prev}
          aria-label={lang === "ar" ? "السابق" : "Précédent"}
          style={{ transform: "translateZ(70px)" }}
          className={cn(ARROW, "left-1", rich ? "bg-bg/75 backdrop-blur-sm" : "bg-bg/90")}
        >
          <ChevronLeft size={17} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={lang === "ar" ? "التالي" : "Suivant"}
          style={{ transform: "translateZ(70px)" }}
          className={cn(ARROW, "right-1", rich ? "bg-bg/75 backdrop-blur-sm" : "bg-bg/90")}
        >
          <ChevronRight size={17} strokeWidth={1.5} />
        </button>
      </motion.div>

      {/* dot rail */}
      <div className="relative z-40 mt-8 flex items-center justify-center gap-2">
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            aria-label={lang === "ar" ? s.labelAr : s.labelFr}
            aria-current={i === index}
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i === index ? "w-7 bg-brand" : "w-1.5 bg-line hover:bg-brand/50",
            )}
          />
        ))}
      </div>

      {/* sparkle field — thinned out on phones, each one is its own layer */}
      {!reducedMotion &&
        [...Array(rich ? 12 : 5)].map((_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute h-1 w-1 rounded-full bg-brand animate-sparkle"
            style={{
              top: `${8 + ((i * 37) % 80)}%`,
              left: `${4 + ((i * 53) % 92)}%`,
              animationDelay: `${i * 0.28}s`,
            }}
          />
        ))}
    </div>
  );
}
