import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { exportOrdersToExcel } from "@/lib/exportOrders";
import { Button } from "@/components/ui/Button";
import type { Order } from "@/types/db";

interface Props {
  open: boolean;
  onClose: () => void;
  orders: Order[];
  onDeleted: () => void;
}

export function DeleteAllOrdersModal({ open, onClose, orders, onDeleted }: Props) {
  const { t } = useLanguage();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("orders").delete().not("id", "is", null);
    setDeleting(false);
    onDeleted();
    onClose();
  }

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
            <h3 className="mb-2 font-display text-xl text-ink">{t("adminDeleteAllOrders")}</h3>
            <p className="mb-1 text-sm text-muted">{t("adminDeleteAllOrdersWarning")}</p>
            <p className="mb-6 text-sm font-medium text-ink">
              {orders.length} {t("adminOrders").toLowerCase()}
            </p>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                disabled={deleting}
                onClick={() => exportOrdersToExcel(orders)}
              >
                <Download size={14} /> {t("adminExportExcel")}
              </Button>
              <Button
                variant="danger"
                className="w-full"
                disabled={deleting}
                onClick={handleDelete}
              >
                {t("adminDeleteAllOrdersConfirm")}
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
