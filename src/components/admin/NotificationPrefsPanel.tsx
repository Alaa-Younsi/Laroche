import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminToast } from "@/components/admin/AdminToast";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface NotificationPrefs {
  email_enabled: boolean;
  notify_email: string | null;
}

const EMPTY: NotificationPrefs = { email_enabled: false, notify_email: null };

function useNotificationPrefs(userId: string | undefined) {
  return useQuery({
    queryKey: ["notification-prefs", userId],
    enabled: !!userId,
    // No retry: the only realistic failure here is the table not existing yet
    // (migration 0037 not applied), which retrying cannot fix — it just parks
    // the panel on a spinner for several seconds. Fall through to the form
    // with defaults instead and let saving report the real error.
    retry: false,
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data, error } = await supabase
        .from("admin_notification_prefs")
        .select("email_enabled, notify_email")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as NotificationPrefs | null) ?? EMPTY;
    },
  });
}

/**
 * Per-account order notifications. Each admin turns on their own channel and
 * types their own address — RLS restricts this table to `user_id = auth.uid()`,
 * so there is deliberately no way to configure it on someone else's behalf.
 */
export function NotificationPrefsPanel() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const { data: prefs, isPending } = useNotificationPrefs(userId);

  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState("");

  // Seed the form once the row arrives; the account's login address is the
  // sensible default for someone switching this on for the first time.
  useEffect(() => {
    if (!prefs) return;
    setEnabled(prefs.email_enabled);
    setEmail(prefs.notify_email ?? session?.user.email ?? "");
  }, [prefs, session?.user.email]);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("no session");
      const trimmed = email.trim();
      // Turning it ON without a destination would fail silently at send time,
      // which is the worst possible outcome for a notification feature.
      if (enabled && !trimmed.includes("@")) throw new Error("invalid_email");
      const { error } = await supabase.from("admin_notification_prefs").upsert(
        {
          user_id: userId,
          email_enabled: enabled,
          notify_email: trimmed || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("adminSaved"));
      queryClient.invalidateQueries({ queryKey: ["notification-prefs", userId] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error && err.message === "invalid_email"
          ? t("notifyEmailInvalid")
          : t("adminSaveError"),
      );
    },
  });

  return (
    <BentoPanel className="mt-6 p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Bell size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl text-ink">{t("notifyTitle")}</h2>
          <p className="text-xs text-muted">{t("notifySubtitle")}</p>
        </div>
      </div>

      {isPending ? (
        <p className="text-sm text-muted">{t("loading")}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="min-w-0 text-sm text-ink">{t("notifyEmailEnable")}</span>
          </label>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide2 text-muted">
              {t("notifyEmailLabel")}
            </label>
            <Input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              disabled={!enabled}
            />
          </div>

          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />}
            {t("save")}
          </Button>
        </form>
      )}
    </BentoPanel>
  );
}
