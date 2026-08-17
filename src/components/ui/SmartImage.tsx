import { useCallback, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { responsiveSrcSet } from "@/lib/image";

interface SmartImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

/**
 * Drop-in <img> replacement: lazy + async by default, a responsive srcset for
 * both Unsplash and Supabase Storage, and a blur-up fade-in so slow images
 * resolve gracefully instead of popping in.
 *
 * **Pass `sizes` whenever the image renders below full width** — without it the
 * browser assumes 100vw and picks the largest candidate, which throws away the
 * entire point of the srcset.
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
  // Supabase's render/image endpoint is a paid feature on some plans. If it
  // ever stops answering, a srcset of dead URLs would leave blank images —
  // browsers do NOT fall back to `src` when a chosen srcset candidate fails.
  // Dropping the srcset on error forces `src`, which is always the original
  // object URL, so the page self-heals instead of going blank.
  const [useSrcSet, setUseSrcSet] = useState(true);

  const srcSet = useSrcSet ? responsiveSrcSet(src) : undefined;

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
      sizes={srcSet ? (sizes ?? "100vw") : undefined}
      loading={loading}
      decoding={decoding}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (useSrcSet && responsiveSrcSet(src)) {
          setUseSrcSet(false);
          return;
        }
        // a failed image must still clear the fade — otherwise `.fx-img`'s
        // opacity:0 leaves a silent hole in the layout instead of a visible gap
        setLoaded(true);
      }}
      className={cn("fx-img", loaded && "is-loaded", className)}
      {...rest}
    />
  );
}
