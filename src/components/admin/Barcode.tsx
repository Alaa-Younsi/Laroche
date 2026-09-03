import { useMemo } from "react";
import {
  barcodeRuns,
  ean13Bits,
  EAN13_MODULES,
  EAN13_QUIET_LEFT,
  EAN13_QUIET_RIGHT,
} from "@/lib/barcode";

const TOTAL_MODULES = EAN13_MODULES + EAN13_QUIET_LEFT + EAN13_QUIET_RIGHT;
const TEXT_BAND = 12; // module-units reserved under the bars for the digits

// Which module positions (in the 95-module symbol, before the quiet offset) are
// guard bars. Guards print 5 modules taller than the data bars so a scanner has
// an easier time finding the symbol edges.
function isGuardModule(x: number): boolean {
  return x <= 2 || (x >= 45 && x <= 49) || x >= 92;
}

/**
 * One EAN-13 symbol as inline SVG.
 *
 * Sizing is by *integer* modules, never a percentage. `moduleWidth` is how many
 * CSS pixels one module gets on screen; `width` overrides that with a physical
 * length for print (a label sheet passes e.g. "34mm"). A barcode scaled to a
 * fractional module width is the classic reason a printed label will not scan —
 * `crispEdges` then rounds neighbouring modules to different pixel widths and
 * the bar/space ratios the scanner keys on are gone. Keeping the on-screen size
 * an exact multiple of the module count avoids that entirely.
 */
export function Barcode({
  code,
  height = 48,
  moduleWidth = 2,
  width,
  showText = true,
  className,
}: {
  code: string;
  /** Bar height, in module units. */
  height?: number;
  /** CSS px per module on screen. Ignored when `width` is set. */
  moduleWidth?: number;
  /** Physical width override for print, e.g. "34mm". */
  width?: string;
  showText?: boolean;
  className?: string;
}) {
  const runs = useMemo(() => {
    const bits = ean13Bits(code);
    return bits ? barcodeRuns(bits) : null;
  }, [code]);

  if (!runs) {
    return <span className="font-mono text-[0.6rem] text-muted">{code || "—"}</span>;
  }

  const bandHeight = height + (showText ? TEXT_BAND : 0);
  const guardExtra = 5;

  return (
    <svg
      viewBox={`0 0 ${TOTAL_MODULES} ${bandHeight}`}
      className={className}
      style={
        width
          ? { width, height: "auto", display: "block" }
          : {
              width: `${TOTAL_MODULES * moduleWidth}px`,
              maxWidth: "100%",
              height: "auto",
              display: "block",
            }
      }
      role="img"
      aria-label={code}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={TOTAL_MODULES} height={bandHeight} fill="#fff" />
      {runs.map((run) => {
        const tall = isGuardModule(run.x);
        return (
          <rect
            key={run.x}
            x={run.x + EAN13_QUIET_LEFT}
            y={0}
            width={run.width}
            height={height + (tall && showText ? guardExtra : 0)}
            fill="#000"
          />
        );
      })}
      {showText && (
        <text
          x={(TOTAL_MODULES + EAN13_QUIET_LEFT - EAN13_QUIET_RIGHT) / 2}
          y={bandHeight - 2}
          textAnchor="middle"
          fontSize={9}
          fontFamily="monospace"
          letterSpacing={1}
          fill="#000"
        >
          {code}
        </text>
      )}
    </svg>
  );
}

export interface LabelSpec {
  code: string;
  name: string;
  price: string;
}

/**
 * A printable grid of labels. Only this element survives `window.print()` —
 * `.print-sheet` pins it over the dashboard and `.print-hide` removes the
 * chrome (see index.css). Each symbol is given a real physical width so it
 * prints at a scannable module size regardless of the screen zoom it was
 * triggered from.
 */
export function BarcodeSheet({ labels }: { labels: LabelSpec[] }) {
  return (
    <div className="print-only print-sheet">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "6mm",
          padding: "8mm",
        }}
      >
        {labels.map((label, index) => (
          <div
            key={`${label.code}-${index}`}
            style={{
              border: "1px solid #ddd",
              padding: "3mm",
              textAlign: "center",
              breakInside: "avoid",
              color: "#000",
            }}
          >
            <div style={{ fontSize: "9pt", fontWeight: 600, marginBottom: "1mm" }}>
              {label.name}
            </div>
            <Barcode code={label.code} height={40} width="40mm" />
            <div style={{ fontSize: "10pt", fontWeight: 700, marginTop: "1mm" }}>
              {label.price}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
