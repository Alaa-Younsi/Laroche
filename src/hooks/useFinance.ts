import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Expense,
  LedgerScope,
  Order,
  ProductCost,
  StockPurchase,
  Supplier,
} from "@/types/db";

// Shared by both ledgers -----------------------------------------------------

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type SupplierDraft = Partial<Supplier> & { name: string };

export function useSaveSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: SupplierDraft) => {
      const { id, created_at: _created, ...values } = draft;
      const { error } = id
        ? await supabase.from("suppliers").update(values).eq("id", id)
        : await supabase.from("suppliers").insert(values);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function usePurchases(scope: LedgerScope) {
  return useQuery({
    queryKey: ["stock-purchases", scope],
    queryFn: async (): Promise<StockPurchase[]> => {
      const { data, error } = await supabase
        .from("stock_purchases")
        .select("*")
        .eq("scope", scope)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type PurchaseDraft = Partial<StockPurchase> & { scope: LedgerScope };

export function useSavePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: PurchaseDraft) => {
      // total_cost is a generated column — PostgREST rejects the whole write if
      // the payload so much as names it.
      const { id, created_at: _c, total_cost: _t, applied_at: _a, ...values } = draft;
      const { error } = id
        ? await supabase.from("stock_purchases").update(values).eq("id", id)
        : await supabase.from("stock_purchases").insert(values);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-purchases"] }),
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-purchases"] }),
  });
}

/**
 * Counting a purchase into stock is a SEPARATE action from saving it. Back-dated
 * paperwork for stock already on the shelf is the common case, and silently
 * re-adding it inflates the catalogue every time the owner catches up on
 * invoices. One extra click beats a wrong stock count.
 */
export function useApplyPurchaseToStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("apply_purchase_to_stock", { p_purchase_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      // Crosses features: the purchase list, both catalogues and the stock view.
      queryClient.invalidateQueries({ queryKey: ["stock-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["store-products"] });
      queryClient.invalidateQueries({ queryKey: ["store-stock"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useExpenses(scope: LedgerScope) {
  return useQuery({
    queryKey: ["expenses", scope],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("scope", scope)
        .order("spent_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ExpenseDraft = Partial<Expense> & { scope: LedgerScope };

export function useSaveExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: ExpenseDraft) => {
      const { id, created_at: _c, ...values } = draft;
      const { error } = id
        ? await supabase.from("expenses").update(values).eq("id", id)
        : await supabase.from("expenses").insert(values);
      if (error) throw error;
    },
    onSuccess: (_data, draft) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      // An expense paid out of the till posts a cash movement by trigger.
      if (draft.paid_from_till) {
        queryClient.invalidateQueries({ queryKey: ["store-cash"] });
      }
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["store-cash"] });
    },
  });
}

// Website side ---------------------------------------------------------------

/**
 * Every order with its lines, fetched ONCE and filtered in the browser. The
 * range control is flicked constantly while reading the dashboard, and one
 * cached fetch beats a round-trip per click at single-store volumes.
 * Revisit past a few thousand orders — at that point paginate server-side and
 * aggregate in SQL instead.
 */
/** Hard ceiling on the client-side ledger fetch. Past this the P&L page should
 * move to SQL aggregation; until then the UI shows a banner rather than
 * silently dropping old orders from the totals. */
export const ORDERS_LEDGER_CAP = 5000;

export function useOrdersLedger() {
  return useQuery({
    queryKey: ["orders-ledger"],
    staleTime: 60_000,
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(ORDERS_LEDGER_CAP);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProductCosts() {
  return useQuery({
    queryKey: ["product-costs"],
    queryFn: async (): Promise<ProductCost[]> => {
      const { data, error } = await supabase.from("product_costs").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * UPSERT, never update: products created before the backfill — or by a worker
 * holding only `products` — have no cost row yet.
 */
export function useSaveProductCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: {
      product_id: string;
      cost_price: number;
      supplier_id?: string | null;
    }) => {
      const { error } = await supabase
        .from("product_costs")
        .upsert(draft, { onConflict: "product_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["product-costs"] }),
  });
}
