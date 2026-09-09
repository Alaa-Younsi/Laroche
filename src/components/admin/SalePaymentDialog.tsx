import { useEffect, useState } from "react";
import { Loader2, Wallet, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useRecordSalePayment, storeErrorKey } from "@/hooks/useStoreLedger";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatPrice } from "@/lib/format";
import type { StorePaymentMethod, StoreSale } from "@/types/db";

/** "Encaisser" dialog — settles (part of) a Versement sale's remaining
 * balance (0031). Shared by the Ventes list badge and the Dettes tab. */
export function SalePaymentDialog({
  open,
  onClose,
  sale,
}: {
  open: boolean;
  onClose: () => void;
  sale: StoreSale | null;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const record = useRecordSalePayment();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<StorePaymentMethod>("cash");

  useEffect(() => {
    if (open && sale) {
      setAmount(String(Math.max(sale.balance_due, 0)));
      setMethod("cash");
    }
  }, [open, sale]);

  if (!open || !sale) return null;

  async function submit() {
    if (!sale) return;
    const value = Number(amount);
    if (!value || value <= 0) return;
    try {
      await record.mutateAsync({ sale_id: sale.id, amount: value, method });
      toast.success(t("adminSaved"));
      onClose();
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
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
          {sale.sale_number} — {t("invBalanceDue")}: <span className="text-ink">{formatPrice(sale.balance_due)}</span>
        </p>

        <Input
          type="number"
          min={0}
          max={sale.balance_due}
          step="0.01"
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Select value={method} onChange={(e) => setMethod(e.target.value as StorePaymentMethod)}>
          <option value="cash">{t("posPay_cash")}</option>
          <option value="card">{t("posPay_card")}</option>
          <option value="transfer">{t("posPay_transfer")}</option>
          <option value="other">{t("posPay_other")}</option>
        </Select>

        <div className="flex gap-2">
          <Button className="flex-1" disabled={record.isPending || !Number(amount)} onClick={submit}>
            {record.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
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
