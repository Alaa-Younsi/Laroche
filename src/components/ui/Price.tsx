import { formatPrice } from "@/lib/format";

interface PriceProps {
  value: number;
  className?: string;
  /** Rendered before the number, inside the same LTR isolation (e.g. "-" for a discount line). */
  prefix?: string;
}

/**
 * Prices must always render left-to-right, even inside the Arabic/RTL
 * layout. Without this, the Unicode Bidi Algorithm splits a formatted price
 * like "4 500 DA" into separate numeral and Latin-letter runs (the space is
 * a neutral character) and visually reorders them inside an RTL paragraph —
 * e.g. "4 500 DA" renders as "DA 500 4". `dir="ltr"` pins the whole run.
 */
export function Price({ value, className, prefix }: PriceProps) {
  return (
    <span dir="ltr" className={className}>
      {prefix}
      {formatPrice(value)}
    </span>
  );
}
