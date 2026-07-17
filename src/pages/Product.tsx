import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Heart, Truck, ShieldCheck, ChevronDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useProduct, useRelatedProducts } from "@/hooks/useProducts";
import { useSeo } from "@/hooks/useSeo";
import { useCartStore } from "@/store/cart";
import { useWishlistStore } from "@/store/wishlist";
import { Button } from "@/components/ui/Button";
import { ProductGallery } from "@/components/product/ProductGallery";
import { InlineCheckout } from "@/components/product/InlineCheckout";
import { ProductCard } from "@/components/product/ProductCard";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { trackAddToCart, trackViewContent } from "@/lib/pixel";
import type { VariantPick } from "@/types/db";

export default function Product() {
  const { slug } = useParams();
  const { t, lang } = useLanguage();
  const { data: product, isLoading } = useProduct(slug);
  const { data: related = [] } = useRelatedProducts(product?.category_id, product?.id);
  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist = useWishlistStore((s) => s.has(product?.id ?? ""));

  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [variantPicks, setVariantPicks] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [buyNow, setBuyNow] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("description");
  const trackedViewId = useRef<string | null>(null);

  useEffect(() => {
    if (product && trackedViewId.current !== product.id) {
      trackedViewId.current = product.id;
      trackViewContent({ value: product.price, currency: "DZD", content_ids: [product.id] });
    }
  }, [product]);

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
    return <div className="py-32 text-center text-muted">{t("loading")}</div>;
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
    trackAddToCart({
      value: product.price * quantity,
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
        <ProductGallery images={product.product_images ?? []} alt={name} />

        <div>
          {product.style_code && (
            <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">
              {t("productStyleCode")} {product.style_code}
            </p>
          )}
          <h1 className="font-display text-3xl text-ink md:text-4xl">{name}</h1>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-medium text-brand">{formatPrice(product.price)}</span>
            {product.compare_at_price != null && product.compare_at_price > product.price && (
              <span className="text-muted line-through">
                {formatPrice(product.compare_at_price)}
              </span>
            )}
          </div>

          {product.material && (
            <p className="mt-3 text-sm text-muted">
              {t("productMaterial")}: <span className="text-ink">{product.material}</span>
            </p>
          )}

          {product.video_url && (
            <div className="mt-6 overflow-hidden rounded-xl border border-line">
              <video
                controls
                preload="none"
                poster={product.product_images?.[0]?.url}
                className="w-full"
              >
                <source src={product.video_url} />
              </video>
            </div>
          )}

          {requiresColor && (
            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">{t("productColor")}</p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition-colors",
                      color === c
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-line text-muted hover:border-brand/50",
                    )}
                  >
                    {c}
                  </button>
                ))}
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
            <button
              onClick={() => toggleWishlist(product.id)}
              className="rounded-full border border-line p-3 text-ink transition-colors hover:border-brand hover:text-brand"
              aria-label={t("navWishlist")}
            >
              <Heart size={18} className={cn(inWishlist && "fill-brand text-brand")} />
            </button>
          </div>

          {missingVariant && (
            <p className="mt-3 text-xs text-red-500">{t("productSelectVariant")}</p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={product.stock <= 0 || missingVariant}
              onClick={handleAddToCart}
            >
              {product.stock <= 0 ? t("productOutOfStock") : t("productAddToCart")}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={product.stock <= 0 || missingVariant}
              onClick={() => setBuyNow((v) => !v)}
            >
              {t("productBuyNow")}
            </Button>
          </div>

          {buyNow && !missingVariant && (
            <div className="mt-8 rounded-2xl border border-line bg-panel p-6">
              <h3 className="mb-4 font-display text-xl text-ink">{t("checkoutQuickBuy")}</h3>
              <InlineCheckout
                product={product}
                color={color}
                size={size}
                variants={variants}
                quantity={quantity}
              />
            </div>
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
                {openSection === section.key && (
                  <p className="whitespace-pre-line pb-4 text-sm text-muted">
                    {section.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-8 font-display text-2xl text-ink md:text-3xl">
            {t("productRelated")}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
