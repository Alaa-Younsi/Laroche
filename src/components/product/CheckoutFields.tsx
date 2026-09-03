import type { UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from "react-hook-form";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useDeliveryPrices } from "@/hooks/useDeliveryPrices";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { CheckoutFormValues } from "@/lib/checkoutSchema";

interface CheckoutFieldsProps {
  register: UseFormRegister<CheckoutFormValues>;
  errors: FieldErrors<CheckoutFormValues>;
  watch: UseFormWatch<CheckoutFormValues>;
  setValue: UseFormSetValue<CheckoutFormValues>;
}

export function CheckoutFields({ register, errors, watch, setValue }: CheckoutFieldsProps) {
  const { t } = useLanguage();
  const { data: wilayas = [] } = useDeliveryPrices(true);
  const deliveryType = watch("delivery_type");
  const paymentMethod = watch("payment_method") ?? "cod";

  return (
    <div className="space-y-4">
      {/* honeypot — hidden from real users, basic bots auto-fill every field */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
        {...register("honeypot")}
      />

      <div>
        <Input placeholder={t("checkoutName")} {...register("customer_name")} />
        {errors.customer_name && (
          <p className="mt-1 text-xs text-red-500">{t("errorInvalidInput")}</p>
        )}
      </div>

      <div>
        <Input placeholder={t("checkoutPhone")} dir="ltr" {...register("customer_phone")} />
        {errors.customer_phone && (
          <p className="mt-1 text-xs text-red-500">{t("errorInvalidInput")}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Select {...register("wilaya")} defaultValue="">
            <option value="" disabled>
              {t("checkoutSelectWilaya")}
            </option>
            {wilayas.map((w) => (
              <option key={w.id} value={w.wilaya}>
                {w.wilaya}
              </option>
            ))}
          </Select>
          {errors.wilaya && <p className="mt-1 text-xs text-red-500">{t("errorInvalidInput")}</p>}
        </div>
        <div>
          <Input placeholder={t("checkoutCity")} {...register("city")} />
          {errors.city && <p className="mt-1 text-xs text-red-500">{t("errorInvalidInput")}</p>}
        </div>
      </div>

      <div>
        <Input placeholder={t("checkoutAddress")} {...register("address")} />
        {errors.address && <p className="mt-1 text-xs text-red-500">{t("errorInvalidInput")}</p>}
      </div>

      <div>
        <textarea
          rows={2}
          placeholder={t("checkoutNotes")}
          className="w-full rounded-lg border border-line bg-panel px-4 py-3 text-sm text-ink placeholder:text-muted outline-none transition-colors focus:border-brand"
          {...register("notes")}
        />
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">
          {t("checkoutDeliveryType")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["home", "office"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setValue("delivery_type", type)}
              className={cn(
                "rounded-lg border px-4 py-3 text-sm transition-colors",
                deliveryType === type
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line text-muted hover:border-brand/50",
              )}
            >
              {type === "home" ? t("checkoutDeliveryHome") : t("checkoutDeliveryOffice")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">
          {t("checkoutPaymentMethod")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["cod", "online"] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setValue("payment_method", method)}
              className={cn(
                "rounded-lg border px-4 py-3 text-start text-sm transition-colors",
                paymentMethod === method
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line text-muted hover:border-brand/50",
              )}
            >
              {method === "cod" ? t("checkoutPayCod") : t("checkoutPayOnline")}
            </button>
          ))}
        </div>
        {paymentMethod === "online" && (
          <p className="mt-2 text-xs text-muted">{t("checkoutPayOnlineHint")}</p>
        )}
      </div>
    </div>
  );
}
