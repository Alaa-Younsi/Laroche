import { useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useOrder } from "@/hooks/useOrders";
import { supabase } from "@/lib/supabase";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Select } from "@/components/ui/Select";
import { formatPrice, formatDate } from "@/lib/format";
import type { OrderStatus } from "@/types/db";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export default function OrderDetail() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const { data: order, isLoading } = useOrder(id);
  const queryClient = useQueryClient();

  async function updateStatus(status: OrderStatus) {
    if (!id) return;
    await supabase.from("orders").update({ status }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  if (isLoading) return <p className="text-muted">{t("loading")}</p>;
  if (!order) return <p className="text-muted">{t("noResults")}</p>;

  return (
    <div>
      <Link to="/admin/commandes" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> {t("back")}
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">{order.order_number}</h1>
          <p className="text-sm text-muted">{formatDate(order.created_at)}</p>
        </div>
        <Select
          value={order.status}
          onChange={(e) => updateStatus(e.target.value as OrderStatus)}
          className="w-auto"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <BentoPanel className="p-6 md:col-span-2">
          <h3 className="mb-4 font-display text-lg text-ink">{t("checkoutOrderRecap")}</h3>
          <div className="space-y-3">
            {order.order_items?.map((item) => {
              const fields = [
                item.color,
                item.size,
                ...item.variants.map(
                  (v) => `${lang === "ar" ? v.name_ar : v.name_fr}: ${v.value}`,
                ),
              ].filter(Boolean);
              return (
                <div key={item.id} className="flex items-center gap-3 border-b border-line pb-3 last:border-0">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-ink">
                      {lang === "ar" ? item.name_ar : item.name_fr} × {item.quantity}
                    </p>
                    {fields.length > 0 && (
                      <p className="text-xs text-muted">{fields.join(" · ")}</p>
                    )}
                  </div>
                  <span className="text-sm text-brand">{formatPrice(item.price * item.quantity)}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>{t("cartSubtotal")}</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>{t("cartDiscount")}</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>{t("cartShipping")}</span>
              <span>{formatPrice(order.shipping)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <span>{t("cartTotal")}</span>
              <span className="text-brand">{formatPrice(order.total)}</span>
            </div>
          </div>
        </BentoPanel>

        <BentoPanel className="p-6">
          <h3 className="mb-4 font-display text-lg text-ink">Client</h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide2 text-muted">{t("checkoutName")}</dt>
              <dd className="text-ink">{order.customer_name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide2 text-muted">{t("checkoutPhone")}</dt>
              <dd dir="ltr" className="text-end text-ink">{order.customer_phone}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide2 text-muted">{t("checkoutWilaya")}</dt>
              <dd className="text-ink">{order.wilaya}, {order.city}</dd>
            </div>
            {order.address && (
              <div>
                <dt className="text-xs uppercase tracking-wide2 text-muted">Adresse</dt>
                <dd className="text-ink">{order.address}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide2 text-muted">{t("checkoutDeliveryType")}</dt>
              <dd className="text-ink">
                {order.delivery_type === "home" ? t("checkoutDeliveryHome") : t("checkoutDeliveryOffice")}
              </dd>
            </div>
            {order.notes && (
              <div>
                <dt className="text-xs uppercase tracking-wide2 text-muted">{t("checkoutNotes")}</dt>
                <dd className="text-ink">{order.notes}</dd>
              </div>
            )}
          </dl>
        </BentoPanel>
      </div>
    </div>
  );
}
