import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DeliveryPrice } from "@/types/db";

export function useDeliveryPrices(activeOnly = false) {
  return useQuery({
    queryKey: ["delivery-prices", activeOnly],
    queryFn: async (): Promise<DeliveryPrice[]> => {
      let query = supabase.from("delivery_prices").select("*").order("wilaya", { ascending: true });
      if (activeOnly) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
