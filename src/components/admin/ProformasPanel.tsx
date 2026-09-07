import { useMemo, useState } from "react";
import { Printer, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { useStoreProformas, useDeleteStoreProforma } from "@/hooks/useStoreLedger";
import { Proforma, type ProformaLine } from "@/components/admin/Proforma";
import { formatPrice, formatDate } from "@/lib/format";
import type { Store, StoreProforma } from "@/types/db";

export function ProformasPanel({ store }: { store: Store }) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: proformas = [] } = useStoreProformas();
  const remove = useDeleteStoreProforma();
  const [reprint, setReprint] = useState<StoreProforma | null>(null);

  const rows = useMemo(
    () => proformas.filter((p) => p.store_id === store.id),
    [proformas, store.id],
  );

  const reprintLines: ProformaLine[] = (reprint?.store_proforma_items ?? []).map((item) => ({
    name: item.name,
    material: item.material ?? undefined,
    quantity: item.quantity,
    unitPrice: item.unit_price,
  }));

  async function drop(id: string) {
    try {
      await remove.mutateAsync(id);
      toast.success(t("adminSaved"));
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display text-xl text-ink">{t("posProformaTab")}</h3>
      <p className="rounded-lg border border-line bg-panel-2/40 px-4 py-3 text-xs text-muted">
        {t("posProformaHint")}
      </p>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("posProformaNo")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finDate")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finCustomer")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-end">{t("finTotal")}</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span dir="ltr" className="font-mono text-xs text-brand">
                    {p.proforma_number}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {formatDate(p.created_at)}
                </td>
                <td className="px-4 py-2.5 text-ink">{p.customer_name || "—"}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-end tabular-nums text-ink">
                  {formatPrice(p.total)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setReprint(p)}
                      aria-label={t("posPrint")}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                    >
                      <Printer size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => drop(p.id)}
                      aria-label={t("delete")}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {t("posProformaEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Proforma
        open={reprint !== null}
        onClose={() => setReprint(null)}
        store={store}
        lines={reprintLines}
        discount={reprint?.discount ?? 0}
        defaultCustomer={{}}
        existing={
          reprint
            ? {
                number: reprint.proforma_number,
                date: reprint.created_at,
                name: reprint.customer_name ?? "",
                address: reprint.customer_address ?? "",
                city: reprint.customer_city ?? "",
                phone: reprint.customer_phone ?? "",
                email: reprint.customer_email ?? "",
                shipping: reprint.shipping,
                payMode: reprint.payment_method ?? "",
              }
            : undefined
        }
      />
    </div>
  );
}
