import { useState } from "react";
import { AlertTriangle, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  useAllPixelsAdmin,
  useDeletePixel,
  useSavePixel,
  type PixelDraft,
} from "@/hooks/useMetaPixels";
import { EVENT_NAMES } from "@/lib/metaPixel";
import { BentoPanel } from "@/components/ui/BentoPanel";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { MetaPixel, PixelEventKey, PixelScope } from "@/types/db";
import type { TranslationKey } from "@/i18n/translations";

// A pasted base-code snippet (instead of the bare id) silently tracks nothing —
// the client finds out from an empty Events Manager a week into a campaign.
const PIXEL_ID_RE = /^\d{10,20}$/;

const EVENT_KEYS = Object.keys(EVENT_NAMES) as PixelEventKey[];
const SCOPES: PixelScope[] = ["all", "paths", "products", "landing"];

const SCOPE_LABEL: Record<PixelScope, TranslationKey> = {
  all: "pixelScopeAll",
  paths: "pixelScopePaths",
  products: "pixelScopeProducts",
  landing: "pixelScopeLanding",
};

const SCOPE_HINT: Record<PixelScope, TranslationKey> = {
  all: "pixelScopeAllHint",
  paths: "pixelScopePathsHint",
  products: "pixelScopeProductsHint",
  landing: "pixelScopeLandingHint",
};

function emptyDraft(): PixelDraft {
  return {
    label: "",
    pixel_id: "",
    active: true,
    scope: "all",
    match_values: [],
    events: Object.fromEntries(EVENT_KEYS.map((k) => [k, true])),
    test_event_code: null,
    currency: "DZD",
    sort_order: 0,
    notes: null,
  };
}

function toDraft(pixel: MetaPixel): PixelDraft {
  return {
    id: pixel.id,
    label: pixel.label,
    pixel_id: pixel.pixel_id,
    active: pixel.active,
    scope: pixel.scope,
    match_values: pixel.match_values,
    events: pixel.events,
    test_event_code: pixel.test_event_code,
    currency: pixel.currency,
    sort_order: pixel.sort_order,
    notes: pixel.notes,
  };
}

export default function Pixels() {
  const { t } = useLanguage();
  const { data: pixels = [], isLoading } = useAllPixelsAdmin();
  const savePixel = useSavePixel();
  const deletePixel = useDeletePixel();

  const [draft, setDraft] = useState<PixelDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(values: Partial<PixelDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...values } : prev));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);

    if (!draft.label.trim()) {
      setError(t("pixelErrorLabel"));
      return;
    }
    if (!PIXEL_ID_RE.test(draft.pixel_id.trim())) {
      setError(t("pixelErrorId"));
      return;
    }

    try {
      await savePixel.mutateAsync({
        ...draft,
        label: draft.label.trim(),
        pixel_id: draft.pixel_id.trim(),
        // scope 'all' ignores match values — don't keep stale ones around
        match_values: draft.scope === "all" ? [] : draft.match_values,
        test_event_code: draft.test_event_code?.trim() || null,
        notes: draft.notes?.trim() || null,
      });
      setDraft(null);
    } catch {
      setError(t("pixelErrorSave"));
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="mb-2 font-display text-3xl text-ink">{t("adminPixels")}</h1>
      <p className="mb-8 text-sm text-muted">{t("pixelsIntro")}</p>

      {!draft && (
        <Button className="mb-6" onClick={() => setDraft(emptyDraft())}>
          <Plus size={14} /> {t("pixelAdd")}
        </Button>
      )}

      {draft && (
        <BentoPanel className="mb-8 p-6">
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wide2 text-muted">
                  {t("pixelLabel")}
                </label>
                <Input
                  value={draft.label}
                  onChange={(e) => patch({ label: e.target.value })}
                  placeholder="Retargeting — hiver"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wide2 text-muted">
                  {t("pixelId")}
                </label>
                <Input
                  value={draft.pixel_id}
                  onChange={(e) => patch({ pixel_id: e.target.value })}
                  placeholder="1234567890123456"
                  inputMode="numeric"
                  dir="ltr"
                  required
                />
                <p className="mt-1 text-xs text-muted">{t("pixelIdHint")}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wide2 text-muted">
                  {t("pixelScope")}
                </label>
                <Select
                  value={draft.scope}
                  onChange={(e) => patch({ scope: e.target.value as PixelScope })}
                >
                  {SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {t(SCOPE_LABEL[scope])}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted">{t(SCOPE_HINT[draft.scope])}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wide2 text-muted">
                  {t("pixelSortOrder")}
                </label>
                <Input
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => patch({ sort_order: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            {draft.scope !== "all" && (
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wide2 text-muted">
                  {t("pixelMatchValues")}
                </label>
                <Textarea
                  rows={4}
                  dir="ltr"
                  value={draft.match_values.join("\n")}
                  onChange={(e) =>
                    patch({
                      match_values: e.target.value
                        .split("\n")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder={draft.scope === "paths" ? "/boutique" : "bague-solitaire"}
                />
                <p className="mt-1 text-xs text-muted">{t("pixelMatchValuesHint")}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide2 text-muted">
                {t("pixelEvents")}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {EVENT_KEYS.map((key) => {
                  const enabled = draft.events[key] !== false;
                  return (
                    <label
                      key={key}
                      htmlFor={`event-${key}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        enabled
                          ? "border-brand/50 bg-brand/10 text-ink"
                          : "border-line bg-panel text-muted hover:border-brand/30",
                      )}
                    >
                      <input
                        id={`event-${key}`}
                        type="checkbox"
                        checked={enabled}
                        onChange={() => patch({ events: { ...draft.events, [key]: !enabled } })}
                        className="h-4 w-4 accent-[rgb(var(--c-brand))]"
                      />
                      <span dir="ltr">{EVENT_NAMES[key]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wide2 text-muted">
                  {t("pixelTestCode")}
                </label>
                <Input
                  value={draft.test_event_code ?? ""}
                  onChange={(e) => patch({ test_event_code: e.target.value })}
                  placeholder="TEST12345"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wide2 text-muted">
                  {t("pixelNotes")}
                </label>
                <Input
                  value={draft.notes ?? ""}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => patch({ active: e.target.checked })}
                className="h-4 w-4 accent-[rgb(var(--c-brand))]"
              />
              {t("pixelActive")}
            </label>

            {error && (
              <p className="flex items-start gap-2 text-sm text-red-500">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={savePixel.isPending}>
                {t("save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        </BentoPanel>
      )}

      <div className="grid gap-4">
        {pixels.map((pixel) => {
          const enabledEvents = EVENT_KEYS.filter((k) => pixel.events[k] !== false);
          return (
            <BentoPanel key={pixel.id} className={cn("p-5", !pixel.active && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Target size={15} className="text-brand" />
                    <span className="text-sm text-ink">{pixel.label}</span>
                    {!pixel.active && (
                      <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-muted">
                        {t("pixelPaused")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted" dir="ltr">
                    {pixel.pixel_id}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t(SCOPE_LABEL[pixel.scope])}
                    {pixel.scope !== "all" && ` · ${pixel.match_values.length} ${t("pixelMatchCount")}`}
                  </p>
                  <p className="mt-1 text-xs text-muted" dir="ltr">
                    {enabledEvents.map((k) => EVENT_NAMES[k]).join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setDraft(toDraft(pixel));
                    }}
                    className="text-muted hover:text-brand"
                    aria-label={t("edit")}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePixel.mutate(pixel.id)}
                    className="text-muted hover:text-red-500"
                    aria-label={t("delete")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </BentoPanel>
          );
        })}
        {pixels.length === 0 && !isLoading && <p className="text-muted">{t("pixelsEmpty")}</p>}
      </div>
    </div>
  );
}
