import { useState, useRef, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { ProductImage } from "@/types/db";

export function ProductGallery({
  images,
  alt,
}: {
  images: ProductImage[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState({ x: 50, y: 50, active: false });
  const [lightbox, setLightbox] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const current = images[active];

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y, active: true });
  }

  if (!current) {
    return <div className="aspect-square rounded-2xl bg-panel-2" />;
  }

  return (
    <div>
      <div
        ref={imgRef}
        className="relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl border border-line bg-panel-2"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setZoom((z) => ({ ...z, active: false }))}
        onClick={() => setLightbox(true)}
      >
        {/* crossfade between gallery images — exiting frame stays absolute under the entering one */}
        <AnimatePresence initial={false}>
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <img
              src={current.url}
              alt={current.alt ?? alt}
              width={800}
              height={800}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-200"
              style={
                zoom.active
                  ? {
                      transform: "scale(1.9)",
                      transformOrigin: `${zoom.x}% ${zoom.y}%`,
                    }
                  : undefined
              }
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <motion.button
              key={img.id}
              onClick={() => setActive(i)}
              whileTap={{ scale: 0.94 }}
              className={`relative shrink-0 overflow-hidden rounded-lg border transition-colors ${
                i === active ? "border-brand" : "border-line opacity-70 hover:opacity-100"
              }`}
            >
              <SmartImage
                src={img.url}
                alt={img.alt ?? alt}
                width={72}
                height={72}
                className="h-18 w-18 object-cover"
              />
              {i === active && (
                <motion.span
                  layoutId="gallery-thumb-indicator"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-brand"
                />
              )}
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightbox(false)}
          >
            <button
              className="absolute end-6 top-6 text-white transition-transform hover:rotate-90"
              onClick={() => setLightbox(false)}
              aria-label="close"
            >
              <X size={28} />
            </button>
            {images.length > 1 && (
              <>
                <button
                  className="absolute start-6 top-1/2 -translate-y-1/2 text-white transition-transform hover:scale-125"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActive((i) => (i - 1 + images.length) % images.length);
                  }}
                  aria-label="previous"
                >
                  <ChevronLeft size={32} />
                </button>
                <button
                  className="absolute end-6 top-1/2 -translate-y-1/2 text-white transition-transform hover:scale-125"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActive((i) => (i + 1) % images.length);
                  }}
                  aria-label="next"
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}
            <motion.img
              key={current.id}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              src={current.url}
              alt={current.alt ?? alt}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
