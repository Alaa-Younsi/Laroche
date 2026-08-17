import { useMemo } from "react";
import { barcodeRuns, ean13Bits } from "@/lib/barcode";

const MODULES = 95;
const QUIET = 9; // GS1 requires a quiet zone; without it scanners miss the edge guard

/**
 * One EAN-13 symbol as inline SVG.
 *
 * Rendered at module resolution and scaled by the viewBox rather than at pixel
 * sizes: a barcode whose bars land on fractional pixels is the classic reason a
 * printed label will not scan.
 */
export function Barcode({
  code,
  height = 48,
  showText = true,
  className,
}: {
  code: string;
  height?: number;
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

  const width = MODULES + QUIET * 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height + (showText ? 12 : 0)}`}
      className={className}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label={code}
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={width} height={height + (showText ? 12 : 0)} fill="#fff" />
      {runs.map((run) => (
        <rect
          key={run.x}
          x={run.x + QUIET}
          y={2}
          width={run.width}
          height={height - 4}
          fill="#000"
        />
      ))}
      {showText && (
        <text
          x={width / 2}
          y={height + 8}
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
 * chrome (see index.css).
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
            <Barcode code={label.code} height={40} />
            <div style={{ fontSize: "10pt", fontWeight: 700, marginTop: "1mm" }}>
              {label.price}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
