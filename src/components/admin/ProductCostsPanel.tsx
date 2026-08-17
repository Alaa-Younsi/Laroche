import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useProductCosts, useSaveProductCost, useSuppliers } from "@/hooks/useFinance";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import type { Product } from "@/types/db";

/**
 * The buy-price editor for WEBSITE products. The live margin is painted red
 * when negative — that is the client discovering they are selling at a loss,
 * and it should be impossible to scroll past.
 */
export function ProductCostsPanel({ products }: { products: Product[] }) {
  const { t, lang } = useLanguage();
  const toast = useAdminToast();
  const { data: costs = [] } = useProductCosts();
  const { data: suppliers = [] } = useSuppliers();
  const save = useSaveProductCost();
  const [search, setSearch] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const costById = useMemo(
    () => new Map(costs.map((cost) => [cost.product_id, cost])),
    [costs],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products
      .filter((product) => {
        if (!needle) return true;
        return (
          product.name_fr.toLowerCase().includes(needle) ||
          product.name_ar.toLowerCase().includes(needle)
        );
      })
      .map((product) => {
        const cost = costById.get(product.id);
        const costPrice = cost?.cost_price ?? 0;
        return {
          product,
          costPrice,
          supplierId: cost?.supplier_id ?? null,
          margin: product.price > 0 ? (product.price - costPrice) / product.price : 0,
        };
      });
  }, [products, costById, search]);

  async function persist(productId: string, costPrice: number, supplierId: string | null) {
    try {
      await save.mutateAsync({
        product_id: productId,
        cost_price: Number.isFinite(costPrice) ? Math.max(costPrice, 0) : 0,
        supplier_id: supplierId,
      });
      setSavedId(productId);
      setTimeout(() => setSavedId((id) => (id === productId ? null : id)), 1500);
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("finCosts")}</h3>
        <div className="relative w-full sm:w-64">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            className="ps-9"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <p className="rounded-lg border border-line bg-panel-2/40 px-4 py-3 text-xs text-muted">
        {t("finCostsHint")}
      </p>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finProduct")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finSellPrice")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finBuyPrice")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finSupplier")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finMargin")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product, costPrice, supplierId, margin }) => (
              <tr key={product.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 text-ink">
                  {lang === "ar" ? product.name_ar : product.name_fr}
                </td>
                <td className="px-4 py-2.5 text-end tabular-nums text-muted">
                  <Price value={product.price} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={costPrice}
                      className="w-28 px-3 py-2"
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (next !== costPrice) persist(product.id, next, supplierId);
                      }}
                    />
                    {savedId === product.id && (
                      <Check size={15} className="shrink-0 text-emerald-500" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Select
                    className="w-44 px-3 py-2"
                    value={supplierId ?? ""}
                    onChange={(e) => persist(product.id, costPrice, e.target.value || null)}
                  >
                    <option value="">{t("finNoSupplier")}</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td
                  dir="ltr"
                  className={`px-4 py-2.5 text-end tabular-nums ${
                    margin < 0 ? "font-medium text-red-500" : "text-muted"
                  }`}
                >
                  {(margin * 100).toFixed(0)} %
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {t("finNoData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
