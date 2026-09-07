import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useExpenses, usePurchases } from "@/hooks/useFinance";
import {
  useStores,
  useStoreProducts,
  useStoreSales,
  useStoreReturns,
} from "@/hooks/useStoreLedger";
import { LedgerSummary } from "@/components/admin/LedgerSummary";
import { RangeFilter } from "@/components/admin/RangeFilter";
import { SectionTabs, type TabDef } from "@/components/admin/SectionTabs";
import { TrendChart } from "@/components/admin/TrendChart";
import { ProductBreakdown, CustomerBreakdown } from "@/components/admin/Breakdowns";
import { StoreSalesPanel } from "@/components/admin/StoreSalesPanel";
import { StoreSalesList } from "@/components/admin/StoreSalesList";
import { StoreCatalogPanel } from "@/components/admin/StoreCatalogPanel";
import { ReturnsPanel } from "@/components/admin/ReturnsPanel";
import { TransfersPanel } from "@/components/admin/TransfersPanel";
import { ProformasPanel } from "@/components/admin/ProformasPanel";
import { CashPanel } from "@/components/admin/CashPanel";
import { StoresPanel } from "@/components/admin/StoresPanel";
import { PurchasesPanel } from "@/components/admin/PurchasesPanel";
import { ExpensesPanel } from "@/components/admin/ExpensesPanel";
import { SuppliersPanel } from "@/components/admin/SuppliersPanel";
import { Receipt } from "@/components/admin/Receipt";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
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
import type { StoreReturn, StoreSale } from "@/types/db";

type Tab =
  | "till"
  | "overview"
  | "sales"
  | "returns"
  | "catalogue"
  | "transfers"
  | "proformas"
  | "cash"
  | "products"
  | "clients"
  | "purchases"
  | "expenses"
  | "suppliers"
  | "stores";

function saleToFact(sale: StoreSale): SaleFact {
  return {
    id: sale.id,
    reference: sale.sale_number,
    day: toLocalDay(sale.sold_at),
    customerName: sale.customer_name ?? "",
    subtotal: sale.subtotal,
    discount: sale.discount,
    shipping: 0, // nothing is delivered from a counter
    lines: (sale.store_sale_items ?? []).map((item) => ({
      itemKey: item.store_product_id ?? item.name,
      itemName: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      unitCost: item.unit_cost,
    })),
  };
}

/**
 * A return enters the ledger as a NEGATIVE sale rather than as its own concept.
 * Revenue then nets out to "sales − refunds", COGS backs out the cost of the
 * returned pieces, and the per-product table reconciles — all without a second
 * code path through the engine.
 */
function returnToFact(ret: StoreReturn): SaleFact {
  return {
    id: ret.id,
    reference: ret.return_number,
    day: toLocalDay(ret.returned_at),
    customerName: ret.customer_name ?? "",
    subtotal: -ret.total,
    discount: 0,
    shipping: 0,
    lines: (ret.store_return_items ?? []).map((item) => ({
      itemKey: item.store_product_id ?? item.name,
      itemName: item.name,
      quantity: -item.quantity,
      unitPrice: item.unit_price,
      unitCost: item.unit_cost,
    })),
  };
}

export default function StoreLedger() {
  const { t } = useLanguage();
  const { isOwner } = useAdminProfile();
  const [range, setRange] = useState<DateRange>(() => rangeFor("month"));
  const [tab, setTab] = useState<Tab>("till");
  const [storeId, setStoreId] = useState("");
  // The receipt can only be built once the new sale has come back from the
  // refetch the RPC triggered, so hold its id and open on arrival.
  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<StoreSale | null>(null);

  const { data: stores = [], isLoading: storesLoading } = useStores();
  const { data: products = [] } = useStoreProducts();
  const { data: sales = [] } = useStoreSales();
  const { data: returns = [] } = useStoreReturns();
  const { data: expenses = [] } = useExpenses("store");
  const { data: purchases = [] } = usePurchases("store");

  // Default to the first shop the user can actually see, and re-pin if that
  // shop disappears (deactivated, or their membership was revoked).
  useEffect(() => {
    if (stores.length === 0) return;
    if (!storeId || !stores.some((store) => store.id === storeId)) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  useEffect(() => {
    if (!pendingReceiptId) return;
    const found = sales.find((sale) => sale.id === pendingReceiptId);
    if (found) {
      setReceiptSale(found);
      setPendingReceiptId(null);
    }
  }, [pendingReceiptId, sales]);

  const store = stores.find((s) => s.id === storeId);

  const facts = useMemo<SaleFact[]>(() => {
    if (!storeId) return [];
    return [
      ...sales.filter((sale) => sale.store_id === storeId).map(saleToFact),
      ...returns.filter((ret) => ret.store_id === storeId).map(returnToFact),
    ];
  }, [sales, returns, storeId]);

  const expenseFacts = useMemo<ExpenseFact[]>(
    () =>
      expenses
        // A shop-scoped expense with no shop set still belongs to the group, so
        // it is counted here rather than vanishing between the two ledgers.
        .filter((expense) => !expense.store_id || expense.store_id === storeId)
        .map((expense) => ({
          id: expense.id,
          day: toLocalDay(expense.spent_at),
          label: expense.label,
          category: expense.category,
          amount: expense.amount,
        })),
    [expenses, storeId],
  );

  const purchaseFacts = useMemo<PurchaseFact[]>(
    () =>
      purchases
        .filter((purchase) => !purchase.store_id || purchase.store_id === storeId)
        .map((purchase) => ({
          id: purchase.id,
          day: toLocalDay(purchase.purchased_at),
          label: purchase.label,
          totalCost: purchase.total_cost,
        })),
    [purchases, storeId],
  );

  const scoped = useMemo(() => {
    const previous = previousRange(range);
    const pick = <T extends { day: string }>(rows: T[], r: DateRange | null) =>
      r ? rows.filter((row) => inRange(row.day, r)) : [];
    const bounded = range.from || range.to;

    return {
      facts: bounded ? pick(facts, range) : facts,
      expenses: bounded ? pick(expenseFacts, range) : expenseFacts,
      purchases: bounded ? pick(purchaseFacts, range) : purchaseFacts,
      previous,
      prevFacts: pick(facts, previous),
      prevExpenses: pick(expenseFacts, previous),
      prevPurchases: pick(purchaseFacts, previous),
    };
  }, [facts, expenseFacts, purchaseFacts, range]);

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
      `magasin-${store?.name ?? ""}-${range.from ?? "debut"}_${range.to ?? "fin"}.csv`,
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
    { key: "till", label: t("posTillTab") },
    { key: "overview", label: t("finOverview") },
    { key: "sales", label: t("posSales") },
    { key: "returns", label: t("posReturns") },
    { key: "catalogue", label: t("posCatalogue") },
    { key: "transfers", label: t("posTransfers") },
    { key: "proformas", label: t("posProformaTab") },
    { key: "cash", label: t("posTill") },
    { key: "products", label: t("finProducts") },
    { key: "clients", label: t("finClients") },
    { key: "purchases", label: t("finPurchases") },
    { key: "expenses", label: t("finExpenses") },
    { key: "suppliers", label: t("finSuppliers") },
    { key: "stores", label: t("posStores") },
  ];

  // No shop, nothing to sell from. Send the owner straight to creating one
  // rather than showing eleven empty tabs.
  if (!storesLoading && stores.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl text-ink">{t("adminStore")}</h1>
        <StoresPanel stores={stores} isOwner={isOwner} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="print-hide flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">{t("adminStore")}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full sm:w-auto"
          >
            {stores.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>

      <div className="print-hide space-y-6">
        <RangeFilter range={range} onChange={setRange} />
        <LedgerSummary totals={totals} previous={previousTotals} />
        <SectionTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {store && (
        <>
          {tab === "till" && (
            <StoreSalesPanel store={store} onSold={setPendingReceiptId} />
          )}
          {tab === "overview" && <TrendChart points={series} />}
          {tab === "sales" && <StoreSalesList sales={sales.filter((s) => s.store_id === storeId)} store={store} range={range} />}
          {tab === "returns" && (
            <ReturnsPanel store={store} sales={sales} products={products} range={range} />
          )}
          {tab === "catalogue" && <StoreCatalogPanel stores={stores} storeId={storeId} />}
          {tab === "transfers" && (
            <TransfersPanel store={store} stores={stores} products={products} />
          )}
          {tab === "proformas" && <ProformasPanel store={store} />}
          {tab === "cash" && <CashPanel store={store} range={range} />}
          {tab === "products" && <ProductBreakdown rows={productRows} />}
          {tab === "clients" && <CustomerBreakdown rows={customerRows} />}
          {tab === "purchases" && (
            <PurchasesPanel
              scope="store"
              range={range}
              storeId={storeId}
              stores={stores.map((s) => ({ id: s.id, name: s.name }))}
              targets={products.map((product) => ({ id: product.id, name: product.name }))}
            />
          )}
          {tab === "expenses" && (
            <ExpensesPanel
              scope="store"
              range={range}
              storeId={storeId}
              stores={stores.map((s) => ({ id: s.id, name: s.name }))}
            />
          )}
          {tab === "suppliers" && <SuppliersPanel />}
          {tab === "stores" && <StoresPanel stores={stores} isOwner={isOwner} />}
        </>
      )}

      <Receipt
        open={receiptSale !== null}
        sale={receiptSale}
        store={store}
        onClose={() => setReceiptSale(null)}
      />
    </div>
  );
}
