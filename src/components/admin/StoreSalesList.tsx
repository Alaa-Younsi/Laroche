import { useMemo, useState } from "react";
import { FileText, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useDeleteStoreSale, useStoreInvoices } from "@/hooks/useStoreLedger";
import { Receipt } from "@/components/admin/Receipt";
import { Invoice } from "@/components/admin/Invoice";
import { SalePaymentDialog } from "@/components/admin/SalePaymentDialog";
import { Price } from "@/components/ui/Price";
import { formatPrice } from "@/lib/format";
import { inRange, toLocalDay, type DateRange } from "@/lib/finance";
import type { Store, StoreSale } from "@/types/db";

export function StoreSalesList({
  sales,
  store,
  range,
}: {
  sales: StoreSale[];
  store: Store | undefined;
  range: DateRange;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const remove = useDeleteStoreSale();
  const { data: invoices = [] } = useStoreInvoices();
  const [receipt, setReceipt] = useState<StoreSale | null>(null);
  const [invoiceSale, setInvoiceSale] = useState<StoreSale | null>(null);
  const [settleSale, setSettleSale] = useState<StoreSale | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const invoicedSaleIds = useMemo(() => new Set(invoices.map((i) => i.sale_id)), [invoices]);

  const rows = useMemo(
    () => sales.filter((sale) => inRange(toLocalDay(sale.sold_at), range)),
    [sales, range],
  );

  async function drop(id: string) {
    try {
      await remove.mutateAsync(id);
      toast.success(t("posSaleDeleted"));
    } catch {
      toast.error(t("adminDeleteError"));
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("posSales")}</h3>
      </div>

      <p className="rounded-lg border border-line bg-panel-2/40 px-4 py-3 text-xs text-muted">
        {t("posDeleteRestocksHint")}
      </p>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posReceiptNo")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finDate")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finCustomer")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finQty")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("cartTotal")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finProfit")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posPayment")}</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((sale) => {
              const units = (sale.store_sale_items ?? []).reduce((n, i) => n + i.quantity, 0);
              const profit = sale.total - sale.cost_total;
              return (
                <tr key={sale.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span dir="ltr" className="font-mono text-xs text-brand">
                      {sale.sale_number}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{sale.sold_at}</td>
                  <td className="px-4 py-2.5 text-ink">{sale.customer_name || "—"}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-muted">{units}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums text-ink">
                    <Price value={sale.total} />
                    {sale.balance_due > 0 && (
                      <button
                        type="button"
                        onClick={() => setSettleSale(sale)}
                        className="mt-0.5 block w-full text-end text-[0.65rem] font-medium text-amber-500 hover:underline"
                      >
                        {t("invBalanceDue")}: {formatPrice(sale.balance_due)}
                      </button>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-end tabular-nums ${
                      profit < 0 ? "text-red-500" : "text-emerald-500"
                    }`}
                  >
                    <Price value={profit} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {t(`posPay_${sale.payment_method}` as "posPay_cash")}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setReceipt(sale)}
                        aria-label={t("posReceipt")}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                      >
                        <ReceiptIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoiceSale(sale)}
                        aria-label={t("invGenerate")}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-panel-2 ${
                          invoicedSaleIds.has(sale.id) ? "text-brand" : "text-muted hover:text-ink"
                        }`}
                      >
                        <FileText size={14} />
                      </button>
                      {confirming === sale.id ? (
                        <button
                          type="button"
                          onClick={() => drop(sale.id)}
                          className="rounded-lg bg-red-600 px-2 text-[0.65rem] uppercase text-white"
                        >
                          {t("confirm")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(sale.id)}
                          aria-label={t("delete")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  {t("finNoData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Receipt
        open={receipt !== null}
        sale={receipt}
        store={store}
        onClose={() => setReceipt(null)}
      />

      <Invoice
        open={invoiceSale !== null}
        sale={invoiceSale}
        store={store}
        onClose={() => setInvoiceSale(null)}
      />

      <SalePaymentDialog
        open={settleSale !== null}
        sale={settleSale}
        onClose={() => setSettleSale(null)}
      />
    </div>
  );
}
