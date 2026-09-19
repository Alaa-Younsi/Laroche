import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DeliveryType, Order, OrderStatus, PaymentMethod } from "@/types/db";
import type { OrderStatusBoard } from "@/lib/orderStatus";

/** Most-recent orders. Capped (default 300) so the admin list/dashboard never
 * pull an unbounded table with every line joined — see useOrdersLedger's note
 * for the eventual server-side-pagination path. */
export function useOrders(statusFilter?: OrderStatus, limit = 300) {
  return useQuery({
    queryKey: ["orders", statusFilter, limit],
    queryFn: async (): Promise<Order[]> => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (statusFilter) query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return normalizeOrders(data ?? []);
    },
  });
}

export interface AdminOrderStats {
  orders_today: number;
  pending: number;
  revenue_total: number;
  revenue_30d: number;
}

/** Dashboard KPI cards — aggregated in SQL (get_admin_order_stats), not by
 * summing every row in the browser. */
export function useAdminOrderStats() {
  return useQuery({
    queryKey: ["admin-order-stats"],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminOrderStats> => {
      const { data, error } = await supabase.rpc("get_admin_order_stats");
      if (error) throw error;
      const d = (data ?? {}) as Partial<AdminOrderStats>;
      return {
        orders_today: Number(d.orders_today ?? 0),
        pending: Number(d.pending ?? 0),
        revenue_total: Number(d.revenue_total ?? 0),
        revenue_30d: Number(d.revenue_30d ?? 0),
      };
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["order", id],
    enabled: !!id,
    queryFn: async (): Promise<Order | null> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeOrders([data])[0] : null;
    },
  });
}

export interface ManualOrderInput {
  customer_name: string;
  customer_phone: string;
  wilaya: string;
  city: string;
  address?: string;
  notes?: string;
  delivery_type: DeliveryType;
  language: "fr" | "ar";
  payment_method: PaymentMethod;
  status: OrderStatus;
  /** Left blank → filled from the wilaya delivery grid server-side. */
  shipping?: number;
  discount?: number;
  items: Array<{ product_id: string; quantity: number; unit_price?: number }>;
}

/** Records an order taken off the website (Facebook, phone). Admin-only RPC —
 * server prices it, snapshots cost, decrements stock. */
export function useCreateManualOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManualOrderInput): Promise<string> => {
      const { items, ...order } = input;
      const { data, error } = await supabase.rpc("create_manual_order", {
        p_order: order,
        p_items: items,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// Normalize columns added by later migrations so the UI never has to
// null-check a jsonb column that might be missing on an older deployed DB.
function normalizeOrders(orders: Order[]): Order[] {
  return orders.map((order) => ({
    ...order,
    order_items: (order.order_items ?? []).map((item) => ({
      ...item,
      variants: item.variants ?? [],
    })),
  }));
}

/**
 * Count + money sitting in each status, aggregated in SQL across the WHOLE
 * orders table — deliberately not derived from the capped list, which would
 * silently under-report once the shop passes 300 orders.
 */
export function useOrderStatusBoard() {
  return useQuery({
    queryKey: ["order-status-board"],
    staleTime: 30_000,
    queryFn: async (): Promise<OrderStatusBoard> => {
      const { data, error } = await supabase.rpc("get_order_status_board");
      if (error) throw error;
      return (data ?? {}) as OrderStatusBoard;
    },
  });
}

/** Advance an order from the list without opening it. */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    // Refetch on failure too: the picker renders off the fetched row, so a
    // refused update must put it back on the status the order really has
    // rather than leave the UI showing one the database rejected.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-status-board"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });
    },
  });
}
