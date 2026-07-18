import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface ParallaxImageProps {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  /** Total vertical drift in px across the scroll range. */
  drift?: number;
  width?: number;
  height?: number;
}

/**
 * Image that drifts slower than the page while scrolling through the
 * viewport. The image is oversized by the drift amount so edges never show.
 */
export function ParallaxImage({
  src,
  alt = "",
  className,
  imgClassName,
  drift = 60,
  width,
  height,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-drift, drift]);

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <motion.img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        style={reducedMotion ? undefined : { y, scale: 1.15 }}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}
