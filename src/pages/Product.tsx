import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Truck, ShieldCheck, ChevronDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useProduct, useRelatedProducts } from "@/hooks/useProducts";
import { useSeo } from "@/hooks/useSeo";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/Button";
import { ProductGallery, type GalleryImage } from "@/components/product/ProductGallery";
import { InlineCheckout } from "@/components/product/InlineCheckout";
import { ProductCard } from "@/components/product/ProductCard";
import { Reveal } from "@/components/effects/Reveal";
import { Price } from "@/components/ui/Price";
import { cn } from "@/lib/utils";
import { usePixel } from "@/components/MetaPixelProvider";
import type { ProductColor, VariantPick } from "@/types/db";

// Sits under the gallery on desktop (left column) but under the checkout form
// on mobile, where the single-column stack would otherwise push it above the
// form and bury the buy path. Rendered in both slots and toggled by breakpoint.
//
// Plays itself, forever, with no controls of any kind — the shopper can only
// watch it. Playback is driven by an observer rather than the autoplay
// attribute for two reasons: the off-breakpoint copy is display:none, so it
// never intersects and never pulls the file down (autoplay would have fetched
// the clip twice), and the visible copy stays off the wire until it is scrolled
// to, which matters on the mobile data plans most of these orders come from.
function ProductVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // React does not reliably reflect the `muted` prop onto the element, and an
    // unmuted video is refused autoplay everywhere — pin it imperatively.
    el.muted = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line", className)}>
      <video
        ref={ref}
        loop
        muted
        playsInline
        preload="none"
        poster={poster}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
        className="pointer-events-none w-full"
      >
        <source src={src} />
      </video>
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const { t, lang } = useLanguage();
  const { data: product, isLoading } = useProduct(slug);
  const { data: related = [] } = useRelatedProducts(product?.category_id, product?.id);
  const addItem = useCartStore((s) => s.addItem);

  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [variantPicks, setVariantPicks] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [openSection, setOpenSection] = useState<string | null>("description");
  const [activeImage, setActiveImage] = useState(0);
  const pixel = usePixel();
  const trackedViewId = useRef<string | null>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);

  function scrollToCheckout() {
    const el = checkoutRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      el.querySelector<HTMLInputElement>("input")?.focus();
    }, 450);
  }

  useEffect(() => {
    if (product && trackedViewId.current !== product.id) {
      trackedViewId.current = product.id;
      // Tell the pixel layer which product this is FIRST — a pixel scoped to
      // specific product pages only matches once the slug is registered.
      pixel.setContext({ productSlug: product.slug });
      // Number(): a Postgres numeric can arrive over PostgREST as a string, and
      // "1200" * qty silently NaNs.
      pixel.track("view_content", {
        value: Number(product.price),
        currency: "DZD",
        content_ids: [product.id],
      });
      setActiveImage(0);
    }
  }, [product, pixel]);

  const galleryImages: GalleryImage[] = useMemo(() => {
    if (!product) return [];
    const base = (product.product_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({ key: img.id, url: img.url, alt: img.alt }));
    const seen = new Set(base.map((g) => g.url));
    const colorImages = product.colors
      .filter((c) => c.image_url && !seen.has(c.image_url))
      .map((c) => {
        seen.add(c.image_url as string);
        return {
          key: `color-${c.hex}`,
          url: c.image_url as string,
          alt: lang === "ar" ? c.label_ar : c.label_fr,
        };
      });
    return [...base, ...colorImages];
  }, [product, lang]);

  function handleSelectColor(c: ProductColor) {
    setColor(lang === "ar" ? c.label_ar : c.label_fr);
    if (c.image_url) {
      const idx = galleryImages.findIndex((g) => g.url === c.image_url);
      if (idx >= 0) setActiveImage(idx);
    }
  }

  const name = product ? (lang === "ar" ? product.name_ar : product.name_fr) : "";
  const description = product ? (lang === "ar" ? product.description_ar : product.description_fr) : "";
  const details = product ? (lang === "ar" ? product.details_ar : product.details_fr) : [];
  const warranty = product ? (lang === "ar" ? product.warranty_ar : product.warranty_fr) : null;

  const variants: VariantPick[] = useMemo(() => {
    if (!product) return [];
    return product.variants
      .filter((group) => variantPicks[group.name_fr])
      .map((group) => ({
        name_fr: group.name_fr,
        name_ar: group.name_ar,
        value: variantPicks[group.name_fr],
      }));
  }, [product, variantPicks]);

  const requiresColor = (product?.colors.length ?? 0) > 0;
  const requiresSize = (product?.sizes.length ?? 0) > 0;
  const missingVariant =
    (requiresColor && !color) ||
    (requiresSize && !size) ||
    (product?.variants.some((g) => !variantPicks[g.name_fr]) ?? false);

  useSeo({
    title: product ? `${name} — Laroche Bijoux` : "Laroche Bijoux",
    description: description || "Laroche Bijoux — bijouterie et horlogerie de luxe.",
    image: product?.product_images?.[0]?.url,
    jsonLd: product
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          description,
          image: product.product_images?.map((i) => i.url),
          offers: {
            "@type": "Offer",
            priceCurrency: "DZD",
            price: product.price,
            availability:
              product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }
      : undefined,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-32 text-center">
        <span className="animate-sparkle text-2xl text-brand">✦</span>
        <span className="text-xs uppercase tracking-wide3 text-muted">{t("loading")}</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-32 text-center">
        <p className="text-muted">{t("noResults")}</p>
        <Link to="/boutique" className="mt-4 inline-block text-brand">
          {t("back")}
        </Link>
      </div>
    );
  }

  function handleAddToCart() {
    if (!product || missingVariant) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name_fr: product.name_fr,
      name_ar: product.name_ar,
      price: product.price,
      compare_at_price: product.compare_at_price,
      image: product.product_images?.[0]?.url ?? null,
      color,
      size,
      variants,
      quantity,
      stock: product.stock,
      quantity_offers: product.quantity_offers,
    });
    pixel.track("add_to_cart", {
      value: Number(product.price) * quantity,
      currency: "DZD",
      content_ids: [product.id],
    });
  }

  const sections = [
    { key: "description", label: t("productDescription"), content: description },
    ...(details.length > 0
      ? [{ key: "details", label: t("productDetails"), content: details.join(" · ") }]
      : []),
    ...(warranty ? [{ key: "warranty", label: t("productWarranty"), content: warranty }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="grid gap-10 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <ProductGallery
            images={galleryImages}
            alt={name}
            activeIndex={activeImage}
            onActiveChange={setActiveImage}
          />
          {product.video_url && (
            <ProductVideo
              src={product.video_url}
              poster={product.product_images?.[0]?.url}
              className="mt-6 hidden md:block"
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {product.style_code && (
            <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">
              {t("productStyleCode")} {product.style_code}
            </p>
          )}
          <h1 className="font-display text-3xl text-ink md:text-4xl">{name}</h1>

          <div className="mt-4 flex items-center gap-3">
            <Price value={product.price} className="text-2xl font-medium text-brand" />
            {product.compare_at_price != null && product.compare_at_price > product.price && (
              <Price value={product.compare_at_price} className="text-muted line-through" />
            )}
          </div>

          {product.material && (
            <p className="mt-3 text-sm text-muted">
              {t("productMaterial")}: <span className="text-ink">{product.material}</span>
            </p>
          )}

          {requiresColor && (
            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">
                {t("productColor")}
                {color && <span className="ms-1.5 normal-case text-ink">— {color}</span>}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {product.colors.map((c) => {
                  const label = lang === "ar" ? c.label_ar : c.label_fr;
                  const selected = color === label;
                  return (
                    <button
                      key={`${c.hex}-${label}`}
                      type="button"
                      onClick={() => handleSelectColor(c)}
                      title={label}
                      aria-label={label}
                      aria-pressed={selected}
                      className={cn(
                        "relative h-9 w-9 shrink-0 rounded-full ring-1 ring-line ring-offset-2 ring-offset-bg transition-all hover:ring-brand/50",
                        selected && "ring-2 ring-brand",
                      )}
                    >
                      <span
                        className="absolute inset-0.5 rounded-full border border-black/10"
                        style={{ backgroundColor: c.hex }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {requiresSize && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide2 text-muted">{t("productSize")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={cn(
                      "min-w-11 rounded-full border px-4 py-2 text-sm transition-colors",
                      size === s
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-line text-muted hover:border-brand/50",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.variants.map((group) => (
            <div key={group.name_fr} className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">
                {lang === "ar" ? group.name_ar : group.name_fr}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.values.map((value) => (
                  <button
                    key={value}
                    onClick={() =>
                      setVariantPicks((prev) => ({ ...prev, [group.name_fr]: value }))
                    }
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition-colors",
                      variantPicks[group.name_fr] === value
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-line text-muted hover:border-brand/50",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-full border border-line px-3 py-2">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="text-ink"
                aria-label="-"
              >
                −
              </button>
              <span className="w-6 text-center text-sm">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                className="text-ink"
                aria-label="+"
              >
                +
              </button>
            </div>
          </div>

          {missingVariant && (
            <p className="mt-3 text-xs text-red-500">{t("productSelectVariant")}</p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:flex-1 hover:-translate-y-0.5 hover:shadow-panel"
              disabled={product.stock <= 0 || missingVariant}
              onClick={handleAddToCart}
            >
              {product.stock <= 0 ? t("productOutOfStock") : t("productAddToCart")}
            </Button>
            <Button
              size="lg"
              className="w-full sm:flex-1 hover:-translate-y-0.5"
              disabled={product.stock <= 0 || missingVariant}
              onClick={scrollToCheckout}
            >
              {t("productBuyNow")}
            </Button>
          </div>

          <div ref={checkoutRef} className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-panel p-6">
            <h3 className="mb-4 font-display text-xl text-ink">{t("checkoutQuickBuy")}</h3>
            <InlineCheckout
              product={product}
              color={color}
              size={size}
              variants={variants}
              quantity={quantity}
            />
          </div>

          {product.video_url && (
            <ProductVideo
              src={product.video_url}
              poster={product.product_images?.[0]?.url}
              className="mt-6 md:hidden"
            />
          )}

          <div className="mt-8 flex items-center gap-6 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Truck size={14} className="text-brand" /> {t("trustDelivery")}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-brand" /> {t("trustSecure")}
            </span>
          </div>

          <div className="mt-10 divide-y divide-line border-t border-line">
            {sections.map((section) => (
              <div key={section.key}>
                <button
                  onClick={() =>
                    setOpenSection(openSection === section.key ? null : section.key)
                  }
                  className="flex w-full items-center justify-between py-4 text-start"
                >
                  <span className="text-sm font-medium uppercase tracking-wide2 text-ink">
                    {section.label}
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "text-muted transition-transform",
                      openSection === section.key && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {openSection === section.key && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="whitespace-pre-line pb-4 text-sm text-muted">
                        {section.content}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <Reveal>
            <h2 className="mb-8 font-display text-2xl text-ink md:text-3xl">
              {t("productRelated")}
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p, i) => (
              <Reveal key={p.id} delay={(i % 2) * 0.07}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
