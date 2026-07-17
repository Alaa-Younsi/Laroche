import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useOrders } from "@/hooks/useOrders";
import { formatPrice } from "@/lib/format";
import { BentoPanel } from "@/components/ui/BentoPanel";

export default function Dashboard() {
  const { t } = useLanguage();
  const { data: orders = [], isLoading } = useOrders();

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const ordersToday = orders.filter((o) => new Date(o.created_at).toDateString() === today);
    const pending = orders.filter((o) => o.status === "pending");
    const revenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);
    return { ordersToday: ordersToday.length, pending: pending.length, revenue };
  }, [orders]);

  const cards = [
    { label: t("adminOrdersToday"), value: stats.ordersToday },
    { label: t("adminPendingOrders"), value: stats.pending },
    { label: t("adminRevenueTotal"), value: formatPrice(stats.revenue) },
  ];

  return (
    <div>
      <h1 className="mb-8 font-display text-3xl text-ink">{t("adminDashboard")}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <BentoPanel key={card.label} className="p-6">
            <p className="text-xs uppercase tracking-wide2 text-muted">{card.label}</p>
            <p className="mt-2 font-display text-3xl text-brand">
              {isLoading ? "…" : card.value}
            </p>
          </BentoPanel>
        ))}
      </div>

      <BentoPanel className="mt-6 overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-display text-lg text-ink">{t("adminOrders")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-start text-xs uppercase tracking-wide2 text-muted">
                <th className="whitespace-nowrap px-6 py-3 text-start">{t("orderNumber")}</th>
                <th className="whitespace-nowrap px-6 py-3 text-start">Client</th>
                <th className="whitespace-nowrap px-6 py-3 text-start">{t("adminStatus")}</th>
                <th className="whitespace-nowrap px-6 py-3 text-start">{t("cartTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-6 py-3 text-brand">{order.order_number}</td>
                  <td className="whitespace-nowrap px-6 py-3">{order.customer_name}</td>
                  <td className="whitespace-nowrap px-6 py-3 capitalize">{order.status}</td>
                  <td className="whitespace-nowrap px-6 py-3">{formatPrice(order.total)}</td>
                </tr>
              ))}
              {orders.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted">
                    {t("adminNoOrders")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BentoPanel>
    </div>
  );
}
