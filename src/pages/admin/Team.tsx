import { useState } from "react";
import { AlertTriangle, Check, ShieldCheck, UserPlus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useWorkers, useUpdateWorker } from "@/hooks/useTeam";
import { GRANTABLE_SECTIONS } from "@/lib/adminSections";
import { createWorkerAccount, CreateWorkerError, createWorkerErrorKey } from "@/lib/adminTeamApi";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { AdminProfile } from "@/types/db";

const MIN_PASSWORD_LENGTH = 8;

type Status = { tone: "ok" | "error"; text: string } | null;

function SectionChecklist({
  value,
  onChange,
  idPrefix,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  const { t } = useLanguage();

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((s) => s !== key) : [...value, key]);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {GRANTABLE_SECTIONS.map((section) => {
        const Icon = section.icon;
        const checked = value.includes(section.key);
        return (
          <label
            key={section.key}
            htmlFor={`${idPrefix}-${section.key}`}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              checked
                ? "border-brand/50 bg-brand/10 text-ink"
                : "border-line bg-panel text-muted hover:border-brand/30",
            )}
          >
            <input
              id={`${idPrefix}-${section.key}`}
              type="checkbox"
              checked={checked}
              onChange={() => toggle(section.key)}
              className="h-4 w-4 accent-[rgb(var(--c-brand))]"
            />
            <Icon size={15} />
            {t(section.labelKey)}
          </label>
        );
      })}
    </div>
  );
}

function WorkerCard({ worker }: { worker: AdminProfile }) {
  const { t } = useLanguage();
  const updateWorker = useUpdateWorker();
  const [draft, setDraft] = useState<string[]>(worker.sections);

  // Dirty state, so ticking a box doesn't write on every click.
  const dirty =
    draft.length !== worker.sections.length ||
    draft.some((s) => !worker.sections.includes(s));

  async function save() {
    await updateWorker.mutateAsync({ userId: worker.user_id, sections: draft });
  }

  return (
    <BentoPanel className={cn("p-5", !worker.active && "opacity-60")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink">{worker.email}</p>
          <p className="text-xs text-muted">
            {worker.active ? t("teamStatusActive") : t("teamStatusDisabled")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateWorker.mutate({ userId: worker.user_id, active: !worker.active })}
          disabled={updateWorker.isPending}
          className={cn(
            "rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-wide transition-colors",
            worker.active
              ? "bg-panel-2 text-muted hover:text-red-500"
              : "bg-brand/10 text-brand",
          )}
        >
          {worker.active ? t("teamDeactivate") : t("teamActivate")}
        </button>
      </div>

      <SectionChecklist value={draft} onChange={setDraft} idPrefix={worker.user_id} />

      {dirty && (
        <div className="mt-4 flex gap-2">
          <Button type="button" onClick={save} disabled={updateWorker.isPending}>
            {t("save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDraft(worker.sections)}
            disabled={updateWorker.isPending}
          >
            {t("cancel")}
          </Button>
        </div>
      )}
    </BentoPanel>
  );
}

export default function Team() {
  const { t } = useLanguage();
  const { data: workers = [], isLoading } = useWorkers();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus({ tone: "error", text: t("teamErrorWeakPassword") });
      return;
    }

    setSubmitting(true);
    try {
      await createWorkerAccount({ email: email.trim(), password, sections });
      setStatus({ tone: "ok", text: t("teamCreated") });
      setEmail("");
      setPassword("");
      setSections([]);
    } catch (err) {
      const code = err instanceof CreateWorkerError ? err.code : "create_failed";
      setStatus({ tone: "error", text: t(createWorkerErrorKey(code)) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 font-display text-3xl text-ink">{t("adminTeam")}</h1>
      <p className="mb-8 text-sm text-muted">{t("teamIntro")}</p>

      <BentoPanel className="mb-8 p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
            <UserPlus size={16} />
          </span>
          <h2 className="font-display text-xl text-ink">{t("teamCreateTitle")}</h2>
        </div>

        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="email"
              autoComplete="off"
              placeholder={t("adminEmail")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={t("teamPasswordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">
              {t("teamSectionsLabel")}
            </p>
            <SectionChecklist value={sections} onChange={setSections} idPrefix="new" />
          </div>

          {status && (
            <p
              className={cn(
                "flex items-start gap-2 text-sm",
                status.tone === "ok" ? "text-brand" : "text-red-500",
              )}
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
            {submitting ? t("teamCreating") : t("teamCreateSubmit")}
          </Button>
        </form>
      </BentoPanel>

      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <ShieldCheck size={15} className="text-brand" />
        {t("teamRosterHint")}
      </div>

      <div className="grid gap-4">
        {workers.map((worker) => (
          <WorkerCard key={worker.user_id} worker={worker} />
        ))}
        {workers.length === 0 && !isLoading && <p className="text-muted">{t("teamEmpty")}</p>}
      </div>
    </div>
  );
}
