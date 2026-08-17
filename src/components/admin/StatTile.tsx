import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  /** The same figure over the previous window; omit to hide the delta badge. */
  previous?: number | null;
  hint?: string;
  /** Render as a percentage instead of a price. */
  percent?: boolean;
  /** Render as a plain count instead of a price. */
  count?: boolean;
  /** Cost-type tile: a RISE is the bad direction, so the badge colours invert. */
  invertDelta?: boolean;
  /** Profit-type tile: paint the figure red when it goes below zero. */
  negative?: boolean;
}

export function StatTile({
  label,
  value,
  previous,
  hint,
  percent,
  count,
  invertDelta,
  negative,
}: Props) {
  const display = percent
    ? `${(value * 100).toFixed(1)} %`
    : count
      ? String(Math.round(value))
      : formatPrice(value);

  // No previous period (the `max` preset, or the very first month) means no
  // comparison to draw — a "+100 %" against zero is noise, not information.
  const hasDelta =
    previous !== null && previous !== undefined && Number.isFinite(previous) && previous !== 0;
  const delta = hasDelta ? (value - previous) / Math.abs(previous) : 0;
  const rising = delta >= 0;
  const good = invertDelta ? !rising : rising;

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-[0.65rem] uppercase tracking-wide2 text-muted">{label}</p>
      <p
        dir="ltr"
        className={cn(
          "mt-1 font-display text-2xl tabular-nums",
          negative && value < 0 ? "text-red-500" : "text-ink",
        )}
      >
        {display}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[0.7rem] tabular-nums",
              good ? "text-emerald-500" : "text-red-500",
            )}
            dir="ltr"
          >
            {rising ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta * 100).toFixed(0)} %
          </span>
        )}
        {hint && <span className="text-[0.7rem] text-muted">{hint}</span>}
      </div>
    </div>
  );
}
