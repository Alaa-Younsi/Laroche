import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import type { PaymentMethod, PaymentStatus } from "@/types/db";

// Compact payment indicator for the admin order views. COD orders show a
// neutral chip; online orders show paid/pending/failed with colour.
export function PaymentBadge({
  method,
  status,
}: {
  method?: PaymentMethod;
  status?: PaymentStatus;
}) {
  const { t } = useLanguage();

  // Legacy rows (before the payment migration) have no method → treat as COD.
  if (!method || method === "cod") {
    return (
      <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
        {t("payStatusCod")}
      </span>
    );
  }

  const map: Record<PaymentStatus, { label: string; className: string }> = {
    paid: { label: t("payStatusPaid"), className: "border-green-500/30 bg-green-500/10 text-green-600" },
    pending: { label: t("payStatusPending"), className: "border-amber-500/30 bg-amber-500/10 text-amber-600" },
    unpaid: { label: t("payStatusPending"), className: "border-amber-500/30 bg-amber-500/10 text-amber-600" },
    failed: { label: t("payStatusFailed"), className: "border-red-500/30 bg-red-500/10 text-red-600" },
  };
  const view = map[status ?? "pending"];

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", view.className)}>
      {view.label}
    </span>
  );
}
