import { Link } from "react-router-dom";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { useCartStore } from "@/store/cart";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { lineTotal } from "@/lib/offers";

export function CartDrawer() {
  const { t, lang, dir } = useLanguage();
  const isOpen = useCartStore((s) => s.isOpen);
  const closeCart = useCartStore((s) => s.closeCart);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const side = dir === "rtl" ? "left" : "right";

  const subtotal = items.reduce(
    (sum, item) => sum + lineTotal(item.price, item.quantity, item.quantity_offers),
    0,
  );

  return (
    <Drawer open={isOpen} onClose={closeCart} side={side} title={t("cartTitle")}>
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <ShoppingBag size={40} className="text-muted" />
          <p className="text-muted">{t("cartEmpty")}</p>
          <Button onClick={closeCart} asChild>
            <Link to="/boutique">{t("cartEmptyCta")}</Link>
          </Button>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {items.map((item) => {
              const key = `${item.productId}-${item.color}-${item.size}-${item.variants
                .map((v) => v.value)
                .join(",")}`;
              const variantFields = [
                item.color,
                item.size,
                ...item.variants.map((v) => (lang === "ar" ? v.name_ar : v.name_fr) + ": " + v.value),
              ].filter(Boolean);

              return (
                <div key={key} className="flex gap-3 rounded-xl border border-line p-3">
                  <SmartImage
                    src={item.image ?? ""}
                    alt={lang === "ar" ? item.name_ar : item.name_fr}
                    width={72}
                    height={72}
                    sizes="72px"
                    className="h-18 w-18 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/produit/${item.slug}`}
                        onClick={closeCart}
                        className="text-sm font-medium text-ink hover:text-brand"
                      >
                        {lang === "ar" ? item.name_ar : item.name_fr}
                      </Link>
                      <button
                        onClick={() => removeItem(item.productId, item.color, item.size, item.variants)}
                        className="text-muted hover:text-red-500"
                        aria-label={t("cartRemove")}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    {variantFields.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted">{variantFields.join(" · ")}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-full border border-line px-2 py-1">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.color,
                              item.size,
                              item.variants,
                              item.quantity - 1,
                            )
                          }
                          disabled={item.quantity <= 1}
                          className="text-ink disabled:opacity-30"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-4 text-center text-xs">{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.productId,
                              item.color,
                              item.size,
                              item.variants,
                              item.quantity + 1,
                            )
                          }
                          disabled={item.quantity >= item.stock}
                          className="text-ink disabled:opacity-30"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <Price
                        value={lineTotal(item.price, item.quantity, item.quantity_offers)}
                        className="text-sm font-medium text-brand"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-line p-5">
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-muted">{t("cartSubtotal")}</span>
              <Price value={subtotal} className="font-medium text-ink" />
            </div>
            <Button className="w-full" size="lg" onClick={closeCart} asChild>
              <Link to="/checkout">{t("cartCheckout")}</Link>
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
