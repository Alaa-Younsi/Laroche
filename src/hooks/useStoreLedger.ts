import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TranslationKey } from "@/i18n/translations";
import type {
  RefundMethod,
  Store,
  StoreCashMovement,
  StoreMember,
  StorePaymentMethod,
  StoreProduct,
  StoreReturn,
  StoreSale,
  StoreSilverPool,
  StoreSilverPurchase,
  StoreStock,
  StoreTransfer,
} from "@/types/db";

// Shops ----------------------------------------------------------------------

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: async (): Promise<Store[]> => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type StoreDraft = Partial<Store> & { name: string };

export function useSaveStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: StoreDraft) => {
      const { id, created_at: _c, ...values } = draft;
      const { error } = id
        ? await supabase.from("stores").update(values).eq("id", id)
        : await supabase.from("stores").insert(values);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stores"] }),
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stores"] }),
  });
}

export function useStoreMembers() {
  return useQuery({
    queryKey: ["store-members"],
    queryFn: async (): Promise<StoreMember[]> => {
      const { data, error } = await supabase.from("store_members").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetStoreMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { store_id: string; user_id: string; member: boolean }) => {
      const { store_id, user_id, member } = input;
      const { error } = member
        ? await supabase.from("store_members").upsert(
            { store_id, user_id },
            { onConflict: "store_id,user_id" },
          )
        : await supabase
            .from("store_members")
            .delete()
            .eq("store_id", store_id)
            .eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-members"] }),
  });
}

// Catalogue ------------------------------------------------------------------

/** The counter's catalogue with every shop's quantity joined on. */
export function useStoreProducts() {
  return useQuery({
    queryKey: ["store-products"],
    queryFn: async (): Promise<StoreProduct[]> => {
      const { data, error } = await supabase
        .from("store_products")
        .select("*, store_stock(*)")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, store_stock: row.store_stock ?? [] }));
    },
  });
}

export type StoreProductDraft = Partial<StoreProduct> & { name: string };

export function useSaveStoreProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: StoreProductDraft) => {
      // effective_cost/effective_price are GENERATED columns and store_stock is
      // a joined relation — PostgREST rejects the entire write if the payload
      // so much as names one of them.
      const {
        id,
        created_at: _c,
        updated_at: _u,
        effective_cost: _ec,
        effective_price: _ep,
        store_stock: _ss,
        ...values
      } = draft;
      const { error } = id
        ? await supabase.from("store_products").update(values).eq("id", id)
        : await supabase.from("store_products").insert(values);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-products"] }),
  });
}

export function useDeleteStoreProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-products"] }),
  });
}

export function useStoreStock() {
  return useQuery({
    queryKey: ["store-stock"],
    queryFn: async (): Promise<StoreStock[]> => {
      const { data, error } = await supabase.from("store_stock").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Manual correction after a physical inventory count. */
export function useSetStoreStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { storeId: string; productId: string; quantity: number }) => {
      const { error } = await supabase.rpc("set_store_stock", {
        p_store_id: input.storeId,
        p_product_id: input.productId,
        p_quantity: input.quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-stock"] });
      queryClient.invalidateQueries({ queryKey: ["store-products"] });
    },
  });
}

// Bulk silver (0022) -------------------------------------------------------

/** The running gram balance + weighted-avg cost for one shop. */
export function useSilverPool(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-silver-pool", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<StoreSilverPool | null> => {
      const { data, error } = await supabase
        .from("store_silver_pool")
        .select("*")
        .eq("store_id", storeId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSilverPurchases(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-silver-purchases", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<StoreSilverPurchase[]> => {
      const { data, error } = await supabase
        .from("store_silver_purchases")
        .select("*")
        .eq("store_id", storeId as string)
        .order("purchased_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddSilverPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      store_id: string;
      grams: number;
      total_cost: number;
      purchased_at?: string;
      note?: string;
    }) => {
      const { data, error } = await supabase.rpc("add_silver_purchase", { p: input });
      if (error) throw error;
      return data as { grams: number; avg_cost_per_gram: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-silver-pool"] });
      queryClient.invalidateQueries({ queryKey: ["store-silver-purchases"] });
    },
  });
}

export function useUpdateSilverPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      grams: number;
      total_cost: number;
      purchased_at?: string;
      note?: string;
    }) => {
      const { error } = await supabase.rpc("update_silver_purchase", { p: input });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-silver-pool"] });
      queryClient.invalidateQueries({ queryKey: ["store-silver-purchases"] });
    },
  });
}

export function useDeleteSilverPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_silver_purchase", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-silver-pool"] });
      queryClient.invalidateQueries({ queryKey: ["store-silver-purchases"] });
    },
  });
}

// Sales ----------------------------------------------------------------------

export function useStoreSales() {
  return useQuery({
    queryKey: ["store-sales"],
    staleTime: 30_000,
    queryFn: async (): Promise<StoreSale[]> => {
      const { data, error } = await supabase
        .from("store_sales")
        .select("*, store_sale_items(*)")
        .order("sold_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        store_sale_items: row.store_sale_items ?? [],
      }));
    },
  });
}

export interface SaleLinePayload {
  store_product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  /** Ad-hoc lines only; ignored by the RPC for catalogue lines. */
  unit_cost?: number;
  weight_grams?: number;
}

export interface CreateSalePayload {
  store_id: string;
  customer_name?: string;
  customer_phone?: string;
  payment_method: StorePaymentMethod;
  discount: number;
  sold_at?: string;
  notes?: string;
}

export interface CreateSaleResult {
  id: string;
  sale_number: string;
  subtotal: number;
  discount: number;
  total: number;
  cost_total: number;
}

export function useCreateStoreSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sale: CreateSalePayload;
      items: SaleLinePayload[];
    }): Promise<CreateSaleResult> => {
      const { data, error } = await supabase.rpc("create_store_sale", {
        sale: input.sale,
        items: input.items,
      });
      if (error) throw error;
      return data as CreateSaleResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-sales"] });
      // The RPC decremented catalogue stock and may have posted to the till.
      queryClient.invalidateQueries({ queryKey: ["store-products"] });
      queryClient.invalidateQueries({ queryKey: ["store-stock"] });
      queryClient.invalidateQueries({ queryKey: ["store-cash"] });
      queryClient.invalidateQueries({ queryKey: ["store-silver-pool"] });
    },
  });
}

/** Deleting the header cascades the lines, and a trigger restocks the units. */
export function useDeleteStoreSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-sales"] });
      queryClient.invalidateQueries({ queryKey: ["store-products"] });
      queryClient.invalidateQueries({ queryKey: ["store-stock"] });
      queryClient.invalidateQueries({ queryKey: ["store-cash"] });
      queryClient.invalidateQueries({ queryKey: ["store-silver-pool"] });
    },
  });
}

// Returns --------------------------------------------------------------------

export function useStoreReturns() {
  return useQuery({
    queryKey: ["store-returns"],
    queryFn: async (): Promise<StoreReturn[]> => {
      const { data, error } = await supabase
        .from("store_returns")
        .select("*, store_return_items(*)")
        .order("returned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        store_return_items: row.store_return_items ?? [],
      }));
    },
  });
}

export interface ReturnLinePayload {
  store_product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  weight_grams?: number;
  restock: boolean;
}

export function useCreateStoreReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ret: {
        store_id: string;
        sale_id?: string | null;
        customer_name?: string;
        refund_method: RefundMethod;
        reason?: string;
        returned_at?: string;
        notes?: string;
      };
      items: ReturnLinePayload[];
    }) => {
      const { data, error } = await supabase.rpc("create_store_return", {
        ret: input.ret,
        items: input.items,
      });
      if (error) throw error;
      return data as { id: string; return_number: string; total: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-returns"] });
      queryClient.invalidateQueries({ queryKey: ["store-products"] });
      queryClient.invalidateQueries({ queryKey: ["store-stock"] });
      queryClient.invalidateQueries({ queryKey: ["store-cash"] });
      queryClient.invalidateQueries({ queryKey: ["store-silver-pool"] });
    },
  });
}

// Transfers ------------------------------------------------------------------

export function useStoreTransfers() {
  return useQuery({
    queryKey: ["store-transfers"],
    queryFn: async (): Promise<StoreTransfer[]> => {
      const { data, error } = await supabase
        .from("store_transfers")
        .select("*, store_transfer_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        store_transfer_items: row.store_transfer_items ?? [],
      }));
    },
  });
}

export function useCreateStoreTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tr: { from_store_id: string; to_store_id: string; notes?: string };
      items: Array<{ store_product_id: string; quantity: number }>;
    }) => {
      const { data, error } = await supabase.rpc("create_store_transfer", {
        tr: input.tr,
        items: input.items,
      });
      if (error) throw error;
      return data as { id: string; transfer_number: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["store-products"] });
      queryClient.invalidateQueries({ queryKey: ["store-stock"] });
    },
  });
}

export function useResolveStoreTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; action: "receive" | "cancel" }) => {
      const fn = input.action === "receive" ? "receive_store_transfer" : "cancel_store_transfer";
      const { error } = await supabase.rpc(fn, { p_transfer_id: input.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["store-products"] });
      queryClient.invalidateQueries({ queryKey: ["store-stock"] });
    },
  });
}

// The till (caisse) ----------------------------------------------------------

export function useCashMovements() {
  return useQuery({
    queryKey: ["store-cash"],
    queryFn: async (): Promise<StoreCashMovement[]> => {
      const { data, error } = await supabase
        .from("store_cash_movements")
        .select("*")
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddCashMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      store_id: string;
      kind: "deposit" | "withdrawal" | "adjustment";
      /** Always positive here; the sign is applied from `kind`. */
      amount: number;
      label?: string;
      occurred_at?: string;
    }) => {
      const signed = input.kind === "withdrawal" ? -Math.abs(input.amount) : input.amount;
      const { error } = await supabase.from("store_cash_movements").insert({
        store_id: input.store_id,
        kind: input.kind,
        amount: signed,
        label: input.label ?? null,
        occurred_at: input.occurred_at,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-cash"] }),
  });
}

export function useDeleteCashMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_cash_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-cash"] }),
  });
}

/** Maps the RPCs' bare error codes onto translation keys. */
export function storeErrorKey(err: unknown): TranslationKey {
  const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  const code = /ERR_[A-Z_]+/.exec(message)?.[0];
  switch (code) {
    case "ERR_FORBIDDEN":
      return "storeErrForbidden";
    case "ERR_NO_STORE":
      return "storeErrNoStore";
    case "ERR_EMPTY_SALE":
      return "storeErrEmptySale";
    case "ERR_INVALID_QTY":
      return "storeErrInvalidQty";
    case "ERR_ITEM_NOT_FOUND":
      return "storeErrItemNotFound";
    case "ERR_OUT_OF_STOCK":
      return "storeErrOutOfStock";
    case "ERR_ALREADY_APPLIED":
      return "storeErrAlreadyApplied";
    case "ERR_SAME_STORE":
      return "storeErrSameStore";
    case "ERR_NOT_PENDING":
      return "storeErrNotPending";
    case "ERR_MISSING_TARGET":
      return "storeErrMissingTarget";
    default:
      return "storeErrGeneric";
  }
}
