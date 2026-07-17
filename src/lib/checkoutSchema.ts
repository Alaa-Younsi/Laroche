import { z } from "zod";

export const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().trim().regex(/^0[5-7][0-9]{8}$/, "invalid phone"),
  wilaya: z.string().trim().min(1),
  city: z.string().trim().min(1).max(80),
  delivery_type: z.enum(["home", "office"]),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  honeypot: z.string().optional(),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
