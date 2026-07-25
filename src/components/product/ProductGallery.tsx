import { useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SmartImage } from "@/components/ui/SmartImage";

export interface GalleryImage {
  key: string;
  url: string;
  alt?: string | null;
}

const SWIPE_THRESHOLD = 60;

export function ProductGallery({
  images,
  alt,
  activeIndex,
  onActiveChange,
}: {
  images: GalleryImage[];
  alt: string;
  activeIndex: number;
  onActiveChange: (index: number) => void;
}) {
  const { dir } = useLanguage();
  const [zoom, setZoom] = useState({ x: 50, y: 50, active: false });
  const [lightbox, setLightbox] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const wasDragged = useRef(false);
  const reducedMotion = useReducedMotion();

  const current = images[activeIndex];

  function goTo(index: number) {
    onActiveChange((index + images.length) % images.length);
  }

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y, active: true });
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const offset = dir === "rtl" ? -info.offset.x : info.offset.x;
    if (Math.abs(offset) > 5) wasDragged.current = true;
    if (offset > SWIPE_THRESHOLD) goTo(activeIndex - 1);
    else if (offset < -SWIPE_THRESHOLD) goTo(activeIndex + 1);
  }

  function handleImageClick() {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    setLightbox(true);
  }

  if (!current) {
    return <div className="aspect-square rounded-2xl bg-panel-2" />;
  }

  return (
    <div>
      <div
        ref={imgRef}
        className="group relative aspect-square cursor-zoom-in touch-pan-y select-none overflow-hidden rounded-2xl border border-line bg-panel-2"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setZoom((z) => ({ ...z, active: false }))}
        onClick={handleImageClick}
      >
        {/* crossfade between gallery images — exiting frame stays absolute under the entering one */}
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={current.key}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={handleDragEnd}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
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
              className="pointer-events-none h-full w-full object-cover transition-transform duration-200"
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

        {images.length > 1 && (
          <>
            <button
              className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/50 group-hover:opacity-100 sm:opacity-70"
              onClick={(e) => {
                e.stopPropagation();
                goTo(activeIndex - 1);
              }}
              aria-label="previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/50 group-hover:opacity-100 sm:opacity-70"
              onClick={(e) => {
                e.stopPropagation();
                goTo(activeIndex + 1);
              }}
              aria-label="next"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <motion.button
              key={img.key}
              onClick={() => goTo(i)}
              whileTap={{ scale: 0.94 }}
              className={`relative shrink-0 overflow-hidden rounded-lg border transition-colors ${
                i === activeIndex ? "border-brand" : "border-line opacity-70 hover:opacity-100"
              }`}
            >
              <SmartImage
                src={img.url}
                alt={img.alt ?? alt}
                width={72}
                height={72}
                className="h-18 w-18 object-cover"
              />
              {i === activeIndex && (
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
                    goTo(activeIndex - 1);
                  }}
                  aria-label="previous"
                >
                  <ChevronLeft size={32} />
                </button>
                <button
                  className="absolute end-6 top-1/2 -translate-y-1/2 text-white transition-transform hover:scale-125"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(activeIndex + 1);
                  }}
                  aria-label="next"
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}
            <motion.img
              key={current.key}
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
