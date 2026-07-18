import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. Keep subtle — this is jewelry, not a game. */
  max?: number;
}

/**
 * Pointer-following 3D tilt. Only activates on hover-capable fine pointers;
 * touch devices and reduced-motion users get a plain wrapper (zero cost).
 */
export function TiltCard({ children, className, max = 5 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [canHover] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), {
    stiffness: 160,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), {
    stiffness: 160,
    damping: 18,
  });

  if (!canHover || reducedMotion) {
    return <div className={className}>{children}</div>;
  }

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
    <div className={cn("[perspective:900px]", className)}>
      <motion.div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="h-full will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
