import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { CheckoutFormValues } from "@/lib/checkoutSchema";
import type { Lang } from "@/types/db";

export interface OrderLineInput {
  product_id: string;
  quantity: number;
  color: string | null;
  size: string | null;
  variants: { name_fr: string; name_ar: string; value: string }[];
}

export function useSubmitOrder() {
  return useMutation({
    mutationFn: async (params: {
      items: OrderLineInput[];
      customer: CheckoutFormValues;
      lang: Lang;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc("place_order", {
        items: params.items,
        customer: { ...params.customer, language: params.lang },
      });
      if (error) throw error;
      return data as string;
    },
  });
}
