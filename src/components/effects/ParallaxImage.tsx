import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { unsplashSrcSet } from "@/lib/image";

interface ParallaxImageProps {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  /** Total vertical drift in px across the scroll range. */
  drift?: number;
  width?: number;
  height?: number;
  sizes?: string;
}

/**
 * Image that drifts slower than the page while scrolling through the
 * viewport. The image is oversized by the drift amount so edges never show.
 * Framer drives the transform each frame, so the load fade here is
 * opacity/filter only — SmartImage's transform transition would fight it.
 */
export function ParallaxImage({
  src,
  alt = "",
  className,
  imgClassName,
  drift = 60,
  width,
  height,
  sizes,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-drift, drift]);
  const srcSet = unsplashSrcSet(src);

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <motion.img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={reducedMotion ? undefined : { y, scale: 1.15 }}
        className={cn(
          "h-full w-full object-cover transition-[opacity,filter] duration-500",
          loaded ? "opacity-100 blur-0" : "opacity-0 blur-md",
          imgClassName,
        )}
      />
    </div>
  );
}
