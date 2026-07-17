import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { StoreSettings } from "@/types/db";

export function useStoreSettings() {
  return useQuery({
    queryKey: ["store-settings"],
    queryFn: async (): Promise<StoreSettings> => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mirrors the exact free-shipping rule place_order applies server-side —
 * used by Checkout/InlineCheckout so the displayed total never diverges
 * from what the RPC actually charges. `null` means "no wilaya picked yet".
 */
export function resolveShipping(
  wilayaFee: number | null,
  goodsTotalAfterDiscounts: number,
  settings: StoreSettings | undefined,
): number | null {
  if (wilayaFee === null) return null;
  if (
    settings?.free_ship_threshold != null &&
    goodsTotalAfterDiscounts >= settings.free_ship_threshold
  ) {
    return 0;
  }
  return wilayaFee;
}
