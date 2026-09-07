import { useMemo, useState } from "react";
import { ArrowRightLeft, Check, Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useStoreTransfers,
  useCreateStoreTransfer,
  useResolveStoreTransfer,
  useSilverPools,
  storeErrorKey,
} from "@/hooks/useStoreLedger";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SILVER_TYPES, type Store, type StoreProduct } from "@/types/db";

interface DraftLine {
  key: string;
  productId: string;
  quantity: number;
  /** Silver lines move a weight; unit lines ignore this. */
  weightGrams: number;
}

let seq = 0;

export function TransfersPanel({
  store,
  stores,
  products,
}: {
  store: Store;
  stores: Store[];
  products: StoreProduct[];
}) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: transfers = [] } = useStoreTransfers();
  const { data: silverPools = [] } = useSilverPools(store.id);
  const create = useCreateStoreTransfer();
  const resolve = useResolveStoreTransfer();

  const [open, setOpen] = useState(false);
  const [toStore, setToStore] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  // The dedicated "silver by weight" row of the form.
  const [silverType, setSilverType] = useState<string>(SILVER_TYPES[0]);
  const [silverGrams, setSilverGrams] = useState("");

  const others = stores.filter((s) => s.id !== store.id);
  const nameOf = (id: string) => stores.find((s) => s.id === id)?.name ?? "—";
  const productOf = (productId: string) => products.find((p) => p.id === productId);

  // The article dropdown lists ordinary pieces only — bulk silver moves through
  // its own block below so the two never get confused.
  const unitProducts = useMemo(
    () => products.filter((p) => p.kind === "product" && !p.is_silver_pool),
    [products],
  );
  // One catalogue row per silver grade that actually exists, in a stable order.
  const silverRows = useMemo(
    () =>
      SILVER_TYPES.map((st) =>
        products.find((p) => p.is_silver_pool && p.silver_type === st),
      ).filter((p): p is StoreProduct => Boolean(p)),
    [products],
  );

  /** How much is on hand at the sending shop — a unit count, or pool grams for silver. */
  const availableOf = (productId: string) => {
    const product = productOf(productId);
    if (product?.is_silver_pool) {
      return silverPools.find((pool) => pool.silver_type === product.silver_type)?.grams ?? 0;
    }
    return product?.store_stock?.find((s) => s.store_id === store.id)?.quantity ?? 0;
  };
  const gramsOfGrade = (type: string) =>
    silverPools.find((pool) => pool.silver_type === type)?.grams ?? 0;

  function reset() {
    setOpen(false);
    setToStore("");
    setNotes("");
    setLines([]);
    setSilverGrams("");
  }

  function addUnitLine() {
    setLines((prev) => [
      ...prev,
      { key: `tr${seq++}`, productId: "", quantity: 1, weightGrams: 0 },
    ]);
  }

  function addSilverLine() {
    const row = silverRows.find((p) => p.silver_type === silverType);
    const grams = Number(silverGrams);
    if (!row || !grams || grams <= 0) return;
    setLines((prev) => [
      ...prev,
      { key: `tr${seq++}`, productId: row.id, quantity: 1, weightGrams: grams },
    ]);
    setSilverGrams("");
  }

  async function submit() {
    if (!toStore) {
      toast.error(t("storeErrMissingTarget"));
      return;
    }
    const items = lines
      .filter((line) => {
        if (!line.productId) return false;
        return productOf(line.productId)?.is_silver_pool
          ? line.weightGrams > 0
          : line.quantity > 0;
      })
      .map((line) =>
        productOf(line.productId)?.is_silver_pool
          ? { store_product_id: line.productId, quantity: 1, weight_grams: line.weightGrams }
          : { store_product_id: line.productId, quantity: line.quantity },
      );
    if (items.length === 0) {
      toast.error(t("storeErrEmptySale"));
      return;
    }
    // Block a send the server would reject anyway (it still re-checks under a lock).
    const short = lines.find(
      (line) =>
        line.productId &&
        (productOf(line.productId)?.is_silver_pool ? line.weightGrams : line.quantity) >
          availableOf(line.productId),
    );
    if (short) {
      toast.error(`${t("posOnlyLeft")} ${availableOf(short.productId)}`);
      return;
    }
    try {
      const result = await create.mutateAsync({
        tr: { from_store_id: store.id, to_store_id: toStore, notes: notes.trim() || undefined },
        items,
      });
      toast.success(`${t("posTransferCreated")} — ${result.transfer_number}`);
      reset();
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  async function act(id: string, action: "receive" | "cancel") {
    try {
      await resolve.mutateAsync({ id, action });
      toast.success(t(action === "receive" ? "posTransferReceived" : "posTransferCancelled"));
    } catch (err) {
      toast.error(t(storeErrorKey(err)));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("posTransfers")}</h3>
        <Button
          size="sm"
          variant="outline"
          disabled={others.length === 0}
          title={others.length === 0 ? t("posNeedTwoStores") : undefined}
          onClick={() => setOpen(true)}
        >
          <ArrowRightLeft size={14} /> {t("posNewTransfer")}
        </Button>
      </div>

      <p className="rounded-lg border border-line bg-panel-2/40 px-4 py-3 text-xs text-muted">
        {t("posTransferHint")} {t("posTransferSilverNote")}
      </p>

      {open && (
        <div className="space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={toStore} onChange={(e) => setToStore(e.target.value)}>
              <option value="">{t("posTransferTo")}</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </Select>
            <Input
              placeholder={t("finNotes")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Bulk silver: its own picker, never mixed into the article list. */}
          {silverRows.length > 0 && (
            <div className="space-y-2 rounded-xl border border-brand/30 bg-panel-2/40 p-3">
              <h4 className="text-xs uppercase tracking-wide2 text-muted">
                {t("posTransferSilverTitle")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="space-y-1">
                  <span className="text-xs text-muted">{t("posSilverType")}</span>
                  <Select value={silverType} onChange={(e) => setSilverType(e.target.value)}>
                    {silverRows.map((row) => (
                      <option key={row.id} value={row.silver_type ?? ""}>
                        {t(`silverType_${row.silver_type}` as "silverType_local")} —{" "}
                        {gramsOfGrade(row.silver_type ?? "")} g
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted">{t("posTransferWeightG")}</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    dir="ltr"
                    value={silverGrams}
                    onChange={(e) => setSilverGrams(e.target.value)}
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    onClick={addSilverLine}
                    disabled={!silverGrams || Number(silverGrams) <= 0}
                  >
                    <Plus size={14} /> {t("add")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {lines.map((line) => {
              const picked = productOf(line.productId);
              const isSilver = !!picked?.is_silver_pool;
              const sent = isSilver ? line.weightGrams : line.quantity;
              const patchLine = (changes: Partial<DraftLine>) =>
                setLines((prev) =>
                  prev.map((l) => (l.key === line.key ? { ...l, ...changes } : l)),
                );
              return (
                <div key={line.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
                  {isSilver ? (
                    <span className="flex h-9 items-center px-3 text-sm text-ink">
                      {t(`silverType_${picked?.silver_type}` as "silverType_local")}
                    </span>
                  ) : (
                    <Select
                      value={line.productId}
                      onChange={(e) => patchLine({ productId: e.target.value })}
                    >
                      <option value="">{t("posPickItem")}</option>
                      {unitProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({availableOf(product.id)})
                        </option>
                      ))}
                    </Select>
                  )}
                  {isSilver ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      dir="ltr"
                      placeholder={t("posTransferWeightG")}
                      value={line.weightGrams || ""}
                      onChange={(e) => patchLine({ weightGrams: Number(e.target.value) })}
                    />
                  ) : (
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => patchLine({ quantity: Number(e.target.value) })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    aria-label={t("delete")}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                  {line.productId && sent > availableOf(line.productId) && (
                    <span className="text-xs text-red-500 sm:col-span-3">
                      {t("posOnlyLeft")} {availableOf(line.productId)}
                      {isSilver ? " g" : ""}
                    </span>
                  )}
                </div>
              );
            })}
            <Button size="sm" variant="outline" onClick={addUnitLine}>
              <Plus size={14} /> {t("posTransferAddArticle")}
            </Button>
          </div>

          <div className="flex gap-2 border-t border-line pt-3">
            <Button size="sm" disabled={create.isPending} onClick={submit}>
              {t("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              <X size={14} /> {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posTransferNo")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posTransferFrom")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posTransferTo")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posItems")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("adminStatus")}</th>
              <th className="w-40 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span dir="ltr" className="font-mono text-xs text-brand">
                    {transfer.transfer_number}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">{nameOf(transfer.from_store_id)}</td>
                <td className="px-4 py-2.5 text-ink">{nameOf(transfer.to_store_id)}</td>
                <td className="px-4 py-2.5 text-muted">
                  {(transfer.store_transfer_items ?? [])
                    .map((item) =>
                      item.silver_type
                        ? `${item.name} · ${item.weight_grams} g`
                        : `${item.name} ×${item.quantity}`,
                    )
                    .join(", ") || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span
                    className={
                      transfer.status === "received"
                        ? "text-emerald-500"
                        : transfer.status === "cancelled"
                          ? "text-muted"
                          : "text-brand"
                    }
                  >
                    {t(`posTransfer_${transfer.status}` as "posTransfer_pending")}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {transfer.status === "pending" && (
                    <div className="flex justify-end gap-1">
                      {transfer.to_store_id === store.id && (
                        <Button size="sm" onClick={() => act(transfer.id, "receive")}>
                          <Check size={13} /> {t("posReceive")}
                        </Button>
                      )}
                      {transfer.from_store_id === store.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => act(transfer.id, "cancel")}
                        >
                          <X size={13} /> {t("cancel")}
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {t("finNoData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
