import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useDeliveryPrices } from "@/hooks/useDeliveryPrices";
import { supabase } from "@/lib/supabase";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { cn } from "@/lib/utils";

export default function DeliveryPrices() {
  const { t } = useLanguage();
  const { data: wilayas = [], isLoading } = useDeliveryPrices();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  async function updateRow(id: string, patch: { home_price?: number; office_price?: number; active?: boolean }) {
    setSavingId(id);
    await supabase.from("delivery_prices").update(patch).eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["delivery-prices"] });
    setSavingId(null);
  }

  return (
    <div>
      <h1 className="mb-8 font-display text-3xl text-ink">{t("adminDeliveryPrices")}</h1>

      <BentoPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="whitespace-nowrap px-5 py-3 text-start">Wilaya</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Domicile</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Bureau</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">{t("adminActive")}</th>
              </tr>
            </thead>
            <tbody>
              {wilayas.map((w) => (
                <tr
                  key={w.id}
                  className={cn(
                    "border-b border-line last:border-0 transition-opacity",
                    !w.active && "opacity-40",
                  )}
                >
                  <td className="whitespace-nowrap px-5 py-2.5">{w.wilaya}</td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <input
                      type="number"
                      className="no-spin w-24 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm outline-none focus:border-brand"
                      defaultValue={w.home_price}
                      disabled={savingId === w.id}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== w.home_price) updateRow(w.id, { home_price: value });
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <input
                      type="number"
                      className="no-spin w-24 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm outline-none focus:border-brand"
                      defaultValue={w.office_price}
                      disabled={savingId === w.id}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== w.office_price) updateRow(w.id, { office_price: value });
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <button
                      onClick={() => updateRow(w.id, { active: !w.active })}
                      disabled={savingId === w.id}
                      className={cn(
                        "h-6 w-11 rounded-full transition-colors",
                        w.active ? "bg-brand" : "bg-panel-2",
                      )}
                    >
                      <span
                        className={cn(
                          "block h-5 w-5 rounded-full bg-white transition-transform",
                          w.active ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted">
                    {t("loading")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BentoPanel>
    </div>
  );
}
