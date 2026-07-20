import { useSyncExternalStore, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useReveal } from "@/hooks/useReveal";

const COARSE = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger offset in seconds. */
  delay?: number;
  duration?: number;
  /**
   * `fade` lifts and fades in — the default for text and cards.
   * `curtain` unveils imagery top-to-bottom; it falls back to `fade` on phones,
   * where the clip-path reveal is both heavy and visually fussy at 2 columns.
   */
  variant?: "fade" | "curtain";
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  className,
  delay = 0,
  duration,
  variant = "fade",
}: RevealProps) {
  const [ref, revealed] = useReveal<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  if (reducedMotion) return <div className={className}>{children}</div>;

  const curtain = variant === "curtain" && !isMobile;

  const hidden = curtain
    ? { clipPath: "inset(0 0 100% 0)", opacity: 0.4 }
    : { opacity: 0, y: 24 };
  const shown = curtain
    ? { clipPath: "inset(0 0 0% 0)", opacity: 1 }
    : { opacity: 1, y: 0 };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={hidden}
      animate={revealed ? shown : hidden}
      transition={{ duration: duration ?? (curtain ? 0.85 : 0.6), delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
