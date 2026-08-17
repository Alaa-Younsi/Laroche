import { useState } from "react";
import { ArrowRightLeft, Check, Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useStoreTransfers,
  useCreateStoreTransfer,
  useResolveStoreTransfer,
  storeErrorKey,
} from "@/hooks/useStoreLedger";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Store, StoreProduct } from "@/types/db";

interface DraftLine {
  key: string;
  productId: string;
  quantity: number;
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
  const create = useCreateStoreTransfer();
  const resolve = useResolveStoreTransfer();

  const [open, setOpen] = useState(false);
  const [toStore, setToStore] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const others = stores.filter((s) => s.id !== store.id);
  const nameOf = (id: string) => stores.find((s) => s.id === id)?.name ?? "—";
  const stockOf = (productId: string) =>
    products
      .find((p) => p.id === productId)
      ?.store_stock?.find((s) => s.store_id === store.id)?.quantity ?? 0;

  function reset() {
    setOpen(false);
    setToStore("");
    setNotes("");
    setLines([]);
  }

  async function submit() {
    if (!toStore) {
      toast.error(t("storeErrMissingTarget"));
      return;
    }
    const items = lines
      .filter((line) => line.productId && line.quantity > 0)
      .map((line) => ({ store_product_id: line.productId, quantity: line.quantity }));
    if (items.length === 0) {
      toast.error(t("storeErrEmptySale"));
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
        {t("posTransferHint")}
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

          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
                <Select
                  value={line.productId}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key ? { ...l, productId: e.target.value } : l,
                      ),
                    )
                  }
                >
                  <option value="">{t("posPickItem")}</option>
                  {products
                    .filter((product) => product.kind === "product")
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({stockOf(product.id)})
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
                        l.key === line.key ? { ...l, quantity: Number(e.target.value) } : l,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  aria-label={t("delete")}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
                {line.productId && line.quantity > stockOf(line.productId) && (
                  <span className="text-xs text-red-500 sm:col-span-3">
                    {t("posOnlyLeft")} {stockOf(line.productId)}
                  </span>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setLines((prev) => [...prev, { key: `tr${seq++}`, productId: "", quantity: 1 }])
              }
            >
              <Plus size={14} /> {t("add")}
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
                    .map((item) => `${item.name} ×${item.quantity}`)
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
