import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, AlertTriangle, Loader2, Search } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { invalidateProductCaches } from "@/lib/queryCache";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/db";
import { responsiveSrcSet } from "@/lib/image";

// Below this, the product list flags the row so the owner restocks before it
// sells out. 0 renders as a distinct "rupture" state.
const LOW_STOCK_THRESHOLD = 3;

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

// Confirmation before deleting a product. product_images / product_collections
// rows cascade away with it, while order_items.product_id is ON DELETE SET NULL
// — past orders keep their name/price snapshot, so history stays intact.
function DeleteProductModal({
  product,
  lang,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  product: Product;
  lang: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const name = lang === "ar" ? product.name_ar : product.name_fr;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={busy ? undefined : onCancel}
    >
      <BentoPanel className="w-full max-w-md p-6" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle size={18} />
          </span>
          <h3 className="font-display text-lg text-ink">{t("productDeleteTitle")}</h3>
        </div>
        <p className="text-sm text-muted">
          {t("productDeleteConfirm").replace("{name}", name)}
          <span className="mt-2 block text-xs">{t("productDeleteWarning")}</span>
        </p>
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button size="sm" variant="danger" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("delete")}
          </Button>
        </div>
      </BentoPanel>
    </div>
  );
}

export default function Products() {
  const { t, lang } = useLanguage();
  const { data: products = [], isLoading } = useAllProducts();
  const queryClient = useQueryClient();
  const lowStockCount = products.filter(
    (p) => p.status === "active" && p.stock <= LOW_STOCK_THRESHOLD,
  ).length;
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // The whole catalogue is already in memory here, so filtering stays client
  // side — no refetch, and it matches on both languages at once so the owner
  // finds a piece whether he remembers its French or Arabic name.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [
        p.name_fr,
        p.name_ar,
        p.slug,
        p.style_code ?? "",
        p.material ?? "",
        p.category?.name_fr ?? "",
        p.category?.name_ar ?? "",
      ].some((field) => field.toLowerCase().includes(q)),
    );
  }, [products, search]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("products").delete().eq("id", pendingDelete.id);
    setDeleting(false);
    if (error) {
      setDeleteError(t("productDeleteError"));
      return;
    }
    setPendingDelete(null);
    invalidateProductCaches(queryClient);
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl text-ink">{t("adminProducts")}</h1>
          {lowStockCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle size={13} />
              {t("adminLowStockCount").replace("{n}", String(lowStockCount))}
            </span>
          )}
        </div>
        <Button asChild>
          <Link to="/admin/produits/nouveau">
            <Plus size={14} /> {t("adminAddProduct")}
          </Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminProductSearch")}
            className="w-full min-w-0 rounded-lg border border-line bg-panel py-2.5 pe-4 ps-9 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-brand"
          />
        </div>
        {search.trim() !== "" && (
          <span className="text-xs uppercase tracking-wide2 text-muted">
            {visible.length} / {products.length}
          </span>
        )}
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
                <th className="whitespace-nowrap px-5 py-3 text-end"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id} className="border-b border-line last:border-0 hover:bg-panel-2/40">
                  <td className="px-5 py-2.5">
                    {product.product_images?.[0] && (
                      <img
                        src={product.product_images[0].url}
                        srcSet={responsiveSrcSet(product.product_images[0].url)}
                        sizes="40px"
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
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
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <Price value={product.price} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    {product.stock === 0 ? (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase text-red-500">
                        {t("adminOutOfStock")}
                      </span>
                    ) : product.stock <= LOW_STOCK_THRESHOLD ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {product.stock}
                      </span>
                    ) : (
                      product.stock
                    )}
                  </td>
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
                  <td className="whitespace-nowrap px-5 py-2.5 text-end">
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setPendingDelete(product);
                      }}
                      className="text-muted transition-colors hover:text-red-500"
                      title={t("productDeleteTitle")}
                      aria-label={t("productDeleteTitle")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted">
                    {t("noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!isLoading && visible.length === 0 && products.length > 0 && (
            <p className="px-5 py-12 text-center text-sm text-muted">{t("adminNoMatch")}</p>
          )}
        </div>
      </BentoPanel>

      {pendingDelete && (
        <DeleteProductModal
          product={pendingDelete}
          lang={lang}
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
