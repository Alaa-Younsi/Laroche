import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { useOrdersLedger, ORDERS_LEDGER_CAP } from "@/hooks/useFinance";
import { useExpenses, usePurchases } from "@/hooks/useFinance";
import { LedgerSummary } from "@/components/admin/LedgerSummary";
import { RangeFilter } from "@/components/admin/RangeFilter";
import { SectionTabs, type TabDef } from "@/components/admin/SectionTabs";
import { TrendChart } from "@/components/admin/TrendChart";
import { ProductBreakdown, CustomerBreakdown } from "@/components/admin/Breakdowns";
import { ProductCostsPanel } from "@/components/admin/ProductCostsPanel";
import { PurchasesPanel } from "@/components/admin/PurchasesPanel";
import { ExpensesPanel } from "@/components/admin/ExpensesPanel";
import { SuppliersPanel } from "@/components/admin/SuppliersPanel";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  buildSeries,
  byCustomer,
  byProduct,
  computeTotals,
  downloadCsv,
  inRange,
  previousRange,
  rangeFor,
  toCsv,
  toLocalDay,
  type DateRange,
  type ExpenseFact,
  type PurchaseFact,
  type SaleFact,
} from "@/lib/finance";
import type { Order, Product } from "@/types/db";

type Tab = "overview" | "products" | "clients" | "costs" | "purchases" | "expenses" | "suppliers";

/**
 * On cash-on-delivery these are genuinely different businesses, so the owner
 * gets both rather than one hardcoded choice:
 *   booked    — everything not cancelled. The dispatcher's working view, and
 *               what the dashboard's existing revenue tile already counts.
 *   delivered — cash actually collected. The only figure that has really
 *               happened.
 */
type Basis = "booked" | "delivered";

function useAdminProducts() {
  return useQuery({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name_fr", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });
}

function orderToFact(order: Order): SaleFact {
  return {
    id: order.id,
    reference: order.order_number,
    day: toLocalDay(order.created_at),
    customerName: order.customer_name,
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    lines: (order.order_items ?? []).map((item) => ({
      itemKey: item.product_id ?? item.name_fr,
      itemName: item.name_fr,
      quantity: item.quantity,
      unitPrice: item.price,
      unitCost: item.unit_cost ?? 0,
    })),
  };
}

export default function Finance() {
  const { t } = useLanguage();
  const [range, setRange] = useState<DateRange>(() => rangeFor("month"));
  const [tab, setTab] = useState<Tab>("overview");
  const [basis, setBasis] = useState<Basis>("booked");

  const { data: orders = [], isLoading } = useOrdersLedger();
  const { data: products = [] } = useAdminProducts();
  const { data: expenses = [] } = useExpenses("online");
  const { data: purchases = [] } = usePurchases("online");

  const allFacts = useMemo(
    () =>
      orders
        .filter((order) =>
          basis === "delivered" ? order.status === "delivered" : order.status !== "cancelled",
        )
        .map(orderToFact),
    [orders, basis],
  );

  const expenseFacts = useMemo<ExpenseFact[]>(
    () =>
      expenses.map((expense) => ({
        id: expense.id,
        day: toLocalDay(expense.spent_at),
        label: expense.label,
        category: expense.category,
        amount: expense.amount,
      })),
    [expenses],
  );

  const purchaseFacts = useMemo<PurchaseFact[]>(
    () =>
      purchases.map((purchase) => ({
        id: purchase.id,
        day: toLocalDay(purchase.purchased_at),
        label: purchase.label,
        totalCost: purchase.total_cost,
      })),
    [purchases],
  );

  const scoped = useMemo(() => {
    const previous = previousRange(range);
    const pick = <T extends { day: string }>(rows: T[], r: DateRange | null) =>
      r ? rows.filter((row) => inRange(row.day, r)) : [];

    return {
      facts: range.from || range.to ? pick(allFacts, range) : allFacts,
      expenses: range.from || range.to ? pick(expenseFacts, range) : expenseFacts,
      purchases: range.from || range.to ? pick(purchaseFacts, range) : purchaseFacts,
      previous,
      prevFacts: pick(allFacts, previous),
      prevExpenses: pick(expenseFacts, previous),
      prevPurchases: pick(purchaseFacts, previous),
    };
  }, [allFacts, expenseFacts, purchaseFacts, range]);

  const totals = computeTotals(scoped.facts, scoped.expenses, scoped.purchases);
  const previousTotals = scoped.previous
    ? computeTotals(scoped.prevFacts, scoped.prevExpenses, scoped.prevPurchases)
    : null;

  const series = useMemo(
    () => buildSeries(scoped.facts, scoped.expenses, range),
    [scoped.facts, scoped.expenses, range],
  );
  const productRows = useMemo(() => byProduct(scoped.facts), [scoped.facts]);
  const customerRows = useMemo(() => byCustomer(scoped.facts), [scoped.facts]);

  function exportCsv() {
    downloadCsv(
      `finance-${range.from ?? "debut"}_${range.to ?? "fin"}.csv`,
      toCsv(
        [t("finProduct"), t("finQty"), t("finRevenue"), t("finCogs"), t("finProfit"), t("finMargin")],
        productRows.map((row) => [
          row.name,
          row.quantity,
          Math.round(row.revenue),
          Math.round(row.cost),
          Math.round(row.profit),
          `${(row.margin * 100).toFixed(0)} %`,
        ]),
      ),
    );
  }

  const tabs: Array<TabDef<Tab>> = [
    { key: "overview", label: t("finOverview") },
    { key: "products", label: t("finProducts") },
    { key: "clients", label: t("finClients") },
    { key: "costs", label: t("finCosts") },
    { key: "purchases", label: t("finPurchases") },
    { key: "expenses", label: t("finExpenses") },
    { key: "suppliers", label: t("finSuppliers") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">{t("adminFinance")}</h1>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download size={14} /> CSV
        </Button>
      </div>

      {orders.length >= ORDERS_LEDGER_CAP && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-400">
          {t("finLedgerCapped").replace("{n}", String(ORDERS_LEDGER_CAP))}
        </p>
      )}

      <RangeFilter range={range} onChange={setRange} />

      <div>
        <div className="inline-flex rounded-lg border border-line p-1">
          {(["booked", "delivered"] as Basis[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasis(key)}
              className={cn(
                "rounded-md px-4 py-2 text-xs uppercase tracking-wide2 transition-colors",
                basis === key ? "bg-brand/10 text-brand" : "text-muted hover:text-ink",
              )}
            >
              {t(key === "booked" ? "finBasisBooked" : "finBasisDelivered")}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {t(basis === "booked" ? "finBasisBookedHint" : "finBasisDeliveredHint")}
        </p>
      </div>

      <LedgerSummary totals={totals} previous={previousTotals} />

      <SectionTabs tabs={tabs} active={tab} onChange={setTab} />

      {isLoading && <p className="text-sm text-muted">{t("loading")}</p>}

      {tab === "overview" && <TrendChart points={series} />}
      {tab === "products" && <ProductBreakdown rows={productRows} />}
      {tab === "clients" && <CustomerBreakdown rows={customerRows} />}
      {tab === "costs" && <ProductCostsPanel products={products} />}
      {tab === "purchases" && (
        <PurchasesPanel
          scope="online"
          range={range}
          targets={products.map((product) => ({ id: product.id, name: product.name_fr }))}
        />
      )}
      {tab === "expenses" && <ExpensesPanel scope="online" range={range} />}
      {tab === "suppliers" && <SuppliersPanel />}
    </div>
  );
}
