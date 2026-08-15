import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { HERO_SLIDE_DURATION, HERO_SLIDES } from "@/lib/heroSlides";
import { cn } from "@/lib/utils";

/**
 * Auto-advancing hero carousel. Slide 0 is the original editorial photograph
 * (→ /boutique); the rest are the category posters, each linking to its own
 * filtered shop page. Framed by the rotating gold orbit line and the circular
 * brand stamp so the hero keeps the same signature as the rest of the site.
 *
 * Pauses on hover/focus and while the tab is hidden, supports swipe, arrow
 * keys and the dot rail, and falls back to a plain crossfade-free stack when
 * the visitor asks for reduced motion.
 */
export function HeroCarousel() {
  const { lang } = useLanguage();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  // a swipe ends with a click event on the <Link>; this suppresses that one
  const swipedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const count = HERO_SLIDES.length;

  const go = useCallback(
    (next: number, dir: number) => {
      setDirection(dir);
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const next = useCallback(() => go(index + 1, 1), [go, index]);
  const prev = useCallback(() => go(index - 1, -1), [go, index]);

  // auto-advance — restarts from full duration whenever the slide changes or
  // the carousel is resumed
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

  // warm the next poster so the crossfade never lands on a blank frame
  useEffect(() => {
    const upcoming = HERO_SLIDES[(index + 1) % count];
    const img = new Image();
    img.src = upcoming.src;
  }, [count, index]);

  const slide = HERO_SLIDES[index];
  const label = lang === "ar" ? slide.labelAr : slide.labelFr;

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={lang === "ar" ? "تشكيلات لاروش" : "Collections Laroche"}
    >
      {/* glow + rotating gold orbit line behind everything */}
      <div className="pointer-events-none absolute h-[70%] w-[70%] rounded-full bg-radial-glow blur-2xl" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[92%] w-[92%] max-w-[30rem] animate-spin-slow rounded-full border border-brand/25 [border-style:dashed]" />
        <div className="absolute h-[74%] w-[74%] max-w-[24rem] rounded-full border border-brand/15" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="fx-frame relative z-10 h-[80%] w-auto max-w-full [aspect-ratio:3/4]"
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
        <div className="relative h-full w-full overflow-hidden border border-line bg-panel">
          <AnimatePresence initial={false} custom={direction} mode="sync">
            <motion.div
              key={slide.id}
              custom={direction}
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: direction * 48, scale: 1.04 }
              }
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: direction * -48, scale: 1.02 }
              }
              transition={{ duration: reducedMotion ? 0.3 : 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Link
                to={slide.to}
                aria-label={label}
                onClick={(e) => {
                  if (swipedRef.current) {
                    swipedRef.current = false;
                    e.preventDefault();
                  }
                }}
                className="block h-full w-full"
              >
                <SmartImage
                  src={slide.src}
                  alt={label}
                  width={slide.width}
                  height={slide.height}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : undefined}
                  sizes="(max-width: 768px) 70vw, 24rem"
                  className={cn(
                    "h-full w-full object-cover",
                    !reducedMotion && "fx-kenburns",
                  )}
                />
              </Link>
            </motion.div>
          </AnimatePresence>

          {/* prev / next — physical left/right in both writing directions */}
          <button
            type="button"
            onClick={prev}
            aria-label={lang === "ar" ? "السابق" : "Précédent"}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 border border-brand/40 bg-bg/70 p-1.5 text-brand backdrop-blur-sm transition-colors hover:bg-bg/90 sm:p-2"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label={lang === "ar" ? "التالي" : "Suivant"}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 border border-brand/40 bg-bg/70 p-1.5 text-brand backdrop-blur-sm transition-colors hover:bg-bg/90 sm:p-2"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* rotating circular stamp — pinned to the frame's TOP-end corner: every
            poster carries its own caption + CTA across the bottom, and the dot
            rail sits directly beneath */}
        <div className="pointer-events-none absolute -top-5 end-[-1.25rem] z-20 flex h-16 w-16 items-center justify-center rounded-full border border-brand/40 bg-bg/85 backdrop-blur-sm sm:h-20 sm:w-20">
          <svg viewBox="0 0 100 100" className="h-14 w-14 animate-spin-slow sm:h-16 sm:w-16">
            <defs>
              <path id="hero-stamp" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
            </defs>
            <text className="fill-brand" fontSize="8.5" letterSpacing="3.2">
              <textPath href="#hero-stamp">ARGENT 925 • LAROCHE BIJOUX •</textPath>
            </text>
          </svg>
          <span className="absolute font-display text-base text-brand">✦</span>
        </div>
      </motion.div>

      {/* dot rail */}
      <div className="relative z-20 mt-6 flex items-center justify-center gap-2 sm:mt-7">
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i, i > index ? 1 : -1)}
            aria-label={lang === "ar" ? s.labelAr : s.labelFr}
            aria-current={i === index}
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i === index ? "w-6 bg-brand" : "w-1.5 bg-line hover:bg-brand/50",
            )}
          />
        ))}
      </div>

      {/* sparkle field */}
      {[...Array(12)].map((_, i) => (
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
