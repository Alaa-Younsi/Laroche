import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageProvider";
import { formatPrice } from "@/lib/format";
import { TiltCard } from "@/components/effects/TiltCard";
import { SmartImage } from "@/components/ui/SmartImage";
import type { Product } from "@/types/db";

export function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useLanguage();

  const image = product.product_images?.[0]?.url;
  const name = lang === "ar" ? product.name_ar : product.name_fr;
  const onSale = product.compare_at_price != null && product.compare_at_price > product.price;
  const outOfStock = product.stock <= 0;

  return (
    <TiltCard className="h-full">
      <div className="group fx-card-glow relative h-full border border-line bg-bg">
      <Link to={`/produit/${product.slug}`} className="block">
        <div className="fx-gold-sweep relative aspect-square overflow-hidden bg-panel-2">
          {image && (
            <SmartImage
              src={image}
              alt={product.product_images?.[0]?.alt ?? name}
              width={480}
              height={480}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 300px"
              className="h-full w-full object-cover group-hover:scale-105"
            />
          )}
          <div className="absolute inset-x-0 top-0 flex justify-between p-3">
            <div className="flex flex-col gap-1.5">
              {product.featured && (
                <span className="bg-brand px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-wide2 text-brand-ink">
                  {t("productBestSeller")}
                </span>
              )}
              {onSale && (
                <span className="bg-bg px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-wide2 text-brand">
                  {t("productOnSale")}
                </span>
              )}
            </div>
          </div>
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-[2px]">
              <span className="border border-line bg-panel px-3 py-1.5 text-[0.6rem] uppercase tracking-wide2 text-muted">
                {t("productOutOfStock")}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-1.5 border-t border-line p-4">
          <h3 className="truncate font-display text-lg text-ink">{name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-brand">{formatPrice(product.price)}</span>
            {onSale && (
              <span className="text-xs text-muted line-through">
                {formatPrice(product.compare_at_price as number)}
              </span>
            )}
          </div>
        </div>
      </Link>
      </div>
    </TiltCard>
  );
}
