import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types/db";
import { variantPickKey } from "@/lib/utils";

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (
    productId: string,
    color: string | null,
    size: string | null,
    variants: { name_fr: string; value: string }[],
  ) => void;
  updateQuantity: (
    productId: string,
    color: string | null,
    size: string | null,
    variants: { name_fr: string; value: string }[],
    quantity: number,
  ) => void;
  clear: () => void;
}

function identity(item: Pick<CartItem, "productId" | "color" | "size" | "variants">) {
  return `${item.productId}::${variantPickKey(item.color, item.size, item.variants)}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      addItem: (item) =>
        set((state) => {
          const key = identity(item);
          const existing = state.items.find((i) => identity(i) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                identity(i) === key
                  ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.stock) }
                  : i,
              ),
              isOpen: true,
            };
          }
          return { items: [...state.items, item], isOpen: true };
        }),
      removeItem: (productId, color, size, variants) =>
        set((state) => {
          const key = `${productId}::${variantPickKey(color, size, variants)}`;
          return { items: state.items.filter((i) => identity(i) !== key) };
        }),
      updateQuantity: (productId, color, size, variants, quantity) =>
        set((state) => {
          const key = `${productId}::${variantPickKey(color, size, variants)}`;
          return {
            items: state.items.map((i) =>
              identity(i) === key
                ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
                : i,
            ),
          };
        }),
      clear: () => set({ items: [] }),
    }),
    { name: "laroche-cart" },
  ),
);
