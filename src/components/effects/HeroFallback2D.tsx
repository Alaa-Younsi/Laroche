import { motion } from "framer-motion";

export function HeroFallback2D() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="absolute h-64 w-64 rounded-full bg-radial-glow blur-2xl" />
      <motion.div
        className="relative"
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* ring band */}
        <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
          <circle cx="110" cy="130" r="70" stroke="rgb(var(--c-brand))" strokeWidth="14" />
          <circle cx="110" cy="130" r="70" stroke="rgb(var(--c-brand-soft))" strokeWidth="2" opacity="0.6" />
          {/* prong */}
          <rect x="94" y="46" width="32" height="24" rx="4" fill="rgb(var(--c-brand))" />
          {/* diamond */}
          <polygon
            points="110,10 138,44 110,78 82,44"
            fill="url(#gemGradient)"
            stroke="#fff"
            strokeWidth="1.5"
            strokeOpacity="0.7"
          />
          <polygon points="110,10 124,44 110,78 96,44" fill="#ffffff" opacity="0.25" />
          <defs>
            <linearGradient id="gemGradient" x1="82" y1="10" x2="138" y2="78" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffffff" />
              <stop offset="0.5" stopColor="rgb(var(--c-brand-soft))" />
              <stop offset="1" stopColor="rgb(var(--c-brand))" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
      {[...Array(10)].map((_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-brand animate-sparkle"
          style={{
            top: `${15 + ((i * 37) % 70)}%`,
            left: `${10 + ((i * 53) % 80)}%`,
            animationDelay: `${i * 0.32}s`,
          }}
        />
      ))}
    </div>
  );
}
