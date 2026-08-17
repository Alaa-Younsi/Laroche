import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { formatPrice } from "@/lib/format";
import type { SeriesPoint } from "@/lib/finance";

// Hand-rolled SVG, no chart library.
//
// Revenue, profit and expenses share ONE y-axis: all three are DA, so a second
// scale would only make incomparable things look comparable.

const W = 800;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

type SeriesKey = "revenue" | "profit" | "expenses";

const SERIES: Array<{ key: SeriesKey; color: string; labelKey: "finRevenue" | "finProfit" | "finExpenses" }> = [
  { key: "revenue", color: "var(--viz-revenue)", labelKey: "finRevenue" },
  { key: "profit", color: "var(--viz-profit)", labelKey: "finProfit" },
  { key: "expenses", color: "var(--viz-expense)", labelKey: "finExpenses" },
];

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

export function TrendChart({ points }: { points: SeriesPoint[] }) {
  const { t, dir } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);

  const { min, max, xOf, yOf } = useMemo(() => {
    const values = points.flatMap((p) => [p.revenue, p.profit, p.expenses]);
    // Floor the domain at 0 so a loss reads as *below the line* rather than as
    // a short bar.
    let lo = Math.min(0, ...(values.length ? values : [0]));
    let hi = Math.max(0, ...(values.length ? values : [0]));
    // A flat-zero dataset would otherwise divide by zero.
    if (hi === lo) hi = lo + 1;

    const n = points.length;
    return {
      min: lo,
      max: hi,
      xOf: (i: number) => (n <= 1 ? PAD.left + INNER_W / 2 : PAD.left + (i * INNER_W) / (n - 1)),
      yOf: (v: number) => PAD.top + INNER_H - ((v - lo) / (hi - lo)) * INNER_H,
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-muted">
        {t("finNoData")}
      </div>
    );
  }

  const zeroY = yOf(0);
  const hovered = hover !== null ? points[hover] : null;

  function pathFor(key: SeriesKey): string {
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p[key]).toFixed(1)}`)
      .join(" ");
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      {/* A permanent legend: with three series, identity must never rest on
          colour alone. */}
      <div className="mb-3 flex flex-wrap gap-4">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-2 text-xs text-muted">
            <span
              className="inline-block h-0.5 w-5 rounded"
              style={{ backgroundColor: s.color }}
            />
            {t(s.labelKey)}
          </span>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={t("finTrendTitle")}
          onMouseLeave={() => setHover(null)}
        >
          {/* horizontal rules */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const value = min + (max - min) * (1 - frac);
            const y = PAD.top + INNER_H * frac;
            return (
              <g key={frac}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="rgb(var(--c-line))"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[rgb(var(--c-muted))] text-[11px] tabular-nums"
                >
                  {compact(value)}
                </text>
              </g>
            );
          })}

          {/* a stronger zero rule, so a loss is visibly under the line */}
          {min < 0 && (
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={zeroY}
              y2={zeroY}
              stroke="rgb(var(--c-muted))"
              strokeWidth={1.5}
            />
          )}

          {SERIES.map((s) => (
            <path
              key={s.key}
              d={pathFor(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Markers only on the hovered column. */}
          {hover !== null &&
            SERIES.map((s) => (
              <circle
                key={s.key}
                cx={xOf(hover)}
                cy={yOf(points[hover][s.key])}
                r={4}
                fill={s.color}
              />
            ))}

          {hover !== null && (
            <line
              x1={xOf(hover)}
              x2={xOf(hover)}
              y1={PAD.top}
              y2={PAD.top + INNER_H}
              stroke="rgb(var(--c-muted))"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* x labels: first, last and hovered only — anything else collides. */}
          {points.map((p, i) => {
            if (i !== 0 && i !== points.length - 1 && i !== hover) return null;
            return (
              <text
                key={p.bucket}
                x={xOf(i)}
                y={H - 8}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="fill-[rgb(var(--c-muted))] text-[11px]"
              >
                {p.label}
              </text>
            );
          })}

          {/* The hit target is the WHOLE column mapped through the viewBox, not
              the 5px marker — chasing a marker with a finger is how these
              become unusable on a phone. */}
          {points.map((p, i) => (
            <rect
              key={`hit-${p.bucket}`}
              x={xOf(i) - INNER_W / Math.max(points.length, 1) / 2}
              y={PAD.top}
              width={INNER_W / Math.max(points.length, 1)}
              height={INNER_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>

        {hovered && hover !== null && (
          <div
            // Flips to the far side past the midpoint so the card never covers
            // the part of the line being read. Physical left/right, because the
            // SVG itself does not mirror under RTL.
            className="pointer-events-none absolute top-2 w-44 rounded-lg border border-line bg-panel p-3 text-xs shadow-panel"
            style={
              hover / Math.max(points.length - 1, 1) > 0.5
                ? { left: "0.5rem" }
                : { right: "0.5rem" }
            }
            dir={dir}
          >
            <p className="mb-2 font-medium text-ink">{hovered.label}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-2 text-muted">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-0.5 w-3 rounded"
                    style={{ backgroundColor: s.color }}
                  />
                  {t(s.labelKey)}
                </span>
                <span dir="ltr" className="tabular-nums text-ink">
                  {formatPrice(hovered[s.key])}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* The numbers stay available as a table: the light-mode series sit under
          3:1 against the panel, so colour alone is not a reliable read. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs uppercase tracking-wide2 text-muted">
          {t("finShowTable")}
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-3 py-2 text-start">{t("finPeriod")}</th>
                <th className="px-3 py-2 text-end">{t("finRevenue")}</th>
                <th className="px-3 py-2 text-end">{t("finProfit")}</th>
                <th className="px-3 py-2 text-end">{t("finExpenses")}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.bucket} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 text-ink">{p.bucket}</td>
                  <td className="px-3 py-1.5 text-end tabular-nums text-ink" dir="ltr">
                    {formatPrice(p.revenue)}
                  </td>
                  <td className="px-3 py-1.5 text-end tabular-nums text-ink" dir="ltr">
                    {formatPrice(p.profit)}
                  </td>
                  <td className="px-3 py-1.5 text-end tabular-nums text-ink" dir="ltr">
                    {formatPrice(p.expenses)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
