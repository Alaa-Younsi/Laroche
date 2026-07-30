import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useOrders } from "@/hooks/useOrders";
import { exportOrdersToExcel } from "@/lib/exportOrders";
import { DeleteAllOrdersModal } from "@/components/admin/DeleteAllOrdersModal";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { formatDate } from "@/lib/format";
import type { OrderStatus } from "@/types/db";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export default function Orders() {
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const { data: orders = [], isLoading } = useOrders(statusFilter || undefined);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">{t("adminOrders")}</h1>
        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
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
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <BentoPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("orderNumber")}</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Client</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Wilaya</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("adminStatus")}</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Suivi</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("cartTotal")}</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0 hover:bg-panel-2/40">
                  <td className="whitespace-nowrap px-5 py-3">
                    <Link to={`/admin/commandes/${order.id}`} className="text-brand hover:underline">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">{order.customer_name}</td>
                  <td className="whitespace-nowrap px-5 py-3">{order.wilaya}</td>
                  <td className="whitespace-nowrap px-5 py-3 capitalize">{order.status}</td>
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
                </tr>
              ))}
              {orders.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted">
                    {t("adminNoOrders")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BentoPanel>

      <DeleteAllOrdersModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        orders={orders}
        onDeleted={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
      />
    </div>
  );
}
