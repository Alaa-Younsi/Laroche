import { useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  useSuppliers,
  useSaveSupplier,
  useDeleteSupplier,
  type SupplierDraft,
} from "@/hooks/useFinance";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Supplier } from "@/types/db";

const EMPTY: SupplierDraft = { name: "", phone: "", email: "", address: "", notes: "", active: true };

/** Mounted from BOTH ledgers; writes the one shared table. */
export function SuppliersPanel() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: suppliers = [], isLoading } = useSuppliers();
  const save = useSaveSupplier();
  const remove = useDeleteSupplier();
  const [draft, setDraft] = useState<SupplierDraft | null>(null);

  function edit(supplier: Supplier) {
    setDraft({ ...supplier });
  }

  async function drop(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  async function submit() {
    if (!draft || !draft.name.trim()) {
      toast.error(t("finSupplierNameRequired"));
      return;
    }
    try {
      await save.mutateAsync({ ...draft, name: draft.name.trim() });
      toast.success(t("adminSaved"));
      setDraft(null);
    } catch {
      toast.error(t("adminDeleteError"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{t("finSuppliers")}</h3>
        <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY })}>
          <Plus size={14} /> {t("add")}
        </Button>
      </div>

      {draft && (
        <div className="space-y-3 rounded-xl border border-brand/40 bg-panel p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("finSupplierName")}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Input
              placeholder={t("finPhone")}
              value={draft.phone ?? ""}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
            <Input
              placeholder={t("finEmail")}
              value={draft.email ?? ""}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <Input
              placeholder={t("finAddress")}
              value={draft.address ?? ""}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={save.isPending} onClick={submit}>
              {t("save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              <X size={14} /> {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finSupplierName")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finPhone")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("finEmail")}</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 text-ink">{supplier.name}</td>
                <td className="px-4 py-2.5 text-muted" dir="ltr">{supplier.phone ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted" dir="ltr">{supplier.email ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => edit(supplier)}
                      aria-label={t("edit")}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => drop(supplier.id)}
                      aria-label={t("delete")}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && !isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
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
