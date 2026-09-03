import { useState } from "react";
import { z } from "zod";
import { Mail, Send } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useHoneypot } from "@/hooks/useHoneypot";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/effects/Reveal";

const emailSchema = z.string().trim().toLowerCase().email().max(200);

type Status = "idle" | "submitting" | "success" | "already" | "invalid" | "error";

export function Newsletter() {
  const { t } = useLanguage();
  const { isSpam, elapsedMs } = useHoneypot();
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSpam(honeypot)) return;

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setStatus("invalid");
      return;
    }

    setStatus("submitting");
    // Writes go through a SECURITY DEFINER RPC (0025) — anon can no longer
    // INSERT into the table directly, so the timing/flood checks can't be
    // skipped by hitting PostgREST straight.
    const { data, error } = await supabase.rpc("subscribe_newsletter", {
      p: { email: parsed.data, elapsed_ms: elapsedMs() },
    });

    if (error) {
      setStatus("error");
      return;
    }
    setStatus(data === "ok" ? "success" : data === "already" ? "already" : "invalid");
    if (data === "ok") setEmail("");
  }

  const message =
    status === "success"
      ? t("newsletterSuccess")
      : status === "already"
        ? t("newsletterAlready")
        : status === "invalid"
          ? t("newsletterInvalid")
          : status === "error"
            ? t("errorGeneric")
            : null;

  return (
    <section className="border-t border-line bg-panel-2/40">
      <div className="mx-auto max-w-3xl px-4 py-14 text-center md:px-8">
        <Reveal>
          <span className="mx-auto flex w-fit items-center justify-center rounded-full bg-brand/10 p-3 text-brand">
            <Mail size={20} />
          </span>
          <h2 className="mt-4 font-display text-2xl font-light text-ink md:text-3xl">
            {t("newsletterTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("newsletterSubtitle")}</p>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              name="company"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status !== "submitting") setStatus("idle");
              }}
              placeholder={t("newsletterPlaceholder")}
              className="w-full flex-1 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-ink placeholder:text-muted outline-none transition-colors focus:border-brand"
            />
            <Button type="submit" disabled={status === "submitting"} className="shrink-0">
              {status === "submitting" ? t("newsletterSubmitting") : (
                <>
                  <Send size={14} /> {t("newsletterSubmit")}
                </>
              )}
            </Button>
          </form>

          {message && (
            <p className={`mt-3 text-xs ${status === "success" ? "text-brand" : "text-muted"}`}>
              {message}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
