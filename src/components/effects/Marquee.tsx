import type { ReactNode } from "react";

export function Marquee({ items }: { items: ReactNode[] }) {
  const track = [...items, ...items, ...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-line bg-panel-2/50 py-3">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {track.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-10 text-xs uppercase tracking-wide3 text-muted"
          >
            {item}
            <span className="text-brand">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
