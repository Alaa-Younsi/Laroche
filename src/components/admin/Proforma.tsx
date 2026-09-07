import { useEffect, useState } from "react";
import { FileText, Loader2, Printer, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useCreateStoreProforma, storeErrorKey } from "@/hooks/useStoreLedger";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/lib/format";
import type { Store } from "@/types/db";

export interface ProformaLine {
  name: string;
  material?: string;
  quantity: number;
  unitPrice: number;
}

/**
 * FACTURE PROFORMA — an A4 quote printed from the counter. It reserves a
 * document number and stores its lines (0028) but never moves stock, silver
 * grams or cash: "ne constitue pas une preuve de paiement".
 *
 * Inline styles rather than the app's dark-theme tokens, for the same reason as
 * Receipt.tsx: this sheet leaves the screen for a printer.
 */
const MIN_ROWS = 6;

function frDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())} / ${p(d.getMonth() + 1)} / ${d.getFullYear()}`;
}

export function Proforma({
  open,
  onClose,
  store,
  lines,
  discount,
  defaultCustomer,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  store: Store | undefined;
  lines: ProformaLine[];
  discount: number;
  defaultCustomer: { name?: string; phone?: string };
  /** Set when reprinting an already-saved proforma — skips the create step and
   * primes every field from the stored document. */
  existing?: {
    number: string;
    date: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    shipping: number;
    payMode: string;
  };
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const create = useCreateStoreProforma();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [shipping, setShipping] = useState(0);
  const [payMode, setPayMode] = useState("");
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? defaultCustomer.name ?? "");
    setPhone(existing?.phone ?? defaultCustomer.phone ?? "");
    setAddress(existing?.address ?? "");
    setCity(existing?.city ?? "");
    setEmail(existing?.email ?? "");
    setShipping(existing?.shipping ?? 0);
    setPayMode(existing?.payMode ?? "");
    setNumber(existing?.number ?? null);
  }, [open, defaultCustomer.name, defaultCustomer.phone, existing]);

  if (!open) return null;

  const locked = number !== null;
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const clampedDiscount = Math.min(Math.max(discount, 0), subtotal);
  const total = subtotal - clampedDiscount + Math.max(shipping, 0);
  const docDate = existing?.date ? new Date(existing.date) : new Date();

  async function generate() {
    if (!store || lines.length === 0) return;
    try {
      const res = await create.mutateAsync({
        doc: {
          store_id: store.id,
          customer_name: name.trim() || undefined,
          customer_address: address.trim() || undefined,
          customer_city: city.trim() || undefined,
          customer_phone: phone.trim() || undefined,
          customer_email: email.trim() || undefined,
          payment_method: payMode.trim() || undefined,
          discount: clampedDiscount,
          shipping: Math.max(shipping, 0),
        },
        items: lines.map((l) => ({
          name: l.name,
          material: l.material,
          quantity: l.quantity,
          unit_price: l.unitPrice,
        })),
      });
      setNumber(res.proforma_number);
      toast.success(`${t("pfCreated")} — ${res.proforma_number}`);
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  const rows = [...lines];
  const padded = rows.length < MIN_ROWS ? MIN_ROWS - rows.length : 0;

  const th: React.CSSProperties = {
    background: "#111",
    color: "#fff",
    textAlign: "left",
    padding: "6px 8px",
    fontSize: "10px",
    letterSpacing: "0.04em",
  };
  const td: React.CSSProperties = {
    borderBottom: "1px solid #e5e5e5",
    padding: "7px 8px",
    fontSize: "11px",
    verticalAlign: "top",
  };
  const totalRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    padding: "3px 0",
    fontSize: "12px",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 print:bg-white print:p-0">
      <div className="my-8 w-full max-w-[820px] space-y-4">
        {!locked && (
          <div className="print-hide space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
            <h3 className="font-display text-lg text-ink">{t("pfEditTitle")}</h3>
            {(!store?.nif || !store?.rc) && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                {t("pfMissingIdentity")}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder={t("posCustomerName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                dir="ltr"
                placeholder={t("finPhone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                placeholder={t("finAddress")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Input
                placeholder={t("pfClientCity")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                dir="ltr"
                placeholder={t("pfEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                dir="ltr"
                placeholder={t("posPayment")}
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
              />
              <label className="space-y-1">
                <span className="text-xs text-muted">{t("posShipping")}</span>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  dir="ltr"
                  value={shipping || ""}
                  onChange={(e) => setShipping(Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        )}

        <div className="proforma-page print-sheet">
          <div
            id="proforma"
            dir="ltr"
            style={{
              background: "#fff",
              color: "#111",
              margin: "0 auto",
              maxWidth: "800px",
              padding: "28px 32px",
              fontFamily: "'Jost', Arial, Helvetica, sans-serif",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            {/* header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "0.02em" }}>
                  {store?.name ?? t("siteName")}
                </div>
                <div style={{ fontSize: "9px", letterSpacing: "0.14em", color: "#666", marginTop: "2px" }}>
                  {t("pfSubtitle")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "16px", fontWeight: 700 }}>{t("pfHeading")}</div>
                <div style={{ fontSize: "10px", color: "#444", marginTop: "3px" }} dir="ltr">
                  {t("pfNo")} {number ?? "PF-—"} • {frDate(docDate)}
                </div>
              </div>
            </div>

            {/* identity + client band */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                marginTop: "16px",
                border: "1px solid #e5e5e5",
                background: "#fafafa",
              }}
            >
              <div style={{ flex: 1, padding: "10px 12px" }}>
                <div style={{ fontWeight: 700, marginBottom: "3px" }}>{store?.name ?? t("siteName")}</div>
                {store?.address && <div>{store.address}</div>}
                {(store?.nif || store?.rc) && (
                  <div dir="ltr">
                    {store?.nif ? `${t("pfNif")} : ${store.nif}` : ""}
                    {store?.nif && store?.rc ? "  |  " : ""}
                    {store?.rc ? `${t("pfRc")} : ${store.rc}` : ""}
                  </div>
                )}
                {store?.activity_number && (
                  <div dir="ltr">
                    {t("pfActivity")} : {store.activity_number}
                  </div>
                )}
                <div dir="ltr" style={{ color: "#444" }}>
                  {[store?.phone, store?.email, store?.website].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div style={{ flex: 1, padding: "10px 12px", borderLeft: "1px solid #e5e5e5" }}>
                <div style={{ fontWeight: 700, marginBottom: "3px" }}>{t("pfClient")}</div>
                <div>{t("pfClientName")} : {name || "—"}</div>
                <div>{t("finAddress")} : {address || "—"}</div>
                <div>{t("pfClientCity")} : {city || "—"}</div>
                <div dir="ltr">
                  {t("finPhone")} : {phone || "—"}
                  {"   "}
                  {t("pfEmail")} : {email || "—"}
                </div>
              </div>
            </div>

            {/* items */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: "34px" }}>{t("pfColRef")}</th>
                  <th style={th}>{t("pfColDesignation")}</th>
                  <th style={th}>{t("pfColMaterial")}</th>
                  <th style={{ ...th, width: "40px", textAlign: "right" }}>{t("pfColQty")}</th>
                  <th style={{ ...th, width: "90px", textAlign: "right" }}>{t("pfColUnitPrice")}</th>
                  <th style={{ ...th, width: "100px", textAlign: "right" }}>{t("pfColTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((line, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: "center" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={td}>{line.name}</td>
                    <td style={td}>{line.material || "—"}</td>
                    <td style={{ ...td, textAlign: "right" }} dir="ltr">
                      {line.quantity}
                    </td>
                    <td style={{ ...td, textAlign: "right" }} dir="ltr">
                      {formatPrice(line.unitPrice)}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }} dir="ltr">
                      {formatPrice(line.quantity * line.unitPrice)}
                    </td>
                  </tr>
                ))}
                {Array.from({ length: padded }).map((_, i) => (
                  <tr key={`pad${i}`}>
                    <td style={{ ...td, textAlign: "center", color: "#bbb" }}>
                      {String(rows.length + i + 1).padStart(2, "0")}
                    </td>
                    <td style={td} />
                    <td style={td} />
                    <td style={td} />
                    <td style={td} />
                    <td style={td} />
                  </tr>
                ))}
              </tbody>
            </table>

            {/* totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
              <div style={{ width: "260px" }}>
                <div style={totalRow}>
                  <span>{t("cartSubtotal")}</span>
                  <span dir="ltr">{formatPrice(subtotal)}</span>
                </div>
                <div style={totalRow}>
                  <span>{t("posDiscount")}</span>
                  <span dir="ltr">−{formatPrice(clampedDiscount)}</span>
                </div>
                <div style={totalRow}>
                  <span>{t("pfShipping")}</span>
                  <span dir="ltr">{formatPrice(Math.max(shipping, 0))}</span>
                </div>
                <div
                  style={{
                    ...totalRow,
                    borderTop: "2px solid #111",
                    marginTop: "4px",
                    paddingTop: "6px",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  <span>{t("pfGrandTotal")}</span>
                  <span dir="ltr">{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            {/* footer band */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                marginTop: "18px",
                border: "1px solid #e5e5e5",
                background: "#fafafa",
              }}
            >
              <div style={{ flex: 2, padding: "10px 12px" }}>
                <div style={{ fontWeight: 700, marginBottom: "3px" }}>{t("pfWarrantyTitle")}</div>
                <div style={{ fontSize: "9.5px", color: "#444" }}>{t("pfWarrantyText")}</div>
              </div>
              <div style={{ flex: 1, padding: "10px 12px", borderLeft: "1px solid #e5e5e5" }}>
                <div style={{ fontWeight: 700 }}>{t("posPayment")}</div>
                <div style={{ minHeight: "18px" }}>{payMode || "—"}</div>
                <div style={{ fontWeight: 700, marginTop: "8px" }}>{t("pfSignature")}</div>
                <div style={{ minHeight: "28px" }} />
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "14px", fontSize: "9px", color: "#888" }}>
              {t("pfDisclaimer")}
            </div>
          </div>
        </div>

        <div className="print-hide flex flex-wrap gap-2">
          {!locked ? (
            <Button
              className="flex-1"
              disabled={!store || lines.length === 0 || create.isPending}
              onClick={generate}
            >
              {create.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileText size={15} />
              )}
              {t("pfGenerate")}
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => window.print()}>
              <Printer size={15} /> {t("posPrint")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            <X size={15} /> {t("close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
