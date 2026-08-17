import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X, Printer, RefreshCw, Search } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useStoreProducts,
  useSaveStoreProduct,
  useDeleteStoreProduct,
  useSetStoreStock,
  storeErrorKey,
} from "@/hooks/useStoreLedger";
import { useSuppliers } from "@/hooks/useFinance";
import { generateEan13 } from "@/lib/barcode";
import { Barcode, BarcodeSheet, type LabelSpec } from "@/components/admin/Barcode";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { formatPrice } from "@/lib/format";
import type { PricingMode, Store, StoreProduct, StoreProductKind } from "@/types/db";

type Draft = Partial<StoreProduct> & { name: string };

function blank(): Draft {
  return {
    name: "",
    kind: "product",
    pricing_mode: "unit",
    sku: "",
    barcode: generateEan13(),
    category: "",
    cost_price: 0,
    price: 0,
    weight_grams: 0,
    cost_per_gram: 0,
    price_per_gram: 0,
    supplier_id: null,
    active: true,
  };
}

/** What one unit costs / sells for, with the gram maths already applied. */
function effective(draft: Draft): { cost: number; price: number } {
  if (draft.pricing_mode === "gram") {
    const weight = draft.weight_grams ?? 0;
    return {
      cost: Math.round(weight * (draft.cost_per_gram ?? 0) * 100) / 100,
      price: Math.round(weight * (draft.price_per_gram ?? 0) * 100) / 100,
    };
  }
  return { cost: draft.cost_price ?? 0, price: draft.price ?? 0 };
}

export function StoreCatalogPanel({ stores, storeId }: { stores: Store[]; storeId: string }) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: products = [], isLoading } = useStoreProducts();
  const { data: suppliers = [] } = useSuppliers();
  const save = useSaveStoreProduct();
  const remove = useDeleteStoreProduct();
  const setStock = useSetStoreStock();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [labels, setLabels] = useState<LabelSpec[]>([]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter(
      (product) =>
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        (product.barcode ?? "").includes(needle) ||
        (product.sku ?? "").toLowerCase().includes(needle),
    );
  }, [products, search]);

  const stockOf = (product: StoreProduct) =>
    product.store_stock?.find((s) => s.store_id === storeId)?.quantity ?? 0;

  /**
   * Switching to a service FORCES cost and stock to zero rather than carrying
   * whatever was typed before the switch — otherwise it books phantom cost
   * against every sale of that service.
   */
  function setKind(kind: StoreProductKind) {
    if (!draft) return;
    setDraft(
      kind === "service"
        ? { ...draft, kind, pricing_mode: "unit", cost_price: 0, cost_per_gram: 0, weight_grams: 0 }
        : { ...draft, kind },
    );
  }

  function setMode(mode: PricingMode) {
    if (!draft) return;
    setDraft({ ...draft, pricing_mode: mode });
  }

  async function submit() {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error(t("posNameRequired"));
      return;
    }
    try {
      await save.mutateAsync({
        ...draft,
        name: draft.name.trim(),
        barcode: draft.barcode?.trim() || null,
        sku: draft.sku?.trim() || null,
        category: draft.category?.trim() || null,
      });
      toast.success(t("adminSaved"));
      setDraft(null);
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  // Catalogue rows are ON DELETE RESTRICT from transfer lines, so an item that
  // has ever been transferred cannot be removed. Deactivate it instead.
  async function drop(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch {
      toast.error(t("posItemDeleteBlocked"));
    }
  }

  async function correctStock(product: StoreProduct, quantity: number) {
    try {
      await setStock.mutateAsync({ storeId, productId: product.id, quantity });
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  function printLabels(list: StoreProduct[]) {
    const printable = list
      .filter((product) => product.barcode)
      .map((product) => ({
        code: product.barcode as string,
        name: product.name,
        price: formatPrice(product.effective_price),
      }));
    if (printable.length === 0) {
      toast.error(t("posNoBarcodes"));
      return;
    }
    setLabels(printable);
    // Let React paint the sheet before the print dialog snapshots the page.
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => setLabels([]), 500);
    });
  }

  const live = draft ? effective(draft) : null;
  const storeName = stores.find((s) => s.id === storeId)?.name ?? "";

  return (
    <div className="space-y-4">
      <BarcodeSheet labels={labels} />

      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("posCatalogue")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
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
          <Button size="sm" variant="outline" onClick={() => printLabels(rows)}>
            <Printer size={14} /> {t("posPrintLabels")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(blank())}>
            <Plus size={14} /> {t("add")}
          </Button>
        </div>
      </div>

      {draft && (
        <div className="print-hide space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("posItemName")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Select value={draft.kind ?? "product"} onChange={(e) => setKind(e.target.value as StoreProductKind)}>
              <option value="product">{t("posKindProduct")}</option>
              <option value="service">{t("posKindService")}</option>
            </Select>

            {draft.kind !== "service" && (
              <Select
                value={draft.pricing_mode ?? "unit"}
                onChange={(e) => setMode(e.target.value as PricingMode)}
              >
                <option value="unit">{t("posModeUnit")}</option>
                <option value="gram">{t("posModeGram")}</option>
              </Select>
            )}

            <Input
              placeholder={t("posCategory")}
              value={draft.category ?? ""}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </div>

          {draft.pricing_mode === "gram" && draft.kind !== "service" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-muted">{t("posWeightGrams")}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={draft.weight_grams ?? 0}
                  onChange={(e) => setDraft({ ...draft, weight_grams: Number(e.target.value) })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">{t("posCostPerGram")}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.cost_per_gram ?? 0}
                  onChange={(e) => setDraft({ ...draft, cost_per_gram: Number(e.target.value) })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">{t("posPricePerGram")}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.price_per_gram ?? 0}
                  onChange={(e) => setDraft({ ...draft, price_per_gram: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.kind !== "service" && (
                <label className="space-y-1">
                  <span className="text-xs text-muted">{t("finBuyPrice")}</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.cost_price ?? 0}
                    onChange={(e) => setDraft({ ...draft, cost_price: Number(e.target.value) })}
                  />
                </label>
              )}
              <label className="space-y-1">
                <span className="text-xs text-muted">{t("finSellPrice")}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.price ?? 0}
                  onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                />
              </label>
            </div>
          )}

          {/* The computed figures, live — the whole point of gram pricing is
              that the owner never does this arithmetic by hand. */}
          {live && (
            <div className="flex flex-wrap gap-4 rounded-lg border border-line bg-panel-2/40 px-4 py-3 text-sm">
              <span className="text-muted">
                {t("finBuyPrice")}: <Price className="text-ink" value={live.cost} />
              </span>
              <span className="text-muted">
                {t("finSellPrice")}: <Price className="text-ink" value={live.price} />
              </span>
              <span className={live.price - live.cost < 0 ? "text-red-500" : "text-emerald-500"}>
                {t("finProfit")}: <Price value={live.price - live.cost} />
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">{t("posBarcode")}</span>
              <div className="flex gap-2">
                <Input
                  dir="ltr"
                  value={draft.barcode ?? ""}
                  onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setDraft({ ...draft, barcode: generateEan13() })}
                >
                  <RefreshCw size={14} />
                </Button>
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">{t("finSupplier")}</span>
              <Select
                value={draft.supplier_id ?? ""}
                onChange={(e) => setDraft({ ...draft, supplier_id: e.target.value || null })}
              >
                <option value="">{t("finNoSupplier")}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {draft.barcode && (
            <div className="w-40 rounded-lg bg-white p-2">
              <Barcode code={draft.barcode} height={40} />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={draft.active ?? true}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            {t("posActive")}
          </label>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={save.isPending} onClick={submit}>
              {t("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              <X size={14} /> {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="print-hide overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posItemName")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posPricing")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finBuyPrice")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finSellPrice")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finMargin")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">
                {t("posStockIn")} {storeName}
              </th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => {
              const margin =
                product.effective_price > 0
                  ? (product.effective_price - product.effective_cost) / product.effective_price
                  : 0;
              return (
                <tr key={product.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="text-ink">{product.name}</span>
                    {!product.active && (
                      <span className="ms-2 rounded bg-panel-2 px-1.5 py-0.5 text-[0.6rem] uppercase text-muted">
                        {t("pixelPaused")}
                      </span>
                    )}
                    {product.barcode && (
                      <span dir="ltr" className="block font-mono text-[0.65rem] text-muted">
                        {product.barcode}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {product.kind === "service"
                      ? t("posKindService")
                      : product.pricing_mode === "gram"
                        ? `${product.weight_grams} g`
                        : t("posModeUnit")}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-muted">
                    <Price value={product.effective_cost} />
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-ink">
                    <Price value={product.effective_price} />
                  </td>
                  <td
                    dir="ltr"
                    className={`px-4 py-2.5 text-end tabular-nums ${
                      margin < 0 ? "font-medium text-red-500" : "text-muted"
                    }`}
                  >
                    {(margin * 100).toFixed(0)} %
                  </td>
                  <td className="px-4 py-2.5">
                    {product.kind === "service" ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        className="w-24 px-3 py-2"
                        defaultValue={stockOf(product)}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (next !== stockOf(product)) correctStock(product, next);
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => printLabels([product])}
                        aria-label={t("posPrintLabels")}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft({ ...product })}
                        aria-label={t("edit")}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => drop(product.id)}
                        aria-label={t("delete")}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
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
