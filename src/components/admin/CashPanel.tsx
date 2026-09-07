import { useMemo, useState } from "react";
import { Trash2, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useCashMovements,
  useAddCashMovement,
  useDeleteCashMovement,
} from "@/hooks/useStoreLedger";
import { StatTile } from "@/components/admin/StatTile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Price } from "@/components/ui/Price";
import { inRange, toLocalDay, type DateRange } from "@/lib/finance";
import type { Store } from "@/types/db";

/**
 * The shop's cash box. Sales and cash refunds post here automatically from the
 * RPCs, so the till can never disagree with the sales list; this screen only
 * adds the movements that have no document behind them — the opening float,
 * a cash drop to the bank, a correction after a count.
 */
export function CashPanel({ store, range }: { store: Store; range: DateRange }) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: movements = [] } = useCashMovements();
  const add = useAddCashMovement();
  const remove = useDeleteCashMovement();

  const [amount, setAmount] = useState(0);
  const [label, setLabel] = useState("");

  const mine = useMemo(
    () => movements.filter((m) => m.store_id === store.id),
    [movements, store.id],
  );

  // The balance is the running sum of EVERY movement ever, not just the ones in
  // the visible window — a till does not reset because the dashboard is showing
  // one week.
  const balance = useMemo(() => mine.reduce((sum, m) => sum + m.amount, 0), [mine]);

  const rows = useMemo(
    () => mine.filter((m) => inRange(toLocalDay(m.occurred_at), range)),
    [mine, range],
  );

  const periodIn = rows.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const periodOut = rows.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0);

  async function post(kind: "deposit" | "withdrawal") {
    if (!amount || amount <= 0) {
      toast.error(t("posAmountRequired"));
      return;
    }
    try {
      await add.mutateAsync({
        store_id: store.id,
        kind,
        amount,
        label: label.trim() || undefined,
      });
      setAmount(0);
      setLabel("");
      toast.success(t("adminSaved"));
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-brand" />
        <h3 className="font-display text-xl text-ink">
          {t("posTill")} — {store.name}
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label={t("posTillBalance")} value={balance} negative />
        <StatTile label={t("posCashIn")} value={periodIn} />
        <StatTile label={t("posCashOut")} value={periodOut} invertDelta />
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder={t("finAmount")}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <Input
          placeholder={t("posMovementLabel")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button size="sm" variant="outline" disabled={add.isPending} onClick={() => post("deposit")}>
          <ArrowDownCircle size={14} /> {t("posDeposit")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={add.isPending}
          onClick={() => post("withdrawal")}
        >
          <ArrowUpCircle size={14} /> {t("posWithdrawal")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finDate")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posMovementKind")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posMovementLabel")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finAmount")}</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{row.occurred_at}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {t(`posKind_${row.kind}` as "posKind_sale")}
                </td>
                <td className="px-4 py-2.5 text-ink">
                  <span dir={row.sale_id || row.return_id ? "ltr" : undefined}>
                    {row.label || "—"}
                  </span>
                </td>
                <td
                  className={`px-4 py-2.5 text-end tabular-nums ${
                    row.amount < 0 ? "text-red-500" : "text-emerald-500"
                  }`}
                >
                  <Price value={Math.abs(row.amount)} prefix={row.amount < 0 ? "−" : "+"} />
                </td>
                <td className="px-4 py-2.5">
                  {/* Only manual movements are removable: deleting the cash row
                      behind a sale would silently unbalance the till against
                      the sales list. Remove the sale instead. */}
                  {(row.kind === "deposit" ||
                    row.kind === "withdrawal" ||
                    row.kind === "adjustment") && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(row.id)}
                      aria-label={t("delete")}
                      className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
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
