import { Printer, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";
import type { Store, StoreSale } from "@/types/db";

/**
 * Ticket de caisse, sized for a 58 mm thermal roll (the width the shop's
 * printer actually takes). `.receipt-page` pins it to a named @page in
 * index.css so the driver prints it at 1:1 on the roll instead of scaling it to
 * fit A4 — the scaling is what was pushing the right-aligned amounts off the
 * paper and leaving Total / Sous-total blank on the print.
 *
 * Deliberately plain inline styles rather than the app's Tailwind tokens: this
 * is the one surface that leaves the screen for a printer, where the dark
 * theme's palette would come out as a black rectangle and the brand fonts are
 * not installed.
 */
const PAPER_MM = 58;
export function Receipt({
  sale,
  store,
  open,
  onClose,
}: {
  sale: StoreSale | null;
  store: Store | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  if (!open || !sale) return null;

  const items = sale.store_sale_items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 print:bg-white print:p-0">
      <div className="receipt-page my-8 w-full max-w-[280px] print-sheet">
        <div
          id="receipt"
          dir={lang === "ar" ? "rtl" : "ltr"}
          style={{
            background: "#fff",
            color: "#000",
            padding: "3mm",
            fontFamily: "monospace",
            fontSize: "10px",
            lineHeight: 1.4,
            width: `${PAPER_MM}mm`,
            maxWidth: "100%",
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "3mm" }}>
            <div style={{ fontSize: "13px", fontWeight: 700 }}>{t("siteName")}</div>
            {store && <div>{store.name}</div>}
            {store?.address && <div>{store.address}</div>}
            {store?.phone && <div dir="ltr">{store.phone}</div>}
          </div>

          <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2mm 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "3mm" }}>
              <span>{t("posReceiptNo")}</span>
              <span dir="ltr" style={{ textAlign: "end" }}>{sale.sale_number}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "3mm" }}>
              <span>{t("finDate")}</span>
              <span dir="ltr" style={{ textAlign: "end" }}>
                {sale.sold_at} {new Date(sale.created_at).toLocaleTimeString("fr-DZ")}
              </span>
            </div>
            {/* Always print the customer row — the client asked for the name on
                the ticket, and an empty dash reads clearer than a missing line
                when it was left blank. */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "3mm" }}>
              <span>{t("finCustomer")}</span>
              <span style={{ textAlign: "end", wordBreak: "break-word" }}>
                {sale.customer_name?.trim() || "—"}
              </span>
            </div>
          </div>

          <table style={{ width: "100%", margin: "2mm 0" }}>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ paddingBottom: "1.5mm" }}>
                    <div>{item.name}</div>
                    <div style={{ opacity: 0.75 }} dir="ltr">
                      {item.quantity} ×&nbsp;{formatPrice(item.unit_price)}
                      {item.pricing_mode === "gram" && item.weight_grams > 0
                        ? ` · ${item.weight_grams} g`
                        : ""}
                    </div>
                  </td>
                  <td
                    dir="ltr"
                    style={{ textAlign: "end", verticalAlign: "top", whiteSpace: "nowrap" }}
                  >
                    {formatPrice(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "3mm" }}>
              <span>{t("cartSubtotal")}</span>
              <span dir="ltr" style={{ whiteSpace: "nowrap" }}>{formatPrice(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: "3mm" }}>
                <span>{t("posDiscount")}</span>
                <span dir="ltr" style={{ whiteSpace: "nowrap" }}>−{formatPrice(sale.discount)}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "3mm",
                fontSize: "12px",
                fontWeight: 700,
                marginTop: "1mm",
              }}
            >
              <span>{t("cartTotal")}</span>
              <span dir="ltr" style={{ whiteSpace: "nowrap" }}>{formatPrice(sale.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "3mm", marginTop: "1mm" }}>
              <span>{t("posPayment")}</span>
              <span style={{ textAlign: "end" }}>{t(`posPay_${sale.payment_method}` as "posPay_cash")}</span>
            </div>
          </div>

          <div style={{ marginTop: "3mm", textAlign: "center" }}>
            <div style={{ fontFamily: "monospace", fontSize: "10px" }} dir="ltr">
              {sale.sale_number}
            </div>
            <div style={{ marginTop: "2mm" }}>{t("posReceiptThanks")}</div>
          </div>
        </div>

        <div className="print-hide mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => window.print()}>
            <Printer size={15} /> {t("posPrint")}
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X size={15} /> {t("close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
