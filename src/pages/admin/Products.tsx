import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/db";

function useAllProducts() {
  return useQuery({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*), category:categories(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });
}

export default function Products() {
  const { t, lang } = useLanguage();
  const { data: products = [], isLoading } = useAllProducts();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl text-ink">{t("adminProducts")}</h1>
        <Button asChild>
          <Link to="/admin/produits/nouveau">
            <Plus size={14} /> {t("adminAddProduct")}
          </Link>
        </Button>
      </div>

      <BentoPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="whitespace-nowrap px-5 py-3 text-start"></th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Nom</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Catégorie</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Prix</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("adminStock")}</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("adminStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-line last:border-0 hover:bg-panel-2/40">
                  <td className="px-5 py-2.5">
                    {product.product_images?.[0] && (
                      <img
                        src={product.product_images[0].url}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <Link to={`/admin/produits/${product.id}`} className="text-ink hover:text-brand">
                      {lang === "ar" ? product.name_ar : product.name_fr}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted">
                    {product.category
                      ? lang === "ar"
                        ? product.category.name_ar
                        : product.category.name_fr
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5">{formatPrice(product.price)}</td>
                  <td className="whitespace-nowrap px-5 py-2.5">{product.stock}</td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-wide",
                        product.status === "active" ? "bg-brand/10 text-brand" : "bg-panel-2 text-muted",
                      )}
                    >
                      {product.status === "active" ? t("adminActive") : t("adminDraft")}
                    </span>
                  </td>
                </tr>
              ))}
              {products.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    {t("noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BentoPanel>
    </div>
  );
}
