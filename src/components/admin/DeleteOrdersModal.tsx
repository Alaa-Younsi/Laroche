import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { exportOrdersToExcel } from "@/lib/exportOrders";
import { useAdminToast } from "@/components/admin/AdminToast";
import { Button } from "@/components/ui/Button";
import type { Order } from "@/types/db";

/**
 * "all"       — wipe the table (kept from the original DeleteAllOrdersModal)
 * "selection" — delete the checked rows
 * "single"    — delete one order, named in the confirmation
 */
export type DeleteScope = "all" | "selection" | "single";

interface Props {
  open: boolean;
  scope: DeleteScope;
  onClose: () => void;
  /** Orders the action applies to. For "all" this is also the export payload. */
  orders: Order[];
  onDeleted: () => void;
}

export function DeleteOrdersModal({ open, scope, onClose, orders, onDeleted }: Props) {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const [deleting, setDeleting] = useState(false);

  const count = orders.length;
  const single = scope === "single" ? orders[0] : undefined;

  async function handleDelete() {
    setDeleting(true);
    // `.in('id', […])` for a scoped delete; the unfiltered form is only used for
    // "all", because PostgREST refuses a DELETE with no WHERE clause at all.
    const query = supabase.from("orders").delete();
    const { error } =
      scope === "all"
        ? await query.not("id", "is", null)
        : await query.in(
            "id",
            orders.map((o) => o.id),
          );
    setDeleting(false);

    // Closing on a refused delete would leave the list looking wiped until the
    // next refetch put every order back.
    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    toast.success(
      scope === "single" ? t("adminOrderDeleted") : `${count} ${t("adminOrdersDeleted")}`,
    );
    onDeleted();
    onClose();
  }

  const title =
    scope === "all"
      ? t("adminDeleteAllOrders")
      : scope === "single"
        ? t("adminDeleteOrder")
        : t("adminDeleteSelected");

  const confirmLabel =
    scope === "all" ? t("adminDeleteAllOrdersConfirm") : t("adminDeleteConfirm");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={deleting ? undefined : onClose}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h3 className="mb-2 font-display text-xl text-ink">{title}</h3>
            <p className="mb-1 text-sm text-muted">{t("adminDeleteAllOrdersWarning")}</p>

            <p className="mb-6 text-sm font-medium text-ink">
              {single ? (
                <span dir="ltr" className="font-mono">
                  {single.order_number}
                </span>
              ) : (
                `${count} ${t("adminOrders").toLowerCase()}`
              )}
            </p>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                disabled={deleting || count === 0}
                onClick={() => exportOrdersToExcel(orders)}
              >
                <Download size={14} /> {t("adminExportExcel")}
              </Button>
              <Button
                variant="danger"
                className="w-full"
                disabled={deleting || count === 0}
                onClick={handleDelete}
              >
                {confirmLabel}
              </Button>
              <Button variant="ghost" className="w-full" disabled={deleting} onClick={onClose}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
