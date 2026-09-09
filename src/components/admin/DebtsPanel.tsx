import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Wallet, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useStoreSales,
  useStoreDebts,
  useSaveStoreDebt,
  useDeleteStoreDebt,
  useAddDebtPayment,
  type StoreDebtDraft,
} from "@/hooks/useStoreLedger";
import { SalePaymentDialog } from "@/components/admin/SalePaymentDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPrice, formatDate } from "@/lib/format";
import type { Store, StoreDebt, StoreSale } from "@/types/db";

const EMPTY = (storeId: string): StoreDebtDraft => ({
  store_id: storeId,
  person_name: "",
  phone: "",
  description: "",
  amount: 0,
  due_date: null,
});

/** A small "Encaisser" dialog for a manual debt (not a sale) — amount plus an
 * optional "payé en espèces" checkbox, mirroring expenses' paid_from_till. */
function DebtPaymentDialog({
  open,
  onClose,
  debt,
}: {
  open: boolean;
  onClose: () => void;
  debt: StoreDebt | null;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const add = useAddDebtPayment();
  const [amount, setAmount] = useState("");
  const [paidFromTill, setPaidFromTill] = useState(true);

  if (!open || !debt) return null;

  async function submit() {
    if (!debt) return;
    const value = Number(amount);
    if (!value || value <= 0) return;
    try {
      await add.mutateAsync({ debt_id: debt.id, amount: value, paid_from_till: paidFromTill });
      toast.success(t("adminSaved"));
      setAmount("");
      onClose();
    } catch {
      toast.error(t("adminSaveError"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg text-ink">
            <Wallet size={16} className="text-brand" /> {t("posSettleBalance")}
          </h3>
          <button type="button" onClick={onClose} aria-label={t("close")} className="text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-muted">
          {debt.person_name} — {t("invBalanceDue")}: <span className="text-ink">{formatPrice(debt.balance_due)}</span>
        </p>
        <Input
          type="number"
          min={0}
          max={debt.balance_due}
          step="0.01"
          dir="ltr"
          placeholder={String(debt.balance_due)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={paidFromTill}
            onChange={(e) => setPaidFromTill(e.target.checked)}
          />
          {t("posDebtPaidFromTill")}
        </label>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={add.isPending || !Number(amount)} onClick={submit}>
            {add.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("posSettleBalance")}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DebtsPanel({ store }: { store: Store }) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: sales = [] } = useStoreSales();
  const { data: debts = [] } = useStoreDebts();
  const save = useSaveStoreDebt();
  const remove = useDeleteStoreDebt();

  const [draft, setDraft] = useState<StoreDebtDraft | null>(null);
  const [settleSale, setSettleSale] = useState<StoreSale | null>(null);
  const [settleDebt, setSettleDebt] = useState<StoreDebt | null>(null);

  const unpaidSales = useMemo(
    () => sales.filter((s) => s.store_id === store.id && s.balance_due > 0),
    [sales, store.id],
  );
  const storeDebts = useMemo(() => debts.filter((d) => d.store_id === store.id), [debts, store.id]);

  async function submitDebt() {
    if (!draft?.person_name.trim() || !draft.amount || draft.amount <= 0) {
      toast.error(t("posDebtInvalid"));
      return;
    }
    try {
      await save.mutateAsync({
        ...draft,
        person_name: draft.person_name.trim(),
        phone: draft.phone?.trim() || null,
        description: draft.description?.trim() || null,
      });
      toast.success(t("adminSaved"));
      setDraft(null);
    } catch {
      toast.error(t("adminSaveError"));
    }
  }

  async function dropDebt(id: string) {
    try {
      await remove.mutateAsync(id);
      toast.success(t("adminSaved"));
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-display text-xl text-ink">{t("posDebtsAutoTitle")}</h3>
        <p className="mb-3 text-xs text-muted">{t("posDebtsAutoHint")}</p>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="px-4 py-3 text-start">{t("posReceiptNo")}</th>
                <th className="px-4 py-3 text-start">{t("finCustomer")}</th>
                <th className="px-4 py-3 text-end">{t("cartTotal")}</th>
                <th className="px-4 py-3 text-end">{t("invAmountPaid")}</th>
                <th className="px-4 py-3 text-end">{t("invBalanceDue")}</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {unpaidSales.map((sale) => (
                <tr key={sale.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span dir="ltr" className="font-mono text-xs text-brand">{sale.sale_number}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink">{sale.customer_name || "—"}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-ink">{formatPrice(sale.total)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-muted">{formatPrice(sale.amount_paid)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums font-medium text-amber-500">
                    {formatPrice(sale.balance_due)}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <Button size="sm" variant="outline" onClick={() => setSettleSale(sale)}>
                      <Wallet size={13} /> {t("posSettleBalance")}
                    </Button>
                  </td>
                </tr>
              ))}
              {unpaidSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">{t("finNoData")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-display text-xl text-ink">{t("posDebtsManualTitle")}</h3>
          <Button size="sm" variant="outline" onClick={() => setDraft(EMPTY(store.id))}>
            <Plus size={14} /> {t("add")}
          </Button>
        </div>

        {draft && (
          <div className="mb-3 space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder={t("posDebtPerson")}
                value={draft.person_name}
                onChange={(e) => setDraft({ ...draft, person_name: e.target.value })}
              />
              <Input
                dir="ltr"
                placeholder={t("finPhone")}
                value={draft.phone ?? ""}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
              <Input
                placeholder={t("posDebtDescription")}
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                dir="ltr"
                placeholder={t("posDebtAmount")}
                value={draft.amount || ""}
                onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
              />
              <Input
                type="date"
                dir="ltr"
                value={draft.due_date ?? ""}
                onChange={(e) => setDraft({ ...draft, due_date: e.target.value || null })}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={save.isPending} onClick={submitDebt}>
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
                <th className="px-4 py-3 text-start">{t("posDebtPerson")}</th>
                <th className="px-4 py-3 text-start">{t("posDebtDescription")}</th>
                <th className="px-4 py-3 text-start">{t("finDate")}</th>
                <th className="px-4 py-3 text-end">{t("posDebtAmount")}</th>
                <th className="px-4 py-3 text-end">{t("invBalanceDue")}</th>
                <th className="w-32 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {storeDebts.map((debt) => (
                <tr key={debt.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-ink">
                    {debt.person_name}
                    {debt.phone && <span dir="ltr" className="ms-1.5 text-xs text-muted">({debt.phone})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{debt.description || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDate(debt.created_at)}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-ink">{formatPrice(debt.amount)}</td>
                  <td
                    className={`px-4 py-2.5 text-end tabular-nums font-medium ${
                      debt.settled ? "text-emerald-500" : "text-amber-500"
                    }`}
                  >
                    {debt.settled ? t("posDebtSettled") : formatPrice(debt.balance_due)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {!debt.settled && (
                        <Button size="sm" variant="outline" onClick={() => setSettleDebt(debt)}>
                          <Wallet size={13} />
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => dropDebt(debt.id)}
                        aria-label={t("delete")}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {storeDebts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">{t("posDebtsManualEmpty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SalePaymentDialog open={settleSale !== null} sale={settleSale} onClose={() => setSettleSale(null)} />
      <DebtPaymentDialog open={settleDebt !== null} debt={settleDebt} onClose={() => setSettleDebt(null)} />
    </div>
  );
}
