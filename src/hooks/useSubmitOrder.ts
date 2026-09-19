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
  /** Required when the product has per-variant stock (0030) — the exact
   * combination whose stock place_order must decrement. */
  variant_id?: string | null;
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
      const orderNumber = data as string;

      // Best-effort, deliberately not awaited and never read. A notification
      // failure (bad key, Resend rate limit, function cold-start timeout) must
      // NEVER surface to the shopper or roll back an order that is already on
      // disk — this is presentation, not part of the transaction.
      void supabase.functions.invoke("notify", {
        body: { kind: "order", order_number: orderNumber },
      });

      return orderNumber;
    },
  });
}
