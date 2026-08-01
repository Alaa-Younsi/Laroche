import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, BadgeCheck, Clock, XCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/hooks/useSeo";
import { supabase } from "@/lib/supabase";
import { createChargilyCheckout } from "@/lib/chargily";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";

interface OrderRecapItem {
  name_fr: string;
  name_ar: string;
  price: number;
  quantity: number;
  color: string | null;
  size: string | null;
  variants: { name_fr: string; name_ar: string; value: string }[];
}

interface OrderRecap {
  order_number: string;
  customer_name: string;
  wilaya: string;
  city: string;
  delivery_type: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
  items: OrderRecapItem[];
}

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const { t, lang } = useLanguage();
  const [retrying, setRetrying] = useState(false);

  useSeo({
    title: `${t("orderConfirmedTitle")} — Laroche Bijoux`,
    description: "Confirmation de commande Laroche Bijoux.",
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-confirmation", orderNumber],
    enabled: !!orderNumber,
    queryFn: async (): Promise<OrderRecap | null> => {
      const { data, error } = await supabase.rpc("get_order_by_number", {
        p_order_number: orderNumber,
      });
      if (error) throw error;
      return data as OrderRecap | null;
    },
  });

  // Payment banner state: prefer the authoritative DB status, fall back to the
  // ?payment= redirect flag Chargily appends to the success/failure URL (the
  // webhook may land a beat after the browser returns).
  const paymentState =
    order?.payment_status === "paid"
      ? "paid"
      : order?.payment_method === "online" || searchParams.get("payment")
        ? searchParams.get("payment") === "failed" || order?.payment_status === "failed"
          ? "failed"
          : "pending"
        : null;

  async function retryPayment() {
    if (!orderNumber) return;
    setRetrying(true);
    try {
      const url = await createChargilyCheckout(orderNumber);
      window.location.href = url;
    } catch {
      setRetrying(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10"
      >
        <CheckCircle2 size={32} className="text-brand" />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="font-display text-3xl text-ink md:text-4xl"
      >
        {t("orderConfirmedTitle")}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-3 text-muted"
      >
        {t("orderConfirmedText")}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.55 }}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-5 py-2.5"
      >
        <span className="text-xs uppercase tracking-wide2 text-muted">{t("orderNumber")}</span>
        <span className="font-medium text-brand">{orderNumber}</span>
      </motion.div>

      {paymentState === "paid" && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-5 py-2.5 text-sm font-medium text-green-600">
          <BadgeCheck size={16} /> {t("orderPaidBadge")}
        </div>
      )}
      {paymentState === "pending" && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-600">
          <Clock size={16} /> {t("orderPayPending")}
        </div>
      )}
      {paymentState === "failed" && (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="flex items-center justify-center gap-2 text-sm text-red-600">
            <XCircle size={16} /> {t("orderPayFailed")}
          </p>
          <Button className="mt-4" size="sm" onClick={retryPayment} disabled={retrying}>
            {retrying ? t("checkoutRedirecting") : t("orderRetryPayment")}
          </Button>
        </div>
      )}

      {!isLoading && order && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 rounded-2xl border border-line bg-panel p-6 text-start">
          <h3 className="mb-4 font-display text-xl text-ink">{t("checkoutOrderRecap")}</h3>
          <div className="space-y-3">
            {order.items.map((item, i) => {
              const fields = [
                item.color,
                item.size,
                ...item.variants.map(
                  (v) => `${lang === "ar" ? v.name_ar : v.name_fr}: ${v.value}`,
                ),
              ].filter(Boolean);
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-ink">
                      {lang === "ar" ? item.name_ar : item.name_fr} × {item.quantity}
                    </p>
                    {fields.length > 0 && (
                      <p className="text-xs text-muted">{fields.join(" · ")}</p>
                    )}
                  </div>
                  <Price value={item.price * item.quantity} className="text-brand" />
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>{t("cartSubtotal")}</span>
              <Price value={order.subtotal} />
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>{t("cartDiscount")}</span>
                <Price value={order.discount} prefix="-" />
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>{t("cartShipping")}</span>
              <span>{order.shipping === 0 ? t("cartFreeShipping") : <Price value={order.shipping} />}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <span>{t("cartTotal")}</span>
              <Price value={order.total} className="text-brand" />
            </div>
          </div>
        </motion.div>
      )}

      <Button className="mt-10" size="lg" asChild>
        <Link to="/">{t("orderConfirmedBackHome")}</Link>
      </Button>
    </div>
  );
}
