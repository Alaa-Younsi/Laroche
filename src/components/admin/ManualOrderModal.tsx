import { useMemo, useState } from "react";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useProducts } from "@/hooks/useProducts";
import { useDeliveryPrices } from "@/hooks/useDeliveryPrices";
import { useCreateManualOrder } from "@/hooks/useOrders";
import { useCategoryPromoResolver } from "@/hooks/useCategoryPromotions";
import { promoPrice } from "@/lib/promo";
import { orderErrorKey } from "@/lib/orderErrors";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import type { DeliveryType, OrderStatus, PaymentMethod } from "@/types/db";

interface Line {
  key: string;
  productId: string;
  quantity: number;
  unitPrice: string; // "" = auto (catalogue price, promo applied)
}

let seq = 0;

export function ManualOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (orderNumber: string) => void;
}) {
  const { t, lang } = useLanguage();
  const toast = useAdminToast();
  const { data: products = [] } = useProducts();
  const { data: wilayas = [] } = useDeliveryPrices(true);
  const { resolve } = useCategoryPromoResolver();
  const create = useCreateManualOrder();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("home");
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [status, setStatus] = useState<OrderStatus>("confirmed");
  const [shipping, setShipping] = useState(""); // "" = auto from wilaya grid
  const [discount, setDiscount] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function autoUnit(productId: string): number {
    const p = byId.get(productId);
    if (!p) return 0;
    const promo = resolve(p.category_id);
    return promo ? promoPrice(p.price, promo.percent) : p.price;
  }

  const subtotal = lines.reduce((sum, l) => {
    const unit = l.unitPrice !== "" ? Number(l.unitPrice) : autoUnit(l.productId);
    return sum + unit * l.quantity;
  }, 0);
  const selectedWilaya = wilayas.find((w) => w.wilaya === wilaya);
  const autoShip = selectedWilaya
    ? deliveryType === "home"
      ? selectedWilaya.home_price
      : selectedWilaya.office_price
    : 0;
  const shipValue = shipping !== "" ? Number(shipping) : autoShip;
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = subtotal - discountValue + shipValue;

  function reset() {
    setName("");
    setPhone("");
    setWilaya("");
    setCity("");
    setAddress("");
    setNotes("");
    setDeliveryType("home");
    setPayment("cod");
    setStatus("confirmed");
    setShipping("");
    setDiscount("");
    setLines([]);
  }

  async function submit() {
    if (lines.length === 0 || lines.some((l) => !l.productId)) {
      toast.error(t("manualOrderNeedItem"));
      return;
    }
    try {
      const orderNumber = await create.mutateAsync({
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        wilaya: wilaya.trim(),
        city: city.trim(),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        delivery_type: deliveryType,
        language: lang === "ar" ? "ar" : "fr",
        payment_method: payment,
        status,
        shipping: shipping !== "" ? Number(shipping) : undefined,
        discount: discountValue || undefined,
        items: lines.map((l) => ({
          product_id: l.productId,
          quantity: l.quantity,
          unit_price: l.unitPrice !== "" ? Number(l.unitPrice) : undefined,
        })),
      });
      toast.success(`${t("manualOrderCreated")} — ${orderNumber}`);
      reset();
      onCreated(orderNumber);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(t(orderErrorKey(message)));
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
    >
      <BentoPanel
        className="my-8 w-full max-w-2xl p-6"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-ink">{t("manualOrderTitle")}</h3>
          <button onClick={onClose} aria-label={t("close")} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">{t("manualOrderHint")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Client" value={name} onChange={(e) => setName(e.target.value)} />
          <Input dir="ltr" placeholder={t("posCustomerPhone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Select value={wilaya} onChange={(e) => setWilaya(e.target.value)}>
            <option value="">Wilaya</option>
            {wilayas.map((w) => (
              <option key={w.wilaya} value={w.wilaya}>
                {w.wilaya}
              </option>
            ))}
          </Select>
          <Input placeholder="Commune" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input
            className="sm:col-span-2"
            placeholder="Adresse"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}>
            <option value="home">{t("checkoutDeliveryHome")}</option>
            <option value="office">{t("checkoutDeliveryOffice")}</option>
          </Select>
          <Select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            <option value="cod">{t("checkoutPayCod")}</option>
            <option value="online">{t("checkoutPayOnline")}</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="shipped">shipped</option>
            <option value="delivered">delivered</option>
          </Select>
        </div>

        <div className="mt-4 space-y-2">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid grid-cols-[minmax(0,1fr)_4rem_7rem_auto] items-center gap-2"
            >
              <Select
                value={line.productId}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l) => (l.key === line.key ? { ...l, productId: e.target.value } : l)),
                  )
                }
              >
                <option value="">{t("manualOrderProduct")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(lang === "ar" ? p.name_ar : p.name_fr)} — {p.price} DA ({p.stock})
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l) =>
                      l.key === line.key ? { ...l, quantity: Math.max(1, Number(e.target.value)) } : l,
                    ),
                  )
                }
              />
              <Input
                type="number"
                min={0}
                dir="ltr"
                placeholder={t("manualOrderUnitPriceAuto")}
                value={line.unitPrice}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l) => (l.key === line.key ? { ...l, unitPrice: e.target.value } : l)),
                  )
                }
              />
              <button
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                className="text-muted hover:text-red-500"
                aria-label={t("delete")}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setLines((prev) => [...prev, { key: `m${seq++}`, productId: "", quantity: 1, unitPrice: "" }])
            }
          >
            <Plus size={14} /> {t("manualOrderAddLine")}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted">{t("manualOrderShipping")}</span>
            <Input
              type="number"
              min={0}
              dir="ltr"
              placeholder={t("manualOrderShippingAuto")}
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">{t("posDiscount")}</span>
            <Input
              type="number"
              min={0}
              dir="ltr"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </label>
          <Input
            className="sm:col-span-2"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-muted">
            <span>{t("cartSubtotal")}</span>
            <Price value={subtotal} />
          </div>
          <div className="flex justify-between text-muted">
            <span>{t("cartShipping")}</span>
            <Price value={shipValue} />
          </div>
          <div className="flex justify-between font-display text-lg text-ink">
            <span>{t("cartTotal")}</span>
            <Price value={total} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {t("manualOrderCreate")}
          </Button>
        </div>
      </BentoPanel>
    </div>
  );
}
