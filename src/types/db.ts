export type Lang = "fr" | "ar";

export interface VariantGroup {
  name_fr: string;
  name_ar: string;
  values: string[];
}

export interface VariantPick {
  name_fr: string;
  name_ar: string;
  value: string;
}

export type QuantityOffer =
  | { type: "free"; buy: number; get: number }
  | { type: "price"; qty: number; price: number };

export interface Category {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  parent_id: string | null;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
}

/** A time-boxed % discount on a whole category and its sub-categories (0023). */
export interface CategoryPromotion {
  id: string;
  category_id: string;
  percent: number;
  starts_at: string;
  ends_at: string;
  label: string | null;
  created_at: string;
}

export interface ProductColor {
  label_fr: string;
  label_ar: string;
  hex: string;
  image_url: string | null;
}

export interface Product {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  description_fr: string;
  description_ar: string;
  details_fr: string[];
  details_ar: string[];
  price: number;
  compare_at_price: number | null;
  category_id: string;
  stock: number;
  style_code: string | null;
  material: string | null;
  warranty_fr: string | null;
  warranty_ar: string | null;
  colors: ProductColor[];
  sizes: string[];
  variants: VariantGroup[];
  quantity_offers: QuantityOffer[];
  video_url: string | null;
  featured: boolean;
  status: "active" | "draft";
  created_at: string;
  updated_at: string;
  product_images?: ProductImage[];
  category?: Category;
}

export type DeliveryType = "home" | "office";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "cod" | "online";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

export interface OrderItemVariantSnapshot {
  name_fr: string;
  name_ar: string;
  value: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name_fr: string;
  name_ar: string;
  price: number;
  quantity: number;
  color: string | null;
  size: string | null;
  variants: OrderItemVariantSnapshot[];
  image_url: string | null;
  /**
   * Buy price frozen at the moment of sale by a trigger (0019_business_suite).
   * Optional so the UI still renders against a DB that hasn't run that
   * migration yet.
   */
  unit_cost?: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  wilaya: string;
  city: string;
  address: string | null;
  notes: string | null;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: OrderStatus;
  language: Lang;
  delivery_type: DeliveryType;
  created_at: string;
  /** 'website' (place_order) or 'manual' (owner-entered Facebook/phone order,
   * 0024). Older rows default to 'website'. */
  source?: "website" | "manual";
  // Payment (0015_chargily_payments.sql). Older rows default to cod/unpaid.
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  chargily_checkout_id?: string | null;
  paid_at?: string | null;
  // ECOTRACK delivery (0013_ecotrack_tracking.sql) — null until shipped.
  ecotrack_tracking?: string | null;
  ecotrack_status?: string | null;
  ecotrack_synced_at?: string | null;
  order_items?: OrderItem[];
}

export interface StoreSettings {
  id: number;
  shipping_fee: number;
  free_ship_threshold: number | null;
}

export interface DeliveryPrice {
  id: string;
  wilaya: string;
  home_price: number;
  office_price: number;
  active: boolean;
  updated_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  active: boolean;
  created_at: string;
}

export interface ClientReview {
  id: string;
  client_name: string;
  stars: number;
  review_text: string;
  image_url: string | null;
  active: boolean;
  created_at: string;
}

// Staff accounts (0016_admin_permissions.sql). `sections` holds the section
// keys from src/lib/adminSections.ts; an owner implicitly has all of them.
export interface AdminProfile {
  user_id: string;
  email: string | null;
  is_owner: boolean;
  sections: string[];
  active: boolean;
  created_at: string;
}

// Meta pixels (0017_meta_pixels.sql).
export type PixelScope = "all" | "paths" | "products" | "landing";

export type PixelEventKey =
  | "page_view"
  | "view_content"
  | "add_to_cart"
  | "initiate_checkout"
  | "purchase"
  | "lead"
  | "search";

export type PixelEvents = Partial<Record<PixelEventKey, boolean>>;

export interface MetaPixel {
  id: string;
  label: string;
  pixel_id: string;
  active: boolean;
  scope: PixelScope;
  match_values: string[];
  events: PixelEvents;
  test_event_code: string | null;
  currency: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Business suite (0019/0020/0021) --------------------------------------

export type LedgerScope = "online" | "store";

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

/** Buy price for a WEBSITE product. A side table so `products` stays public. */
export interface ProductCost {
  product_id: string;
  cost_price: number;
  supplier_id: string | null;
  notes: string | null;
  updated_at: string;
}

export type ExpenseCategory =
  | "rent"
  | "salary"
  | "marketing"
  | "delivery"
  | "supplies"
  | "utilities"
  | "other";

export interface Expense {
  id: string;
  scope: LedgerScope;
  label: string;
  category: ExpenseCategory;
  amount: number;
  spent_at: string;
  supplier_id: string | null;
  store_id: string | null;
  paid_from_till: boolean;
  notes: string | null;
  created_at: string;
}

export interface StockPurchase {
  id: string;
  scope: LedgerScope;
  product_id: string | null;
  store_product_id: string | null;
  store_id: string | null;
  label: string;
  supplier_id: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchased_at: string;
  /** null until the owner explicitly counts it into stock. */
  applied_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Store {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface StoreMember {
  store_id: string;
  user_id: string;
  role: "seller" | "manager";
  created_at: string;
}

export type StoreProductKind = "product" | "service";
/** 'unit' → flat price (watches, accessories); 'gram' → weighed (silver 925). */
export type PricingMode = "unit" | "gram";

/** The three grades of bulk silver the shop buys and sells, each its own pool
 * and its own price per gram (0027). */
export type SilverType = "rhodie" | "bataille" | "local";
export const SILVER_TYPES: SilverType[] = ["rhodie", "bataille", "local"];

export interface StoreProduct {
  id: string;
  name: string;
  kind: StoreProductKind;
  pricing_mode: PricingMode;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  cost_price: number;
  price: number;
  weight_grams: number;
  cost_per_gram: number;
  price_per_gram: number;
  /** Generated: the gram maths already applied, so lists read one column. */
  effective_cost: number;
  effective_price: number;
  supplier_id: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Set when this row mirrors a website product (0022). Name/price follow the
   * website unless `price_custom` is on; the shop still owns its stock count. */
  product_id: string | null;
  price_custom: boolean;
  /** One of the three "Argent …" rows: sells from store_silver_pool by weight
   * instead of from a store_stock quantity. `silver_type` says which pool. */
  is_silver_pool: boolean;
  /** Set exactly when `is_silver_pool` is: the grade this row draws from. */
  silver_type: SilverType | null;
  /** Joined per-shop quantities, when the query asked for them. */
  store_stock?: StoreStock[];
}

/** Weighted-average bulk-silver balance for one shop and one grade (0022/0027). */
export interface StoreSilverPool {
  store_id: string;
  silver_type: SilverType;
  grams: number;
  avg_cost_per_gram: number;
  updated_at: string;
}

export interface StoreSilverPurchase {
  id: string;
  store_id: string;
  silver_type: SilverType;
  grams: number;
  total_cost: number;
  cost_per_gram: number;
  purchased_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StoreStock {
  store_id: string;
  store_product_id: string;
  quantity: number;
  updated_at: string;
}

export type StorePaymentMethod = "cash" | "card" | "transfer" | "other";

export interface StoreSaleItem {
  id: string;
  sale_id: string;
  store_product_id: string | null;
  name: string;
  kind: StoreProductKind;
  pricing_mode: PricingMode;
  weight_grams: number;
  unit_price: number;
  unit_cost: number;
  quantity: number;
  line_total: number;
}

export interface StoreSale {
  id: string;
  sale_number: string;
  store_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount: number;
  total: number;
  cost_total: number;
  payment_method: StorePaymentMethod;
  sold_at: string;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  store_sale_items?: StoreSaleItem[];
}

export type RefundMethod = StorePaymentMethod | "exchange";

export interface StoreReturnItem {
  id: string;
  return_id: string;
  store_product_id: string | null;
  name: string;
  weight_grams: number;
  unit_price: number;
  unit_cost: number;
  quantity: number;
  restock: boolean;
  line_total: number;
}

export interface StoreReturn {
  id: string;
  return_number: string;
  store_id: string;
  sale_id: string | null;
  customer_name: string | null;
  total: number;
  cost_total: number;
  refund_method: RefundMethod;
  reason: string | null;
  returned_at: string;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  store_return_items?: StoreReturnItem[];
}

export type TransferStatus = "pending" | "received" | "cancelled";

export interface StoreTransferItem {
  id: string;
  transfer_id: string;
  store_product_id: string;
  name: string;
  quantity: number;
  /** Silver lines move a weight, not a unit count (0027). 0 for unit lines. */
  weight_grams: number;
  /** Sending shop's average cost/gram, snapshotted for the receiver's blend. */
  unit_cost: number;
  /** Set only on a silver line: which grade's pool the grams move between. */
  silver_type: SilverType | null;
}

export interface StoreTransfer {
  id: string;
  transfer_number: string;
  from_store_id: string;
  to_store_id: string;
  status: TransferStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  received_by: string | null;
  received_at: string | null;
  store_transfer_items?: StoreTransferItem[];
}

export type CashMovementKind =
  | "sale"
  | "return"
  | "expense"
  | "deposit"
  | "withdrawal"
  | "adjustment";

export interface StoreCashMovement {
  id: string;
  store_id: string;
  kind: CashMovementKind;
  /** Signed: + into the till, − out of it. */
  amount: number;
  label: string | null;
  sale_id: string | null;
  return_id: string | null;
  expense_id: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
}

export interface CartVariantPick {
  name_fr: string;
  name_ar: string;
  value: string;
}

export interface CartItem {
  productId: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  price: number;
  compare_at_price: number | null;
  image: string | null;
  color: string | null;
  size: string | null;
  variants: CartVariantPick[];
  quantity: number;
  stock: number;
  quantity_offers: QuantityOffer[];
}
