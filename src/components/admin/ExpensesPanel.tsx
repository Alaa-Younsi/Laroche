import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useExpenses,
  useSaveExpense,
  useDeleteExpense,
  useSuppliers,
  type ExpenseDraft,
} from "@/hooks/useFinance";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { inRange, toLocalDay, type DateRange } from "@/lib/finance";
import type { ExpenseCategory, LedgerScope } from "@/types/db";
import type { TranslationKey } from "@/i18n/translations";

const CATEGORIES: Array<{ key: ExpenseCategory; labelKey: TranslationKey }> = [
  { key: "rent", labelKey: "finCatRent" },
  { key: "salary", labelKey: "finCatSalary" },
  { key: "marketing", labelKey: "finCatMarketing" },
  { key: "delivery", labelKey: "finCatDelivery" },
  { key: "supplies", labelKey: "finCatSupplies" },
  { key: "utilities", labelKey: "finCatUtilities" },
  { key: "other", labelKey: "finCatOther" },
];

interface Props {
  scope: LedgerScope;
  range: DateRange;
  stores?: Array<{ id: string; name: string }>;
  storeId?: string;
}

/** Scoped by `scope` and filtered to the dashboard's period. */
export function ExpensesPanel({ scope, range, stores, storeId }: Props) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: all = [], isLoading } = useExpenses(scope);
  const { data: suppliers = [] } = useSuppliers();
  const save = useSaveExpense();
  const remove = useDeleteExpense();
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);

  const rows = useMemo(
    () => all.filter((e) => inRange(toLocalDay(e.spent_at), range)),
    [all, range],
  );

  function blank(): ExpenseDraft {
    return {
      scope,
      label: "",
      category: "other",
      amount: 0,
      spent_at: toLocalDay(new Date()),
      supplier_id: null,
      store_id: scope === "store" ? (storeId ?? null) : null,
      paid_from_till: false,
    };
  }

  async function submit() {
    if (!draft) return;
    if (!draft.label?.trim()) {
      toast.error(t("finExpenseLabelRequired"));
      return;
    }
    try {
      await save.mutateAsync({ ...draft, label: draft.label.trim() });
      toast.success(t("adminSaved"));
      setDraft(null);
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  const labelOf = (key: ExpenseCategory) =>
    t(CATEGORIES.find((c) => c.key === key)?.labelKey ?? "finCatOther");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("finExpenses")}</h3>
        <Button size="sm" variant="outline" onClick={() => setDraft(blank())}>
          <Plus size={14} /> {t("add")}
        </Button>
      </div>

      {draft && (
        <div className="space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("finExpenseLabel")}
              value={draft.label ?? ""}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
            <Select
              value={draft.category ?? "other"}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as ExpenseCategory })
              }
            >
              {CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {t(category.labelKey)}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder={t("finAmount")}
              value={draft.amount ?? 0}
              onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
            />
            <Input
              type="date"
              value={draft.spent_at ?? ""}
              onChange={(e) => setDraft({ ...draft, spent_at: e.target.value })}
            />
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
          </div>

          {scope === "store" && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={draft.paid_from_till ?? false}
                onChange={(e) => setDraft({ ...draft, paid_from_till: e.target.checked })}
              />
              {t("finPaidFromTill")}
            </label>
          )}

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
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finExpenseLabel")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finCategory")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finAmount")}</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{row.spent_at}</td>
                <td className="px-4 py-2.5 text-ink">
                  {row.label}
                  {row.paid_from_till && (
                    <span className="ms-2 rounded bg-panel-2 px-1.5 py-0.5 text-[0.6rem] uppercase text-muted">
                      {t("finTill")}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {labelOf(row.category)}
                </td>
                <td className="px-4 py-2.5 text-end tabular-nums text-ink">
                  <Price value={row.amount} />
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
