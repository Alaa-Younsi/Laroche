import { z } from "zod";

export const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().trim().regex(/^0[5-7][0-9]{8}$/, "invalid phone"),
  wilaya: z.string().trim().min(1),
  city: z.string().trim().min(1).max(80),
  // Optional — most COD couriers phone the customer, but a landmark/street helps.
  address: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  delivery_type: z.enum(["home", "office"]),
  payment_method: z.enum(["cod", "online"]).default("cod"),
  honeypot: z.string().optional(),
});

// Two faces of the same schema. `payment_method` has a .default(), so what the
// form holds before validation (input) has it optional while the validated
// payload (output) always has it. Mixing the two is what made zodResolver and
// useForm disagree — the form-facing props use Input, the submit path Values.
export type CheckoutFormInput = z.input<typeof checkoutSchema>;
export type CheckoutFormValues = z.output<typeof checkoutSchema>;
