import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useWishlistStore } from "@/store/wishlist";
import { useSeo } from "@/hooks/useSeo";
import { supabase } from "@/lib/supabase";
import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types/db";

export default function Wishlist() {
  const { t } = useLanguage();
  const productIds = useWishlistStore((s) => s.productIds);

  useSeo({
    title: `${t("wishlistTitle")} — Laroche Bijoux`,
    description: "Votre liste de favoris Laroche Bijoux.",
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["wishlist-products", productIds],
    enabled: productIds.length > 0,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*), category:categories(*)")
        .in("id", productIds)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <h1 className="mb-8 font-display text-3xl text-ink md:text-4xl">{t("wishlistTitle")}</h1>

      {productIds.length === 0 || (!isLoading && products.length === 0) ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <Heart size={40} className="text-muted" />
          <p className="text-muted">{t("wishlistEmpty")}</p>
          <Button asChild>
            <Link to="/boutique">{t("cartEmptyCta")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
