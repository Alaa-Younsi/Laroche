import { useMemo, useState } from "react";
import { Plus, Trash2, X, PackageCheck, Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  usePurchases,
  useSavePurchase,
  useDeletePurchase,
  useApplyPurchaseToStock,
  useSuppliers,
  type PurchaseDraft,
} from "@/hooks/useFinance";
import { storeErrorKey } from "@/hooks/useStoreLedger";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { inRange, toLocalDay, type DateRange } from "@/lib/finance";
import type { LedgerScope } from "@/types/db";

interface TargetOption {
  id: string;
  name: string;
}

interface Props {
  scope: LedgerScope;
  range: DateRange;
  /** Products this purchase can be counted into (website or store catalogue). */
  targets: TargetOption[];
  /** Shops, for the store ledger — omitted on the website side. */
  stores?: TargetOption[];
  storeId?: string;
}

/**
 * Filtered to the dashboard's period, so the list always reconciles with the
 * totals above it.
 */
export function PurchasesPanel({ scope, range, targets, stores, storeId }: Props) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: all = [], isLoading } = usePurchases(scope);
  const { data: suppliers = [] } = useSuppliers();
  const save = useSavePurchase();
  const remove = useDeletePurchase();
  const apply = useApplyPurchaseToStock();
  const [draft, setDraft] = useState<PurchaseDraft | null>(null);

  const rows = useMemo(
    () => all.filter((p) => inRange(toLocalDay(p.purchased_at), range)),
    [all, range],
  );

  function blank(): PurchaseDraft {
    return {
      scope,
      label: "",
      quantity: 1,
      unit_cost: 0,
      purchased_at: toLocalDay(new Date()),
      supplier_id: null,
      product_id: null,
      store_product_id: null,
      store_id: scope === "store" ? (storeId ?? null) : null,
    };
  }

  async function submit() {
    if (!draft) return;
    try {
      await save.mutateAsync(draft);
      toast.success(t("adminSaved"));
      setDraft(null);
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  async function applyToStock(id: string) {
    try {
      await apply.mutateAsync(id);
      toast.success(t("finPurchaseApplied"));
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  const targetKey = scope === "online" ? "product_id" : "store_product_id";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("finPurchases")}</h3>
        <Button size="sm" variant="outline" onClick={() => setDraft(blank())}>
          <Plus size={14} /> {t("add")}
        </Button>
      </div>

      {draft && (
        <div className="space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("finPurchaseLabel")}
              value={draft.label ?? ""}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
            <Select
              value={(draft[targetKey] as string | null) ?? ""}
              onChange={(e) => setDraft({ ...draft, [targetKey]: e.target.value || null })}
            >
              <option value="">{t("finNoLinkedProduct")}</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </Select>
            {scope === "store" && stores && (
              <Select
                value={draft.store_id ?? ""}
                onChange={(e) => setDraft({ ...draft, store_id: e.target.value || null })}
              >
                <option value="">{t("finPickStore")}</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </Select>
            )}
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
            <Input
              type="number"
              min={0}
              step="0.001"
              placeholder={t("finQty")}
              value={draft.quantity ?? 0}
              onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder={t("finUnitCost")}
              value={draft.unit_cost ?? 0}
              onChange={(e) => setDraft({ ...draft, unit_cost: Number(e.target.value) })}
            />
            <Input
              type="date"
              value={draft.purchased_at ?? ""}
              onChange={(e) => setDraft({ ...draft, purchased_at: e.target.value })}
            />
          </div>
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

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finDate")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finPurchaseLabel")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finQty")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finUnitCost")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finTotal")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finStockStatus")}</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{row.purchased_at}</td>
                <td className="px-4 py-2.5 text-ink">{row.label || "—"}</td>
                <td className="px-4 py-2.5 text-end tabular-nums text-muted">{row.quantity}</td>
                <td className="px-4 py-2.5 text-end tabular-nums text-muted">
                  <Price value={row.unit_cost} />
                </td>
                <td className="px-4 py-2.5 text-end tabular-nums text-ink">
                  <Price value={row.total_cost} />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {row.applied_at ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                      <Check size={13} /> {t("finPurchaseCounted")}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={apply.isPending}
                      onClick={() => applyToStock(row.id)}
                    >
                      <PackageCheck size={13} /> {t("finApplyToStock")}
                    </Button>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => remove.mutate(row.id)}
                    aria-label={t("delete")}
                    className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
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
