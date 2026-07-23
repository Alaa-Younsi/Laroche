import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useStoreSettings, resolveShipping } from "@/hooks/useStoreSettings";
import { useDeliveryPrices } from "@/hooks/useDeliveryPrices";
import { useSubmitOrder } from "@/hooks/useSubmitOrder";
import { useHoneypot } from "@/hooks/useHoneypot";
import { checkoutSchema, type CheckoutFormValues } from "@/lib/checkoutSchema";
import { CheckoutFields } from "@/components/product/CheckoutFields";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { orderErrorKey } from "@/lib/orderErrors";
import { trackInitiateCheckout, trackPurchase } from "@/lib/pixel";
import type { Product, VariantPick } from "@/types/db";

interface InlineCheckoutProps {
  product: Product;
  color: string | null;
  size: string | null;
  variants: VariantPick[];
  quantity: number;
}

export function InlineCheckout({ product, color, size, variants, quantity }: InlineCheckoutProps) {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { data: settings } = useStoreSettings();
  const { data: wilayas = [] } = useDeliveryPrices(true);
  const { isSpam } = useHoneypot();
  const submitOrder = useSubmitOrder();
  const [serverError, setServerError] = useState<string | null>(null);
  const trackedCheckoutId = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { delivery_type: "home" },
  });

  const wilayaName = watch("wilaya");
  const deliveryType = watch("delivery_type");
  const selectedWilaya = wilayas.find((w) => w.wilaya === wilayaName);
  const wilayaFee = selectedWilaya
    ? deliveryType === "home"
      ? selectedWilaya.home_price
      : selectedWilaya.office_price
    : null;

  const lineTotal = product.price * quantity;
  const shipping = resolveShipping(wilayaFee, lineTotal, settings);
  const total = lineTotal + (shipping ?? 0);

  function handleFormFocus() {
    if (trackedCheckoutId.current === product.id) return;
    trackedCheckoutId.current = product.id;
    trackInitiateCheckout({
      value: lineTotal,
      currency: "DZD",
      content_ids: [product.id],
    });
  }

  async function onSubmit(values: CheckoutFormValues) {
    setServerError(null);
    if (isSpam(values.honeypot)) return;

    try {
      const orderNumber = await submitOrder.mutateAsync({
        items: [
          {
            product_id: product.id,
            quantity,
            color,
            size,
            variants: variants.map((v) => ({ name_fr: v.name_fr, name_ar: v.name_ar, value: v.value })),
          },
        ],
        customer: values,
        lang,
      });
      trackPurchase({ value: total, currency: "DZD", content_ids: [product.id] });
      navigate(`/commande/${orderNumber}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setServerError(t(orderErrorKey(message)));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} onFocus={handleFormFocus} className="space-y-5">
      <CheckoutFields register={register} errors={errors} watch={watch} setValue={setValue} />

      <div className="rounded-xl border border-line bg-panel-2/50 p-4 text-sm">
        <div className="flex justify-between text-muted">
          <span>{t("cartSubtotal")}</span>
          <Price value={lineTotal} />
        </div>
        <div className="mt-1 flex justify-between text-muted">
          <span>{t("cartShipping")}</span>
          <span>
            {shipping === null
              ? t("cartShippingUnknown")
              : shipping === 0
                ? t("cartFreeShipping")
                : <Price value={shipping} />}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium text-ink">
          <span>{t("cartTotal")}</span>
          <Price value={total} className="text-brand" />
        </div>
      </div>

      {serverError && <p className="text-sm text-red-500">{serverError}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={submitOrder.isPending}>
        {submitOrder.isPending ? t("checkoutSubmitting") : t("checkoutSubmit")}
      </Button>
    </form>
  );
}
