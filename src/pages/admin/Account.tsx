import { useState } from "react";
import { AlertTriangle, Check, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NotificationPrefsPanel } from "@/components/admin/NotificationPrefsPanel";

const MIN_PASSWORD_LENGTH = 8;

type Status = { tone: "ok" | "error"; text: string } | null;

export default function Account() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const email = session?.user.email ?? "";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setStatus({ tone: "error", text: t("accountPasswordTooShort") });
      return;
    }
    if (next !== confirm) {
      setStatus({ tone: "error", text: t("accountPasswordMismatch") });
      return;
    }

    setSubmitting(true);

    // Re-check the old password before writing the new one. A Supabase session
    // outlives the browser tab by days, so without this anyone who reaches an
    // unattended dashboard could lock the owner out of it. A failed sign-in
    // returns an error without disturbing the session we're already holding.
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (authError) {
      setStatus({ tone: "error", text: t("accountWrongPassword") });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setStatus({ tone: "error", text: error.message });
    } else {
      setStatus({ tone: "ok", text: t("accountPasswordSaved") });
      setCurrent("");
      setNext("");
      setConfirm("");
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-display text-3xl text-ink">{t("adminAccount")}</h1>
      <p className="mb-8 text-sm text-muted">
        {t("accountEmailCurrent")}: <span className="text-ink">{email}</span>
      </p>

      <BentoPanel className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
            <KeyRound size={16} />
          </span>
          <h2 className="font-display text-xl text-ink">{t("accountPasswordTitle")}</h2>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            autoComplete="current-password"
            placeholder={t("accountPasswordCurrent")}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={t("accountPasswordNew")}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={t("accountPasswordConfirm")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          {status && (
            <p
              className={`flex items-start gap-2 text-sm ${
                status.tone === "ok" ? "text-brand" : "text-red-500"
              }`}
            >
              {status.tone === "ok" ? (
                <Check size={15} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              )}
              <span>{status.text}</span>
            </p>
          )}

          <Button type="submit" disabled={submitting}>
            {t("accountPasswordSubmit")}
          </Button>
        </form>
      </BentoPanel>

      <NotificationPrefsPanel />
    </div>
  );
}
