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
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
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
  colors: string[];
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

export interface ClientReview {
  id: string;
  client_name: string;
  stars: number;
  review_text: string;
  image_url: string | null;
  active: boolean;
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
