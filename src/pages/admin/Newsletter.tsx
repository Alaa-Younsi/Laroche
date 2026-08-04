import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, Mail } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useNewsletterSubscribers } from "@/hooks/useNewsletter";
import { exportNewsletterToExcel } from "@/lib/exportNewsletter";
import { supabase } from "@/lib/supabase";
import { useAdminToast } from "@/components/admin/AdminToast";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";

export default function Newsletter() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { data: subscribers = [], isLoading } = useNewsletterSubscribers();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);

  async function remove(id: string) {
    const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
    if (error) {
      toast.error(t("adminDeleteError"));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportNewsletterToExcel(subscribers);
    } catch {
      toast.error(t("adminExportError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-ink">{t("adminNewsletter")}</h1>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting || subscribers.length === 0}
        >
          <Download size={14} /> {t("adminExportExcel")}
        </Button>
      </div>

      <BentoPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="whitespace-nowrap px-5 py-3 text-start">Email</th>
                <th className="whitespace-nowrap px-5 py-3 text-start">Date</th>
                <th className="whitespace-nowrap px-5 py-3 text-end">{t("delete")}</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-5 py-2.5 text-ink">{s.email}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted">
                    {new Date(s.created_at).toLocaleDateString("fr-DZ")}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-end">
                    <button onClick={() => remove(s.id)} className="text-muted hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-muted">
                    {t("loading")}
                  </td>
                </tr>
              )}
              {!isLoading && subscribers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-muted">
                    <Mail size={22} className="mx-auto mb-2 text-line" />
                    {t("adminNewsletterEmpty")}
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
