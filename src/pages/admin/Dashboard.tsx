import { useLanguage } from "@/i18n/LanguageProvider";
import { useOrders, useAdminOrderStats } from "@/hooks/useOrders";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Price } from "@/components/ui/Price";

export default function Dashboard() {
  const { t } = useLanguage();
  const { hasSection } = useAdminProfile();
  // KPI cards are aggregated in SQL; the table only needs the latest handful.
  const { data: stats, isLoading: statsLoading } = useAdminOrderStats();
  const { data: orders = [], isLoading } = useOrders(undefined, 8);

  // The overview is visible to every admin, but its numbers all come from
  // orders — a worker without that section would otherwise stare at zeros and
  // assume the dashboard is broken. (RLS returns nothing to them either way.)
  const canSeeOrders = hasSection("orders");

  const cards: { label: string; value: number; isPrice?: boolean }[] = [
    { label: t("adminOrdersToday"), value: stats?.orders_today ?? 0 },
    { label: t("adminPendingOrders"), value: stats?.pending ?? 0 },
    { label: t("adminRevenue30d"), value: stats?.revenue_30d ?? 0, isPrice: true },
    { label: t("adminRevenueTotal"), value: stats?.revenue_total ?? 0, isPrice: true },
  ];

  if (!canSeeOrders) {
    return (
      <div>
        <h1 className="mb-8 font-display text-3xl text-ink">{t("adminDashboard")}</h1>
        <BentoPanel className="p-6">
          <p className="text-sm text-muted">{t("adminDashboardRestricted")}</p>
        </BentoPanel>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-8 font-display text-3xl text-ink">{t("adminDashboard")}</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <BentoPanel key={card.label} className="p-6">
            <p className="text-xs uppercase tracking-wide2 text-muted">{card.label}</p>
            <p className="mt-2 font-display text-3xl text-brand">
              {statsLoading ? (
                "…"
              ) : card.isPrice ? (
                <Price value={card.value} />
              ) : (
                card.value
              )}
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
                  <td className="whitespace-nowrap px-6 py-3">
                    <Price value={order.total} />
                  </td>
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
