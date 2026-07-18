import type { Config } from "tailwindcss";

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        "panel-2": "rgb(var(--c-panel-2) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        brand: "rgb(var(--c-brand) / <alpha-value>)",
        "brand-soft": "rgb(var(--c-brand-soft) / <alpha-value>)",
        "brand-ink": "rgb(var(--c-brand-ink) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        gold: "0 8px 30px -8px rgb(var(--c-brand) / 0.35)",
        panel: "0 20px 60px -20px rgb(0 0 0 / 0.45)",
      },
      backgroundImage: {
        shimmer:
          "linear-gradient(110deg, transparent 20%, rgb(var(--c-brand) / 0.55) 50%, transparent 80%)",
        "radial-glow":
          "radial-gradient(60% 60% at 50% 40%, rgb(var(--c-brand) / 0.18), transparent 70%)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-150% 0" },
          "100%": { backgroundPosition: "150% 0" },
        },
        sparkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-25%)" },
        },
        "reveal-up": {
          "0%": { transform: "translateY(24px)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
        sparkle: "sparkle 2.2s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spin-slow 18s linear infinite",
        marquee: "marquee 22s linear infinite",
      },
      letterSpacing: {
        wide2: "0.12em",
        wide3: "0.22em",
        wide4: "0.3em",
        wide5: "0.42em",
      },
      borderRadius: {
        none: "0",
        editorial: "2px",
      },
    },
  },
  plugins: [],
} satisfies Config;
