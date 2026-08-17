import { cn } from "@/lib/utils";

export interface TabDef<K extends string> {
  key: K;
  label: string;
  /** Small trailing count, e.g. the number of rows behind the tab. */
  badge?: number;
}

/** Scrolls horizontally, never wraps — same reasoning as RangeFilter. */
export function SectionTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<TabDef<K>>;
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-xs uppercase tracking-wide2 transition-colors",
            active === tab.key
              ? "border-brand text-brand"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="ms-2 rounded-full bg-panel-2 px-2 py-0.5 text-[0.6rem] tabular-nums text-muted">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
