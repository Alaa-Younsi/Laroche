import { useLanguage } from "@/i18n/LanguageProvider";
import { StatTile } from "@/components/admin/StatTile";
import type { Totals } from "@/lib/finance";

/**
 * The eight-tile P&L header, ordered the way the money actually moves —
 * revenue → COGS → gross → expenses → net → margin → sales → purchases — so it
 * reads as a statement instead of a tile hunt.
 */
export function LedgerSummary({
  totals,
  previous,
}: {
  totals: Totals;
  previous: Totals | null;
}) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label={t("finRevenue")} value={totals.revenue} previous={previous?.revenue} />
      <StatTile
        label={t("finCogs")}
        value={totals.cogs}
        previous={previous?.cogs}
        invertDelta
      />
      <StatTile
        label={t("finGrossProfit")}
        value={totals.grossProfit}
        previous={previous?.grossProfit}
        negative
      />
      <StatTile
        label={t("finExpenses")}
        value={totals.expenses}
        previous={previous?.expenses}
        invertDelta
      />
      <StatTile
        label={t("finNetProfit")}
        value={totals.netProfit}
        previous={previous?.netProfit}
        negative
        hint={t("finNetProfitHint")}
      />
      <StatTile label={t("finMargin")} value={totals.margin} previous={previous?.margin} percent />
      <StatTile
        label={t("finSalesCount")}
        value={totals.salesCount}
        previous={previous?.salesCount}
        count
      />
      <StatTile
        label={t("finPurchases")}
        value={totals.purchases}
        previous={previous?.purchases}
        invertDelta
        hint={t("finPurchasesHint")}
      />
    </div>
  );
}
