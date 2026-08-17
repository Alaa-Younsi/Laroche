import { useLanguage } from "@/i18n/LanguageProvider";
import { Price } from "@/components/ui/Price";
import type { CustomerRow, ProductRow } from "@/lib/finance";

/**
 * Both tables get their OWN overflow-x-auto. Letting a wide table size the page
 * puts a horizontal scrollbar on the admin shell, which drags the sidebar and
 * header sideways with the content.
 */
function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function ProductBreakdown({ rows }: { rows: ProductRow[] }) {
  const { t } = useLanguage();

  if (rows.length === 0) {
    return <p className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-muted">{t("finNoData")}</p>;
  }

  return (
    <TableShell>
      <thead>
        <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
          <th className="whitespace-nowrap px-4 py-3 text-start">{t("finProduct")}</th>
          <th className="whitespace-nowrap px-4 py-3 text-end">{t("finQty")}</th>
          <th className="whitespace-nowrap px-4 py-3 text-end">{t("finRevenue")}</th>
          <th className="whitespace-nowrap px-4 py-3 text-end">{t("finCogs")}</th>
          <th className="whitespace-nowrap px-4 py-3 text-end">{t("finProfit")}</th>
          <th className="whitespace-nowrap px-4 py-3 text-end">{t("finMargin")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line last:border-0">
            <td className="px-4 py-2.5 text-ink">{row.name}</td>
            <td className="px-4 py-2.5 text-end tabular-nums text-muted">{row.quantity}</td>
            <td className="px-4 py-2.5 text-end tabular-nums text-ink">
              <Price value={row.revenue} />
            </td>
            <td className="px-4 py-2.5 text-end tabular-nums text-muted">
              <Price value={row.cost} />
            </td>
            <td
              className={`px-4 py-2.5 text-end tabular-nums ${row.profit < 0 ? "text-red-500" : "text-ink"}`}
            >
              <Price value={row.profit} />
            </td>
            <td
              className={`px-4 py-2.5 text-end tabular-nums ${row.margin < 0 ? "text-red-500" : "text-muted"}`}
              dir="ltr"
            >
              {(row.margin * 100).toFixed(0)} %
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

export function CustomerBreakdown({ rows }: { rows: CustomerRow[] }) {
  const { t } = useLanguage();

  if (rows.length === 0) {
    return <p className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-muted">{t("finNoData")}</p>;
  }

  return (
    <TableShell>
      <thead>
        <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
          <th className="whitespace-nowrap px-4 py-3 text-start">{t("finCustomer")}</th>
          <th className="whitespace-nowrap px-4 py-3 text-end">{t("finOrders")}</th>
          <th className="whitespace-nowrap px-4 py-3 text-end">{t("finRevenue")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-b border-line last:border-0">
            <td className="px-4 py-2.5 text-ink">{row.name}</td>
            <td className="px-4 py-2.5 text-end tabular-nums text-muted">{row.orders}</td>
            <td className="px-4 py-2.5 text-end tabular-nums text-ink">
              <Price value={row.revenue} />
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
