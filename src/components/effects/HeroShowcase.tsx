import { useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { HERO_ACCENT, HERO_MAIN, HERO_SECONDARY } from "@/lib/editorialImages";
import { SmartImage } from "@/components/ui/SmartImage";

/**
 * Layered editorial photo composition with depth: three jewelry photographs
 * at different parallax depths that ease toward the pointer, framed by a
 * rotating gold orbit line, a circular brand stamp and a sparkle field.
 * Photography over WebGL — real luxury reads better than procedural gems.
 */
export function HeroShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [canHover] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 60, damping: 18, mass: 0.6 };
  // three depth planes — background drifts least, foreground most
  const backX = useSpring(useTransform(px, [0, 1], [10, -10]), spring);
  const backY = useSpring(useTransform(py, [0, 1], [8, -8]), spring);
  const midX = useSpring(useTransform(px, [0, 1], [-16, 16]), spring);
  const midY = useSpring(useTransform(py, [0, 1], [-10, 10]), spring);
  const frontX = useSpring(useTransform(px, [0, 1], [-28, 28]), spring);
  const frontY = useSpring(useTransform(py, [0, 1], [-18, 18]), spring);

  const parallax = canHover && !reducedMotion;

  function onPointerMove(e: React.PointerEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function onPointerLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <div
      ref={ref}
      onPointerMove={parallax ? onPointerMove : undefined}
      onPointerLeave={parallax ? onPointerLeave : undefined}
      className="relative flex h-full w-full items-center justify-center"
    >
      {/* glow + rotating gold orbit line behind everything */}
      <div className="pointer-events-none absolute h-[70%] w-[70%] rounded-full bg-radial-glow blur-2xl" />
      <motion.div
        style={parallax ? { x: backX, y: backY } : undefined}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[92%] w-[92%] max-w-[30rem] animate-spin-slow rounded-full border border-brand/25 [border-style:dashed]" />
        <div className="absolute h-[74%] w-[74%] max-w-[24rem] rounded-full border border-brand/15" />
      </motion.div>

      {/* main photograph — mid depth */}
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        style={parallax ? { x: midX, y: midY } : undefined}
        className="fx-frame relative z-10 h-[82%] w-[64%] max-w-sm"
      >
        <div className="h-full w-full overflow-hidden border border-line bg-panel">
          <SmartImage
            src={HERO_MAIN}
            alt=""
            width={900}
            height={1125}
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 768px) 64vw, 24rem"
            className={`h-full w-full object-cover ${reducedMotion ? "" : "fx-kenburns"}`}
          />
        </div>
      </motion.div>

      {/* macro ring — foreground, floats */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={
          reducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -12, 0] }
        }
        transition={
          reducedMotion
            ? { duration: 0.9, delay: 0.35 }
            : {
                opacity: { duration: 0.9, delay: 0.35 },
                y: { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
              }
        }
        style={parallax ? { x: frontX, y: frontY } : undefined}
        className="absolute bottom-[8%] start-[2%] z-20 w-[36%] max-w-[11rem] border border-brand/50 bg-bg p-1.5 shadow-panel sm:start-[6%]"
      >
        <SmartImage
          src={HERO_ACCENT}
          alt=""
          width={440}
          height={440}
          sizes="176px"
          className="aspect-square w-full object-cover"
        />
      </motion.div>

      {/* watch detail — background depth, top end */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={
          reducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, 10, 0] }
        }
        transition={
          reducedMotion
            ? { duration: 0.9, delay: 0.55 }
            : {
                opacity: { duration: 0.9, delay: 0.55 },
                y: { duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
              }
        }
        style={parallax ? { x: backX, y: backY } : undefined}
        className="absolute end-[0%] top-[6%] z-0 w-[30%] max-w-[9.5rem] border border-line bg-bg p-1.5 shadow-panel sm:end-[4%]"
      >
        <SmartImage
          src={HERO_SECONDARY}
          alt=""
          width={380}
          height={475}
          sizes="152px"
          className="aspect-[4/5] w-full object-cover"
        />
      </motion.div>

      {/* rotating circular stamp */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        style={parallax ? { x: frontX, y: frontY } : undefined}
        className="absolute bottom-0 end-[6%] z-20 flex h-20 w-20 items-center justify-center rounded-full border border-brand/40 bg-bg/85 backdrop-blur-sm sm:-bottom-2 sm:end-[14%] sm:h-24 sm:w-24"
      >
        <svg viewBox="0 0 100 100" className="h-16 w-16 animate-spin-slow sm:h-20 sm:w-20">
          <defs>
            <path id="hero-stamp" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
          </defs>
          <text className="fill-brand" fontSize="8.5" letterSpacing="3.2">
            <textPath href="#hero-stamp">ARGENT 925 • LAROCHE BIJOUX •</textPath>
          </text>
        </svg>
        <span className="absolute font-display text-lg text-brand">✦</span>
      </motion.div>

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
