import { useMemo, useState } from "react";
import { Plus, Trash2, Undo2, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useStoreReturns,
  useCreateStoreReturn,
  storeErrorKey,
  type ReturnLinePayload,
} from "@/hooks/useStoreLedger";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { inRange, toLocalDay, type DateRange } from "@/lib/finance";
import type { RefundMethod, Store, StoreProduct, StoreSale } from "@/types/db";

interface DraftLine {
  key: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  weightGrams: number;
  restock: boolean;
}

let seq = 0;

export function ReturnsPanel({
  store,
  sales,
  products,
  range,
}: {
  store: Store;
  sales: StoreSale[];
  products: StoreProduct[];
  range: DateRange;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: returns = [] } = useStoreReturns();
  const create = useCreateStoreReturn();

  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [refund, setRefund] = useState<RefundMethod>("cash");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const rows = useMemo(
    () =>
      returns.filter(
        (row) => row.store_id === store.id && inRange(toLocalDay(row.returned_at), range),
      ),
    [returns, store.id, range],
  );

  const storeSales = useMemo(
    () => sales.filter((sale) => sale.store_id === store.id).slice(0, 200),
    [sales, store.id],
  );

  /**
   * Picking the original receipt pre-fills the lines at the price actually
   * paid. Re-keying a return by hand is where refunds drift from the sale that
   * caused them.
   */
  function loadSale(id: string) {
    setSaleId(id);
    const sale = storeSales.find((s) => s.id === id);
    if (!sale) return;
    setCustomerName(sale.customer_name ?? "");
    setLines(
      (sale.store_sale_items ?? []).map((item) => ({
        key: `r${seq++}`,
        productId: item.store_product_id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        weightGrams: item.weight_grams,
        restock: true,
      })),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: `r${seq++}`,
        productId: null,
        name: "",
        quantity: 1,
        unitPrice: 0,
        weightGrams: 0,
        restock: true,
      },
    ]);
  }

  function patch(key: string, changes: Partial<DraftLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  function reset() {
    setOpen(false);
    setSaleId("");
    setCustomerName("");
    setReason("");
    setRefund("cash");
    setLines([]);
  }

  async function submit() {
    if (lines.length === 0) {
      toast.error(t("storeErrEmptySale"));
      return;
    }
    const payload: ReturnLinePayload[] = lines.map((line) => ({
      store_product_id: line.productId,
      name: line.name.trim() || "—",
      quantity: line.quantity,
      unit_price: line.unitPrice,
      weight_grams: line.weightGrams,
      restock: line.restock,
    }));
    try {
      const result = await create.mutateAsync({
        ret: {
          store_id: store.id,
          sale_id: saleId || null,
          customer_name: customerName.trim() || undefined,
          refund_method: refund,
          reason: reason.trim() || undefined,
        },
        items: payload,
      });
      toast.success(`${t("posReturnRecorded")} — ${result.return_number}`);
      reset();
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("posReturns")}</h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Undo2 size={14} /> {t("posNewReturn")}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={saleId} onChange={(e) => loadSale(e.target.value)}>
              <option value="">{t("posReturnNoReceipt")}</option>
              {storeSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.sale_number} — {sale.sold_at}
                </option>
              ))}
            </Select>
            <Input
              placeholder={t("posCustomerName")}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Select value={refund} onChange={(e) => setRefund(e.target.value as RefundMethod)}>
              <option value="cash">{t("posPay_cash")}</option>
              <option value="card">{t("posPay_card")}</option>
              <option value="transfer">{t("posPay_transfer")}</option>
              <option value="exchange">{t("posRefundExchange")}</option>
              <option value="other">{t("posPay_other")}</option>
            </Select>
            <Input
              placeholder={t("posReturnReason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_auto_auto]">
                {line.productId ? (
                  <div className="flex items-center px-1 text-sm text-ink">{line.name}</div>
                ) : (
                  <Select
                    value=""
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value);
                      if (product) {
                        patch(line.key, {
                          productId: product.id,
                          name: product.name,
                          unitPrice: product.effective_price,
                          weightGrams: product.weight_grams,
                        });
                      }
                    }}
                  >
                    <option value="">{t("posPickItem")}</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => patch(line.key, { quantity: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) => patch(line.key, { unitPrice: Number(e.target.value) })}
                />
                <label className="flex items-center gap-2 whitespace-nowrap px-1 text-xs text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={line.restock}
                    onChange={(e) => patch(line.key, { restock: e.target.checked })}
                  />
                  {t("posRestock")}
                </label>
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  aria-label={t("delete")}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus size={14} /> {t("add")}
            </Button>
          </div>

          <p className="text-xs text-muted">{t("posRestockHint")}</p>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <span className="font-display text-lg text-ink">
              {t("finTotal")}: <Price value={total} />
            </span>
            <div className="flex gap-2 ms-auto">
              <Button size="sm" disabled={create.isPending} onClick={submit}>
                {t("save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                <X size={14} /> {t("cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posReturnNo")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finDate")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finCustomer")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posReturnReason")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span dir="ltr" className="font-mono text-xs text-brand">
                    {row.return_number}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{row.returned_at}</td>
                <td className="px-4 py-2.5 text-ink">{row.customer_name || "—"}</td>
                <td className="px-4 py-2.5 text-muted">{row.reason || "—"}</td>
                <td className="px-4 py-2.5 text-end tabular-nums text-red-500">
                  <Price value={row.total} prefix="−" />
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
