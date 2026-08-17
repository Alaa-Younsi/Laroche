import { useLanguage } from "@/i18n/LanguageProvider";
import { rangeFor, type DateRange, type RangePreset } from "@/lib/finance";
import type { TranslationKey } from "@/i18n/translations";
import { cn } from "@/lib/utils";

const PRESETS: Array<{ key: RangePreset; labelKey: TranslationKey }> = [
  { key: "day", labelKey: "finRangeDay" },
  { key: "week", labelKey: "finRangeWeek" },
  { key: "month", labelKey: "finRangeMonth" },
  { key: "year", labelKey: "finRangeYear" },
  { key: "max", labelKey: "finRangeMax" },
  { key: "custom", labelKey: "finRangeCustom" },
];

/**
 * Scrolls horizontally, never wraps. A wrapped row changes height when the
 * labels change length between FR and AR, which reflows the whole page and
 * moves the content under the user's thumb mid-tap.
 */
export function RangeFilter({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {PRESETS.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(rangeFor(key))}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg border px-4 py-2 text-xs uppercase tracking-wide2 transition-colors",
              range.preset === key
                ? "border-brand bg-brand/10 text-brand"
                : "border-line text-muted hover:border-brand/50 hover:text-ink",
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {range.preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={range.from ?? ""}
            onChange={(e) => onChange({ ...range, from: e.target.value || null })}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
          <span className="text-muted">→</span>
          <input
            type="date"
            value={range.to ?? ""}
            onChange={(e) => onChange({ ...range, to: e.target.value || null })}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </div>
      )}
    </div>
  );
}
