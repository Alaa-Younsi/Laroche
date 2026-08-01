import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShoppingBag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCartStore } from "@/store/cart";
import { useStoreSettings, resolveShipping } from "@/hooks/useStoreSettings";
import { useDeliveryPrices } from "@/hooks/useDeliveryPrices";
import { useSubmitOrder } from "@/hooks/useSubmitOrder";
import { useHoneypot } from "@/hooks/useHoneypot";
import { useSeo } from "@/hooks/useSeo";
import { checkoutSchema, type CheckoutFormValues } from "@/lib/checkoutSchema";
import { CheckoutFields } from "@/components/product/CheckoutFields";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { lineTotal } from "@/lib/offers";
import { orderErrorKey } from "@/lib/orderErrors";
import { createChargilyCheckout } from "@/lib/chargily";
import { usePixel } from "@/components/MetaPixelProvider";

export default function Checkout() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);
  const { data: settings } = useStoreSettings();
  const { data: wilayas = [] } = useDeliveryPrices(true);
  const { isSpam } = useHoneypot();
  const submitOrder = useSubmitOrder();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const pixel = usePixel();
  const trackedInitiate = useRef(false);

  useSeo({ title: `${t("checkoutTitle")} — Laroche Bijoux`, description: "Finaliser votre commande Laroche Bijoux." });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { delivery_type: "home", payment_method: "cod" },
  });

  const wilayaName = watch("wilaya");
  const deliveryType = watch("delivery_type");
  const selectedWilaya = wilayas.find((w) => w.wilaya === wilayaName);
  const wilayaFee = selectedWilaya
    ? deliveryType === "home"
      ? selectedWilaya.home_price
      : selectedWilaya.office_price
    : null;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = items.reduce(
    (sum, item) => sum + (item.price * item.quantity - lineTotal(item.price, item.quantity, item.quantity_offers)),
    0,
  );
  const goodsTotal = subtotal - discount;
  const shipping = resolveShipping(wilayaFee, goodsTotal, settings);
  const total = goodsTotal + (shipping ?? 0);

  useEffect(() => {
    if (trackedInitiate.current || items.length === 0) return;
    trackedInitiate.current = true;
    pixel.track("initiate_checkout", {
      value: goodsTotal,
      currency: "DZD",
      content_ids: items.map((i) => i.productId),
      num_items: items.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: CheckoutFormValues) {
    setServerError(null);
    if (isSpam(values.honeypot)) return;

    try {
      const orderNumber = await submitOrder.mutateAsync({
        items: items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
          variants: item.variants.map((v) => ({ name_fr: v.name_fr, name_ar: v.name_ar, value: v.value })),
        })),
        customer: values,
        lang,
      });
      // eventId = the order number: Meta's dedup key, so if this conversion is
      // ever also sent server-side the two collapse into one.
      pixel.track(
        "purchase",
        { value: total, currency: "DZD", content_ids: items.map((i) => i.productId) },
        orderNumber,
      );
      clearCart();

      // Online payment: hand off to the Chargily hosted checkout. The order is
      // already placed (payment_status 'pending'); the webhook flips it to
      // 'paid' once the customer completes payment. If the handoff fails, the
      // order still exists — send them to the confirmation with a retry option.
      if (values.payment_method === "online") {
        setRedirecting(true);
        try {
          const checkoutUrl = await createChargilyCheckout(orderNumber);
          window.location.href = checkoutUrl;
          return;
        } catch {
          navigate(`/commande/${orderNumber}?payment=failed`);
          return;
        }
      }

      navigate(`/commande/${orderNumber}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setServerError(t(orderErrorKey(message)));
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-32 text-center">
        <ShoppingBag size={40} className="text-muted" />
        <p className="text-muted">{t("cartEmpty")}</p>
        <Button asChild>
          <Link to="/boutique">{t("cartEmptyCta")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <h1 className="mb-8 font-display text-3xl text-ink md:text-4xl">{t("checkoutTitle")}</h1>

      <div className="grid gap-10 md:grid-cols-2">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <CheckoutFields register={register} errors={errors} watch={watch} setValue={setValue} />

          {serverError && <p className="text-sm text-red-500">{serverError}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={submitOrder.isPending || redirecting}>
            {redirecting
              ? t("checkoutRedirecting")
              : submitOrder.isPending
                ? t("checkoutSubmitting")
                : t("checkoutSubmit")}
          </Button>
        </form>

        <div className="rounded-2xl border border-line bg-panel p-6">
          <h3 className="mb-4 font-display text-xl text-ink">{t("checkoutOrderRecap")}</h3>
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {items.map((item) => (
              <div
                key={`${item.productId}-${item.color}-${item.size}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={item.image ?? ""}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div>
                    <p className="text-ink">{lang === "ar" ? item.name_ar : item.name_fr}</p>
                    <p className="text-xs text-muted">× {item.quantity}</p>
                  </div>
                </div>
                <Price
                  value={lineTotal(item.price, item.quantity, item.quantity_offers)}
                  className="text-brand"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>{t("cartSubtotal")}</span>
              <Price value={subtotal} />
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>{t("cartDiscount")}</span>
                <Price value={discount} prefix="-" />
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>{t("cartShipping")}</span>
              <span>
                {shipping === null
                  ? t("cartShippingUnknown")
                  : shipping === 0
                    ? t("cartFreeShipping")
                    : <Price value={shipping} />}
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <span>{t("cartTotal")}</span>
              <Price value={total} className="text-brand" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
