import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types/db";

export function useOrders(statusFilter?: OrderStatus) {
  return useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: async (): Promise<Order[]> => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (statusFilter) query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return normalizeOrders(data ?? []);
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
