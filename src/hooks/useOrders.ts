import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DeliveryType, Order, OrderStatus, PaymentMethod } from "@/types/db";

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
