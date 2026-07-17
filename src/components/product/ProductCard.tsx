import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useWishlistStore } from "@/store/wishlist";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/db";

export function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useLanguage();
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist = useWishlistStore((s) => s.has(product.id));

  const image = product.product_images?.[0]?.url;
  const name = lang === "ar" ? product.name_ar : product.name_fr;
  const onSale = product.compare_at_price != null && product.compare_at_price > product.price;
  const outOfStock = product.stock <= 0;

  return (
    <div className="group fx-card-glow relative rounded-2xl border border-line bg-panel p-3">
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleWishlist(product.id);
        }}
        className="absolute end-5 top-5 z-10 rounded-full bg-bg/70 p-2 backdrop-blur-sm transition-colors hover:bg-bg"
        aria-label={t("navWishlist")}
      >
        <Heart
          size={16}
          className={cn(inWishlist ? "fill-brand text-brand" : "text-ink")}
        />
      </button>

      <Link to={`/produit/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-panel-2">
          {image && (
            <img
              src={image}
              alt={product.product_images?.[0]?.alt ?? name}
              width={480}
              height={480}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-x-0 top-0 flex justify-between p-3">
            <div className="flex flex-col gap-1.5">
              {product.featured && (
                <span className="rounded-full bg-brand px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-brand-ink">
                  {t("productBestSeller")}
                </span>
              )}
              {onSale && (
                <span className="rounded-full bg-panel px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
                  {t("productOnSale")}
                </span>
              )}
            </div>
          </div>
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-[2px]">
              <span className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs uppercase tracking-wide text-muted">
                {t("productOutOfStock")}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1 px-1 pb-1">
          <h3 className="truncate font-display text-lg text-ink">{name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-brand">{formatPrice(product.price)}</span>
            {onSale && (
              <span className="text-xs text-muted line-through">
                {formatPrice(product.compare_at_price as number)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
