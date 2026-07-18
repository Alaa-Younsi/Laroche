import { useCallback, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { unsplashSrcSet } from "@/lib/image";

interface SmartImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

/**
 * Drop-in <img> replacement: lazy + async by default, Unsplash srcset when
 * possible, and a blur-up fade-in so slow images resolve gracefully instead
 * of popping in. Pass `sizes` whenever the image renders below full width.
 */
export function SmartImage({
  src,
  className,
  loading = "lazy",
  decoding = "async",
  sizes,
  ...rest
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const srcSet = unsplashSrcSet(src);

  // onLoad never fires for images already in the browser cache — the ref
  // callback catches those via .complete so they don't stay blurred.
  const handleRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <img
      ref={handleRef}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      loading={loading}
      decoding={decoding}
      onLoad={() => setLoaded(true)}
      className={cn("fx-img", loaded && "is-loaded", className)}
      {...rest}
    />
  );
}
