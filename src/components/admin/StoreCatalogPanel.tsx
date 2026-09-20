import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X, Printer, RefreshCw, Search, Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useStoreProducts,
  useSaveStoreProduct,
  useDeleteStoreProduct,
  useSetStoreStock,
  useSilverPools,
  useSilverPurchases,
  useAddSilverPurchase,
  useUpdateSilverPurchase,
  useDeleteSilverPurchase,
  storeErrorKey,
} from "@/hooks/useStoreLedger";
import { useSuppliers } from "@/hooks/useFinance";
import { generateEan13, isValidEan13 } from "@/lib/barcode";
import { Barcode, BarcodeSheet, type LabelSpec } from "@/components/admin/Barcode";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { formatPrice } from "@/lib/format";
import {
  SILVER_TYPES,
  type PricingMode,
  type SilverType,
  type Store,
  type StoreProduct,
  type StoreProductKind,
  type StoreSilverPurchase,
} from "@/types/db";

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

/**
 * Bulk silver, three grades (0027). The owner buys silver by total weight, not
 * as pieces, so the shop keeps a running gram balance (weighted-average cost)
 * per grade — Argent rhodié / Argent bataille / Argent local — instead of a
 * catalogue row per piece. Every weight sale of a grade at the till draws grams
 * out of that grade's pool. Pick a grade here to see and top up its stock.
 */
function SilverPoolCard({
  storeId,
  silverRows,
}: {
  storeId: string;
  silverRows: StoreProduct[];
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: pools = [] } = useSilverPools(storeId);
  const { data: purchases = [] } = useSilverPurchases(storeId);
  const addPurchase = useAddSilverPurchase();
  const updatePurchase = useUpdateSilverPurchase();
  const deletePurchase = useDeleteSilverPurchase();
  const saveProduct = useSaveStoreProduct();

  const [grade, setGrade] = useState<SilverType>(SILVER_TYPES[0]);
  const [grams, setGrams] = useState("");
  const [totalPaid, setTotalPaid] = useState("");
  const [note, setNote] = useState("");
  const [rate, setRate] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGrams, setEditGrams] = useState("");
  const [editTotalPaid, setEditTotalPaid] = useState("");
  const [editNote, setEditNote] = useState("");

  // Switching grade shows that grade's own rate again.
  useEffect(() => setRate(""), [grade]);

  const silverRow = silverRows.find((r) => r.silver_type === grade);
  const pool = pools.find((p) => p.silver_type === grade);
  const gramsOnHand = pool?.grams ?? 0;
  const avgCost = pool?.avg_cost_per_gram ?? 0;
  const gradePurchases = useMemo(
    () => purchases.filter((p) => p.silver_type === grade),
    [purchases, grade],
  );
  const totalValueAll = pools.reduce((sum, p) => sum + p.grams * p.avg_cost_per_gram, 0);
  const effectiveRate = rate !== "" ? Number(rate) : (silverRow?.price_per_gram ?? 0);

  async function submitPurchase() {
    const g = Number(grams);
    if (!g || g <= 0) {
      toast.error(t("posSilverGramsRequired"));
      return;
    }
    try {
      await addPurchase.mutateAsync({
        store_id: storeId,
        silver_type: grade,
        grams: g,
        total_cost: Number(totalPaid) || 0,
        note: note.trim() || undefined,
      });
      toast.success(t("posSilverPurchaseAdded"));
      setGrams("");
      setTotalPaid("");
      setNote("");
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  function startEdit(p: StoreSilverPurchase) {
    setEditingId(p.id);
    setEditGrams(String(p.grams));
    setEditTotalPaid(String(p.total_cost));
    setEditNote(p.note ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const g = Number(editGrams);
    if (!g || g <= 0) {
      toast.error(t("posSilverGramsRequired"));
      return;
    }
    try {
      await updatePurchase.mutateAsync({
        id: editingId,
        silver_type: purchases.find((p) => p.id === editingId)?.silver_type,
        grams: g,
        total_cost: Number(editTotalPaid) || 0,
        note: editNote.trim() || undefined,
      });
      toast.success(t("adminSaved"));
      setEditingId(null);
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  async function removePurchase(id: string) {
    try {
      await deletePurchase.mutateAsync(id);
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  async function saveRate() {
    if (!silverRow || rate === "" || Number(rate) === silverRow.price_per_gram) return;
    try {
      await saveProduct.mutateAsync({ id: silverRow.id, name: silverRow.name, price_per_gram: Number(rate) });
      toast.success(t("adminSaved"));
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  return (
    <div className="print-hide space-y-4 rounded-xl border border-brand/30 bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg text-ink">{t("posSilverPool")}</h3>
        <div className="flex items-center gap-2">
          {totalValueAll > 0 && (
            <span className="text-[0.7rem] text-muted">
              {t("posSilverValueAll")}: {formatPrice(Math.round(totalValueAll))}
            </span>
          )}
          <span className="rounded bg-brand/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide2 text-brand">
            925
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {silverRows.map((row) => {
          const isActive = row.silver_type === grade;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setGrade(row.silver_type as SilverType)}
              className={`rounded-lg border px-3 py-1.5 text-start text-sm transition ${
                isActive
                  ? "border-brand bg-brand/10 text-ink"
                  : "border-line text-muted hover:border-brand/50"
              }`}
            >
              <span className="block leading-tight">
                {t(`silverType_${row.silver_type}` as "silverType_local")}
              </span>
              {/* Each grade's own rate, on the button. Previously you had to
                  select a grade to read its rate in the field below, so the
                  three could never be compared — which is why the per-gram
                  pricing read as missing. */}
              <span dir="ltr" className="block text-[0.7rem] tabular-nums text-brand">
                {formatPrice(row.price_per_gram)}/g
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-panel-2/40 px-3 py-2">
          <div className="text-xs text-muted">{t("posSilverGramsOnHand")}</div>
          <div dir="ltr" className="text-lg font-medium tabular-nums text-ink">
            {gramsOnHand.toLocaleString("fr-DZ", { maximumFractionDigits: 2 })} g
          </div>
        </div>
        <div className="rounded-lg border border-line bg-panel-2/40 px-3 py-2">
          <div className="text-xs text-muted">{t("posSilverAvgCost")}</div>
          <Price value={avgCost} className="text-lg text-ink" />
        </div>
        <div className="rounded-lg border border-line bg-panel-2/40 px-3 py-2">
          <div className="text-xs text-muted">{t("posSilverValue")}</div>
          <Price value={Math.round(gramsOnHand * avgCost)} className="text-lg text-ink" />
        </div>
        <label className="rounded-lg border border-line bg-panel-2/40 px-3 py-2">
          <span className="text-xs text-muted">{t("posSilverRate")}</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            dir="ltr"
            className="mt-1 px-2 py-1"
            value={rate === "" ? String(silverRow?.price_per_gram ?? 0) : rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={saveRate}
            disabled={!silverRow}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
        <label className="space-y-1">
          <span className="text-xs text-muted">{t("posSilverGramsBought")}</span>
          <Input type="number" min={0} step="0.001" dir="ltr" value={grams}
            onChange={(e) => setGrams(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">{t("posSilverTotalPaid")}</span>
          <Input type="number" min={0} step="0.01" dir="ltr" value={totalPaid}
            onChange={(e) => setTotalPaid(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">{t("posSilverNote")}</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="flex items-end">
          <Button size="sm" disabled={addPurchase.isPending} onClick={submitPurchase}>
            <Plus size={14} /> {t("posSilverAddPurchase")}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted">{t("posSilverHint")}</p>

      {effectiveRate > 0 && avgCost > 0 && (
        <p className="text-xs text-muted">
          {t("finMargin")}:{" "}
          <span className={effectiveRate < avgCost ? "text-red-500" : "text-emerald-500"}>
            {(((effectiveRate - avgCost) / effectiveRate) * 100).toFixed(0)} %
          </span>
        </p>
      )}

      {gradePurchases.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="px-3 py-2 text-start">{t("finDate")}</th>
                <th className="px-3 py-2 text-end">{t("posSilverGramsBought")}</th>
                <th className="px-3 py-2 text-end">{t("posSilverTotalPaid")}</th>
                <th className="px-3 py-2 text-end">{t("posSilverAvgCost")}</th>
                <th className="px-3 py-2 text-start">{t("posSilverNote")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {gradePurchases.slice(0, 8).map((p) =>
                editingId === p.id ? (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-muted" dir="ltr">{p.purchased_at}</td>
                    <td className="px-3 py-2 text-end">
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        dir="ltr"
                        className="text-end"
                        value={editGrams}
                        onChange={(e) => setEditGrams(e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        dir="ltr"
                        className="text-end"
                        value={editTotalPaid}
                        onChange={(e) => setEditTotalPaid(e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-muted">
                      <Price value={p.cost_per_gram} />
                    </td>
                    <td className="px-3 py-2">
                      <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={updatePurchase.isPending}
                          aria-label={t("save")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          aria-label={t("cancel")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-muted" dir="ltr">{p.purchased_at}</td>
                    <td className="px-3 py-2 text-end tabular-nums text-ink" dir="ltr">{p.grams} g</td>
                    <td className="px-3 py-2 text-end tabular-nums text-ink">
                      <Price value={p.total_cost} />
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums text-muted">
                      <Price value={p.cost_per_gram} />
                    </td>
                    <td className="px-3 py-2 text-muted">{p.note ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          aria-label={t("edit")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePurchase(p.id)}
                          disabled={deletePurchase.isPending}
                          aria-label={t("delete")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted">{t("posSilverEmpty")}</p>
      )}
    </div>
  );
}

export function StoreCatalogPanel({ stores, storeId }: { stores: Store[]; storeId: string }) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: products = [], isLoading } = useStoreProducts();
  const { data: catalogPools = [] } = useSilverPools(storeId);
  const { data: suppliers = [] } = useSuppliers();

  // Cost basis per grade for THIS shop. store_products.cost_price is shared
  // across shops, but silver costs differ per shop (rhodié is 840.86/g in one
  // and 800/g in the other), so the buy price is derived per shop here rather
  // than stored — matching how the silver card already computes its margin.
  const costPerGramByGrade = useMemo(() => {
    const m = new Map<string, number>();
    for (const pool of catalogPools) m.set(pool.silver_type, pool.avg_cost_per_gram);
    return m;
  }, [catalogPools]);

  /** Buy price for a piece the owner priced with the silver calculator, or the
   *  stored cost when there is nothing to derive from. */
  function costOf(product: StoreProduct): { value: number; derived: boolean } {
    if (product.effective_cost > 0) return { value: product.effective_cost, derived: false };
    const grams = product.product?.weight_grams ?? null;
    const grade = product.product?.silver_type ?? null;
    if (!grams || !grade) return { value: product.effective_cost, derived: false };
    const rate = costPerGramByGrade.get(grade) ?? 0;
    if (rate <= 0) return { value: product.effective_cost, derived: false };
    return { value: Math.round(grams * rate * 100) / 100, derived: true };
  }
  const save = useSaveStoreProduct();
  const remove = useDeleteStoreProduct();
  const setStock = useSetStoreStock();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [labels, setLabels] = useState<LabelSpec[]>([]);

  const silverRows = useMemo(
    () =>
      SILVER_TYPES.map((st) =>
        products.find((p) => p.is_silver_pool && p.silver_type === st),
      ).filter((p): p is StoreProduct => Boolean(p)),
    [products],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter(
      (product) =>
        !product.is_silver_pool && // the bulk-silver row lives in its own card
        (!needle ||
          product.name.toLowerCase().includes(needle) ||
          (product.barcode ?? "").includes(needle) ||
          (product.sku ?? "").toLowerCase().includes(needle)),
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
    // A hand-edited barcode that fails EAN-13 validation renders as plain text
    // (see Barcode.tsx), not bars — printing it produces a label with nothing
    // for a scanner to read. Skip those rather than send an unscannable sheet.
    const invalidCount = list.filter(
      (product) => product.barcode && !isValidEan13(product.barcode),
    ).length;
    const printable = list
      .filter((product) => product.barcode && isValidEan13(product.barcode))
      .map((product) => ({
        code: product.barcode as string,
        name: product.name,
        price: formatPrice(product.effective_price),
      }));
    if (printable.length === 0) {
      toast.error(t("posNoBarcodes"));
      return;
    }
    if (invalidCount > 0) {
      toast.error(t("posBarcodeInvalidSkipped").replace("{n}", String(invalidCount)));
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

  const linkedOf = (draftRow: Draft | null) =>
    !!draftRow && (!!draftRow.product_id || !!draftRow.is_silver_pool);

  return (
    <div className="space-y-4">
      <BarcodeSheet labels={labels} />

      <SilverPoolCard storeId={storeId} silverRows={silverRows} />

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
          {linkedOf(draft) && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs text-muted">
              <span className="rounded bg-brand/15 px-2 py-0.5 font-semibold uppercase tracking-wide2 text-brand">
                {draft.is_silver_pool ? t("posSilverBadge") : t("posLinkedWeb")}
              </span>
              <span>{draft.is_silver_pool ? t("posSilverHint") : t("posLinkedWebHint")}</span>
              {draft.product_id && (
                <label className="ms-auto flex items-center gap-2 text-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={draft.price_custom ?? false}
                    onChange={(e) => setDraft({ ...draft, price_custom: e.target.checked })}
                  />
                  {t("posPriceCustom")}
                </label>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("posItemName")}
              value={draft.name}
              disabled={linkedOf(draft)}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Select
              value={draft.kind ?? "product"}
              disabled={linkedOf(draft)}
              onChange={(e) => setKind(e.target.value as StoreProductKind)}
            >
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
              {/* An invalid code renders as plain text with no bars (see Barcode.tsx) —
                  a printed label from it has nothing for a scanner to read. */}
              {draft.barcode && !isValidEan13(draft.barcode) && (
                <span className="text-xs text-red-500">{t("posBarcodeInvalid")}</span>
              )}
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
              const cost = costOf(product);
              const margin =
                product.effective_price > 0
                  ? (product.effective_price - cost.value) / product.effective_price
                  : 0;
              return (
                <tr key={product.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="text-ink">{product.name}</span>
                    {product.product_id && (
                      <span className="ms-2 rounded bg-brand/10 px-1.5 py-0.5 text-[0.6rem] uppercase text-brand">
                        {t("posLinkedWeb")}
                      </span>
                    )}
                    {product.product_id && product.price_custom && (
                      <span className="ms-1 rounded bg-panel-2 px-1.5 py-0.5 text-[0.6rem] uppercase text-muted">
                        {t("posPriceCustom")}
                      </span>
                    )}
                    {!product.active && (
                      <span className="ms-2 rounded bg-panel-2 px-1.5 py-0.5 text-[0.6rem] uppercase text-muted">
                        {t("pixelPaused")}
                      </span>
                    )}
                    {product.barcode && (
                      <span
                        dir="ltr"
                        className={`block font-mono text-[0.65rem] ${
                          isValidEan13(product.barcode) ? "text-muted" : "text-red-500"
                        }`}
                        title={isValidEan13(product.barcode) ? undefined : t("posBarcodeInvalid")}
                      >
                        {product.barcode}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {product.kind === "service" ? (
                      t("posKindService")
                    ) : product.pricing_mode === "gram" ? (
                      // The rate, not just the weight. Showing only "12.5 g" made
                      // per-gram pricing look absent from the one screen the
                      // client actually reads, so he asked for a feature that
                      // already existed in the silver panel.
                      <span className="flex flex-col leading-tight">
                        <span dir="ltr" className="tabular-nums text-ink">
                          {formatPrice(product.price_per_gram)}/g
                        </span>
                        {product.weight_grams > 0 && (
                          <span dir="ltr" className="tabular-nums text-[0.7rem]">
                            × {product.weight_grams} g
                          </span>
                        )}
                      </span>
                    ) : (
                      t("posModeUnit")
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-muted">
                    <Price value={cost.value} />
                    {cost.derived && (
                      // marked so a derived buy price is never mistaken for one
                      // the owner actually entered
                      <span
                        className="ms-1 text-[0.6rem] text-brand"
                        title={`${product.product?.weight_grams} g × ${formatPrice(
                          costPerGramByGrade.get(product.product?.silver_type ?? "") ?? 0,
                        )}/g`}
                      >
                        ~
                      </span>
                    )}
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
