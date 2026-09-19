import type { OrderStatus } from "@/types/db";

/**
 * The order pipeline, in the sequence the shop actually works it.
 *
 * This is the ONLY place this order is defined — the board rail, the filter
 * picker, the per-row picker and the detail page all read it. Deriving it from
 * `Object.keys()` of some record instead gives you insertion order, which
 * drifts the first time someone edits that record.
 */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

/**
 * i18n key for a status label, so the desk never prints raw enum values.
 * The template-literal return type is what lets `t()` keep checking the key
 * against the translation table — widening it to `string` silently opts every
 * call site out of that.
 */
export function orderStatusKey(status: OrderStatus): `orderStatus_${OrderStatus}` {
  return `orderStatus_${status}`;
}

/**
 * Tailwind classes per status. Cancelled reads as a dead end and delivered as
 * done; the three live states stay on the brand palette so the eye tracks the
 * pipeline rather than a rainbow.
 */
export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  confirmed: "border-brand/40 bg-brand/10 text-brand",
  shipped: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  delivered: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "border-line bg-panel-2 text-muted",
};

export interface OrderStatusBucket {
  count: number;
  total: number;
}

export type OrderStatusBoard = Partial<Record<OrderStatus, OrderStatusBucket>>;
