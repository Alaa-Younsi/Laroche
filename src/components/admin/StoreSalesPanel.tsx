import { useMemo, useState } from "react";
import { FileText, Minus, Plus, Trash2, ShoppingBag, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useStoreProducts,
  useCreateStoreSale,
  storeErrorKey,
  type SaleLinePayload,
} from "@/hooks/useStoreLedger";
import { ScannerInput } from "@/components/admin/ScannerInput";
import { Proforma } from "@/components/admin/Proforma";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { formatPrice } from "@/lib/format";
import { scanCandidates } from "@/lib/barcode";
import { SILVER_TYPES, type Store, type StorePaymentMethod, type StoreProduct } from "@/types/db";

interface DraftLine {
  /** Local row key — a product can legitimately appear twice at different weights. */
  key: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Ad-hoc lines only; catalogue costs are read server-side. */
  unitCost: number;
  weightGrams: number;
  pricingMode: "unit" | "gram";
  isService: boolean;
  /** Snapshot from when the line was added — the server is still the authority. */
  availableStock: number;
}

let lineSeq = 0;

export function StoreSalesPanel({
  store,
  onSold,
}: {
  store: Store;
  onSold: (saleId: string) => void;
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: products = [] } = useStoreProducts();
  const create = useCreateStoreSale();

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payment, setPayment] = useState<StorePaymentMethod>("cash");
  const [discount, setDiscount] = useState(0);
  const [pick, setPick] = useState("");
  const [proformaOpen, setProformaOpen] = useState(false);
  const [weightSold, setWeightSold] = useState("");
  const [weightSalePrice, setWeightSalePrice] = useState("");
  const [silverType, setSilverType] = useState<string>(SILVER_TYPES[0]);

  const active = useMemo(() => products.filter((p) => p.active), [products]);
  // One catalogue row per silver grade, in a stable order (rhodié, bataille, local).
  const silverRows = useMemo(
    () =>
      SILVER_TYPES.map((st) => products.find((p) => p.is_silver_pool && p.silver_type === st)).filter(
        (p): p is StoreProduct => Boolean(p),
      ),
    [products],
  );
  const silverRow = useMemo(
    () => silverRows.find((p) => p.silver_type === silverType) ?? silverRows[0],
    [silverRows, silverType],
  );

  const stockOf = (product: StoreProduct) =>
    product.store_stock?.find((s) => s.store_id === store.id)?.quantity ?? 0;

  function addProduct(product: StoreProduct) {
    const isService = product.kind === "service";
    setLines((prev) => [
      ...prev,
      {
        key: `l${lineSeq++}`,
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.effective_price,
        unitCost: product.effective_cost,
        weightGrams: product.weight_grams,
        pricingMode: product.pricing_mode,
        isService,
        // Bulk silver is weighed per sale and drawn from the shop's gram pool —
        // there is no unit stock count to clamp against; the RPC guards grams
        // and returns ERR_OUT_OF_STOCK if the pool runs dry.
        availableStock:
          isService || product.is_silver_pool
            ? Number.POSITIVE_INFINITY
            : stockOf(product),
      },
    ]);
  }

  function addAdHoc() {
    setLines((prev) => [
      ...prev,
      {
        key: `l${lineSeq++}`,
        productId: null,
        name: "",
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        weightGrams: 0,
        pricingMode: "unit",
        isService: false,
        availableStock: Number.POSITIVE_INFINITY,
      },
    ]);
  }

  function addWeightSale() {
    if (!silverRow) {
      toast.error(t("posSilverRowMissing"));
      return;
    }
    const grams = Number(weightSold);
    const price = Number(weightSalePrice);
    if (!grams || grams <= 0) return;
    // Blank sale price falls back to grade rate × weight — the till row stays
    // editable and the server re-checks it either way.
    const linePrice = price || Math.round(grams * silverRow.price_per_gram * 100) / 100;
    setLines((prev) => [
      ...prev,
      {
        key: `l${lineSeq++}`,
        productId: silverRow.id,
        name: silverRow.name,
        quantity: 1,
        unitPrice: linePrice,
        unitCost: silverRow.effective_cost,
        weightGrams: grams,
        pricingMode: "gram",
        isService: false,
        availableStock: Number.POSITIVE_INFINITY,
      },
    ]);
    setWeightSold("");
    setWeightSalePrice("");
  }

  function onScan(code: string) {
    // A wedge scanner's output is mangled by the OS keyboard layout (AZERTY
    // turns digits into letters) and by any prefix the scanner adds, so match
    // against every plausible reading, and on the digits alone as a last resort.
    const cands = scanCandidates(code);
    const scanDigits = cands.map((c) => c.replace(/\D/g, "")).filter((d) => d.length >= 8);
    const product = active.find((p) => {
      if (cands.some((c) => c === p.barcode || c === p.sku)) return true;
      const digits = (p.barcode ?? "").replace(/\D/g, "");
      return digits.length >= 8 && scanDigits.includes(digits);
    });
    if (!product) {
      toast.error(`${t("posScanNotFound")} : ${code}`);
      return;
    }
    addProduct(product);
  }

  function patch(key: string, changes: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...changes };
        // Re-weighing a gram line re-prices it: that is the entire point of
        // gram pricing, and doing it by hand is where the errors come from.
        if (changes.weightGrams !== undefined && line.productId && line.pricingMode === "gram") {
          const product = products.find((p) => p.id === line.productId);
          if (product) {
            next.unitPrice = Math.round(changes.weightGrams * product.price_per_gram * 100) / 100;
          }
        }
        return next;
      }),
    );
  }

  function drop(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const clampedDiscount = Math.min(Math.max(discount, 0), subtotal);
  const total = subtotal - clampedDiscount;

  // Disable submit on anything the server would refuse anyway, but STILL handle
  // ERR_OUT_OF_STOCK from the RPC: availableStock is a snapshot from when the
  // line was added, and another till may have sold the same piece since.
  const overStock = lines.filter((line) => line.quantity > line.availableStock);
  const unnamed = lines.filter((line) => !line.productId && !line.name.trim());
  const canSubmit =
    lines.length > 0 && overStock.length === 0 && unnamed.length === 0 && !create.isPending;

  async function submit() {
    const payload: SaleLinePayload[] = lines.map((line) => ({
      store_product_id: line.productId,
      name: line.name.trim(),
      quantity: line.quantity,
      unit_price: line.unitPrice,
      unit_cost: line.productId ? undefined : line.unitCost,
      weight_grams: line.pricingMode === "gram" ? line.weightGrams : undefined,
    }));

    try {
      const result = await create.mutateAsync({
        sale: {
          store_id: store.id,
          customer_name: customerName.trim() || undefined,
          customer_phone: customerPhone.trim() || undefined,
          payment_method: payment,
          discount: clampedDiscount,
        },
        items: payload,
      });
      toast.success(`${t("posSaleRecorded")} — ${result.sale_number}`);
      setLines([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount(0);
      onSold(result.id);
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ScannerInput onScan={onScan} />
          <div className="flex gap-2">
            <Select
              value={pick}
              onChange={(e) => {
                const product = active.find((p) => p.id === e.target.value);
                if (product) addProduct(product);
                setPick("");
              }}
            >
              <option value="">{t("posPickItem")}</option>
              {active.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.is_silver_pool
                    ? ` — ${t("posPricePerGram")}`
                    : ` — ${formatPrice(product.effective_price)}`}
                  {product.kind === "product" && !product.is_silver_pool
                    ? ` (${stockOf(product)})`
                    : ""}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="outline" className="shrink-0" onClick={addAdHoc}>
              <Plus size={14} />
            </Button>
          </div>
        </div>

        {silverRows.length > 0 && (
          <div className="space-y-2 rounded-xl border border-brand/30 bg-panel p-3">
            <h4 className="text-xs uppercase tracking-wide2 text-muted">{t("posSellByWeight")}</h4>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="space-y-1">
                <span className="text-xs text-muted">{t("posSilverType")}</span>
                <Select value={silverType} onChange={(e) => setSilverType(e.target.value)}>
                  {silverRows.map((row) => (
                    <option key={row.id} value={row.silver_type ?? ""}>
                      {t(`silverType_${row.silver_type}` as "silverType_local")}
                      {row.price_per_gram > 0 ? ` — ${formatPrice(row.price_per_gram)}/g` : ""}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">{t("posWeightSold")}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  dir="ltr"
                  value={weightSold}
                  onChange={(e) => setWeightSold(e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">{t("posSalePriceTotal")}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  value={weightSalePrice}
                  onChange={(e) => setWeightSalePrice(e.target.value)}
                />
              </label>
              <div className="flex items-end">
                <Button size="sm" onClick={addWeightSale} disabled={!weightSold || Number(weightSold) <= 0}>
                  <Plus size={14} /> {t("posAddWeightSale")}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="whitespace-nowrap px-3 py-3 text-start">{t("posItemName")}</th>
                <th className="whitespace-nowrap px-3 py-3 text-start">{t("posWeightGrams")}</th>
                <th className="whitespace-nowrap px-3 py-3 text-center">{t("finQty")}</th>
                <th className="whitespace-nowrap px-3 py-3 text-start">{t("finSellPrice")}</th>
                <th className="whitespace-nowrap px-3 py-3 text-end">{t("finTotal")}</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    {line.productId ? (
                      <span className="text-ink">{line.name}</span>
                    ) : (
                      <Input
                        className="w-40 px-3 py-2"
                        placeholder={t("posItemName")}
                        value={line.name}
                        onChange={(e) => patch(line.key, { name: e.target.value })}
                      />
                    )}
                    {line.quantity > line.availableStock && (
                      <span className="block text-[0.65rem] text-red-500">
                        {t("posOnlyLeft")} {line.availableStock}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {line.pricingMode === "gram" ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        className="w-24 px-3 py-2"
                        value={line.weightGrams}
                        onChange={(e) =>
                          patch(line.key, { weightGrams: Number(e.target.value) })
                        }
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {/* ≥36 px targets: these get tapped with a thumb, fast. */}
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        aria-label="-"
                        onClick={() =>
                          patch(line.key, { quantity: Math.max(1, line.quantity - 1) })
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:border-brand"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center tabular-nums text-ink">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label="+"
                        onClick={() => patch(line.key, { quantity: line.quantity + 1 })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:border-brand"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28 px-3 py-2"
                      value={line.unitPrice}
                      onChange={(e) => patch(line.key, { unitPrice: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums text-ink">
                    <Price value={line.unitPrice * line.quantity} />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => drop(line.key)}
                      aria-label={t("delete")}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    {t("posEmptyTill")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-panel p-4">
        <h3 className="font-display text-lg text-ink">{t("posCheckout")}</h3>

        <Input
          placeholder={t("posCustomerName")}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
        <Input
          dir="ltr"
          placeholder={t("posCustomerPhone")}
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
        <Select
          value={payment}
          onChange={(e) => setPayment(e.target.value as StorePaymentMethod)}
        >
          <option value="cash">{t("posPay_cash")}</option>
          <option value="card">{t("posPay_card")}</option>
          <option value="transfer">{t("posPay_transfer")}</option>
          <option value="other">{t("posPay_other")}</option>
        </Select>

        <label className="block space-y-1">
          <span className="text-xs text-muted">{t("posDiscount")}</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </label>

        <div className="space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-muted">
            <span>{t("cartSubtotal")}</span>
            <Price value={subtotal} />
          </div>
          {clampedDiscount > 0 && (
            <div className="flex justify-between text-muted">
              <span>{t("posDiscount")}</span>
              <Price value={clampedDiscount} prefix="−" />
            </div>
          )}
          <div className="flex justify-between font-display text-xl text-ink">
            <span>{t("cartTotal")}</span>
            <Price value={total} />
          </div>
        </div>

        <Button className="w-full" disabled={!canSubmit} onClick={submit}>
          {create.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ShoppingBag size={15} />
          )}
          {t("posConfirmSale")}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          disabled={lines.length === 0 || unnamed.length > 0}
          onClick={() => setProformaOpen(true)}
        >
          <FileText size={15} /> {t("posProformaBtn")}
        </Button>
      </div>

      <Proforma
        open={proformaOpen}
        onClose={() => setProformaOpen(false)}
        store={store}
        discount={clampedDiscount}
        defaultCustomer={{ name: customerName, phone: customerPhone }}
        lines={lines.map((line) => ({
          name: line.name.trim() || t("posItemName"),
          material:
            line.pricingMode === "gram" && line.weightGrams > 0
              ? `${line.weightGrams} g`
              : undefined,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        }))}
      />
    </div>
  );
}
