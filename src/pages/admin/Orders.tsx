import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useOrders } from "@/hooks/useOrders";
import { exportOrdersToExcel } from "@/lib/exportOrders";
import { DeleteOrdersModal, type DeleteScope } from "@/components/admin/DeleteOrdersModal";
import { ManualOrderModal } from "@/components/admin/ManualOrderModal";
import { PaymentBadge } from "@/components/admin/PaymentBadge";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { formatDate } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/db";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export default function Orders() {
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const { data: orders = [], isLoading } = useOrders(statusFilter || undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ scope: DeleteScope; orders: Order[] } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const queryClient = useQueryClient();

  // Rows can leave the list when the status filter changes, so intersect rather
  // than trusting the stored ids — otherwise "delete selected" could act on
  // orders the user can no longer see.
  const visibleIds = useMemo(() => new Set(orders.map((o) => o.id)), [orders]);
  const selectedOrders = useMemo(
    () => orders.filter((o) => selected.has(o.id)),
    [orders, selected],
  );
  const selectedCount = selectedOrders.length;
  const allSelected = orders.length > 0 && selectedCount === orders.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function afterDelete() {
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">{t("adminOrders")}</h1>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setManualOpen(true)}>
            <Plus size={14} /> {t("adminAddOrder")}
          </Button>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "");
              clearSelection();
            }}
            className="w-auto"
          >
            <option value="">{t("viewAll")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={orders.length === 0}
            onClick={() => exportOrdersToExcel(orders)}
          >
            <Download size={14} /> {t("adminExportExcel")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={orders.length === 0}
            title={t("adminDeleteAllOrders")}
            onClick={() => setPending({ scope: "all", orders })}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Selection bar. Sits above the table rather than floating over it so it
          can never cover the last row on a phone. */}
      {selectedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 px-4 py-3">
          <span className="text-sm text-ink">
            {selectedCount} {t("adminSelectedCount")}
          </span>
          <div className="flex flex-wrap items-center gap-2 ms-auto">
            <Button variant="outline" size="sm" onClick={() => exportOrdersToExcel(selectedOrders)}>
              <Download size={14} /> {t("adminExportExcel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setPending({ scope: "selection", orders: selectedOrders })}
            >
              <Trash2 size={14} /> {t("adminDeleteSelected")}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X size={14} /> {t("adminClearSelection")}
            </Button>
          </div>
        </div>
      )}

      <BentoPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={allSelected}
                    // Distinguishes "some" from "none"; without it a partial
                    // selection renders identically to an empty one.
                    ref={(el) => {
                      if (el) el.indeterminate = selectedCount > 0 && !allSelected;
                    }}
                    disabled={orders.length === 0}
                    onChange={toggleAll}
                    aria-label={t("adminSelectAll")}
                  />
                </th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("orderNumber")}</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Client</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Wilaya</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("adminStatus")}</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("adminPayment")}</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Suivi</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("cartTotal")}</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Date</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={`border-b border-line last:border-0 hover:bg-panel-2/40 ${
                    selected.has(order.id) ? "bg-brand/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={selected.has(order.id)}
                      onChange={() => toggleOne(order.id)}
                      aria-label={order.order_number}
                    />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <Link to={`/admin/commandes/${order.id}`} className="text-brand hover:underline">
                      {order.order_number}
                    </Link>
                    {order.source === "manual" && (
                      <span className="ms-2 rounded bg-brand/10 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide2 text-brand">
                        {t("orderSourceManual")}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">{order.customer_name}</td>
                  <td className="whitespace-nowrap px-5 py-3">{order.wilaya}</td>
                  <td className="whitespace-nowrap px-5 py-3 capitalize">{order.status}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <PaymentBadge method={order.payment_method} status={order.payment_status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    {order.ecotrack_tracking ? (
                      <span dir="ltr" className="font-mono text-xs text-brand">
                        {order.ecotrack_tracking}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <Price value={order.total} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setPending({ scope: "single", orders: [order] })}
                      title={t("adminDeleteOrder")}
                      aria-label={`${t("adminDeleteOrder")} ${order.order_number}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-muted">
                    {t("adminNoOrders")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BentoPanel>

      <DeleteOrdersModal
        open={pending !== null}
        scope={pending?.scope ?? "single"}
        orders={pending?.orders ?? []}
        onClose={() => setPending(null)}
        onDeleted={afterDelete}
      />

      <ManualOrderModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
      />
    </div>
  );
}
