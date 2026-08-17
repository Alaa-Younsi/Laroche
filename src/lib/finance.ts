// One pure aggregation engine, two dashboards. Nothing here touches Supabase:
// /admin/finance (the website's P&L) and /admin/magasin (the counter's) each map
// their own rows into SaleFact/SaleLine and read the same numbers back.

export interface SaleLine {
  /** Stable grouping key — product id where there is one, else the name. */
  itemKey: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface SaleFact {
  id: string;
  reference: string;
  /** Local YYYY-MM-DD. Always produce it with toLocalDay(). */
  day: string;
  customerName: string;
  subtotal: number;
  discount: number;
  /** Collected for delivery, not margin — excluded from revenue. 0 at a counter. */
  shipping: number;
  lines: SaleLine[];
}

export interface ExpenseFact {
  id: string;
  day: string;
  label: string;
  category: string;
  amount: number;
}

export interface PurchaseFact {
  id: string;
  day: string;
  label: string;
  totalCost: number;
}

// ---- dates -----------------------------------------------------------------

/**
 * Local calendar day for a timestamp.
 *
 * NOT `new Date(iso).toISOString().slice(0,10)`: that re-projects into UTC, so
 * an Algiers sale at 00:30 lands on the previous day and "today's revenue"
 * silently drops orders. A bare YYYY-MM-DD input is returned untouched —
 * parsing it as a Date treats it as UTC midnight and shifts it west of
 * Greenwich, which would move every date-typed column back a day.
 */
export function toLocalDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  // Construct in local time so the arithmetic never crosses a UTC boundary.
  return toLocalDay(new Date(y, m - 1, d + delta));
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const ms = new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime();
  return Math.round(ms / 86_400_000);
}

export type RangePreset = "day" | "week" | "month" | "year" | "max" | "custom";

export interface DateRange {
  preset: RangePreset;
  /** null = unbounded (the `max` preset). */
  from: string | null;
  to: string | null;
}

/**
 * Ranges are TRAILING WINDOWS ENDING TODAY — "week" is the last 7 days
 * including today, not the calendar week. That is what the owner means when
 * they compare "this week vs last week" on a Wednesday.
 */
export function rangeFor(preset: RangePreset, today = toLocalDay(new Date())): DateRange {
  switch (preset) {
    case "day":
      return { preset, from: today, to: today };
    case "week":
      return { preset, from: addDays(today, -6), to: today };
    case "month":
      return { preset, from: addDays(today, -29), to: today };
    case "year":
      return { preset, from: addDays(today, -364), to: today };
    case "max":
      return { preset, from: null, to: null };
    default:
      return { preset: "custom", from: today, to: today };
  }
}

/** The immediately preceding window of equal length, for the delta badges. */
export function previousRange(range: DateRange): DateRange | null {
  if (!range.from || !range.to) return null;
  const span = daysBetween(range.from, range.to) + 1;
  return {
    preset: range.preset,
    from: addDays(range.from, -span),
    to: addDays(range.to, -span),
  };
}

export function inRange(day: string, range: DateRange): boolean {
  if (!day) return false;
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

// ---- totals ----------------------------------------------------------------

export interface Totals {
  /** Σ(subtotal − discount). Shipping excluded: collected for delivery, not margin. */
  revenue: number;
  /** Σ(unitCost × qty). */
  cogs: number;
  grossProfit: number;
  expenses: number;
  /** grossProfit − expenses. Purchases are NOT subtracted here — see below. */
  netProfit: number;
  /** grossProfit / revenue, 0 when there is no revenue. */
  margin: number;
  salesCount: number;
  /**
   * Stock bought in the period. Reported BESIDE netProfit, never inside it:
   * stock bought today and sold next month would otherwise show as a loss this
   * month and a windfall the next.
   */
  purchases: number;
  shipping: number;
}

export function computeTotals(
  facts: SaleFact[],
  expenses: ExpenseFact[],
  purchases: PurchaseFact[],
): Totals {
  let revenue = 0;
  let cogs = 0;
  let shipping = 0;

  for (const fact of facts) {
    revenue += fact.subtotal - fact.discount;
    shipping += fact.shipping;
    for (const line of fact.lines) cogs += line.unitCost * line.quantity;
  }

  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const purchaseTotal = purchases.reduce((sum, p) => sum + p.totalCost, 0);
  const grossProfit = revenue - cogs;

  return {
    revenue,
    cogs,
    grossProfit,
    expenses: expenseTotal,
    netProfit: grossProfit - expenseTotal,
    margin: revenue === 0 ? 0 : grossProfit / revenue,
    salesCount: facts.length,
    purchases: purchaseTotal,
    shipping,
  };
}

// ---- breakdowns ------------------------------------------------------------

export interface ProductRow {
  key: string;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

/**
 * Per-product revenue, with a header discount PRORATED across the lines in
 * proportion to their value — so Σ(line revenue) equals the sale's net revenue
 * and this table reconciles with the summary tiles. A discount applies to a
 * sale, not to any one line; dropping it instead makes the two views disagree
 * and reads as a bug.
 */
export function byProduct(facts: SaleFact[]): ProductRow[] {
  const map = new Map<string, ProductRow>();

  for (const fact of facts) {
    const gross = fact.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const factor = gross > 0 ? (gross - fact.discount) / gross : 1;

    for (const line of fact.lines) {
      const row = map.get(line.itemKey) ?? {
        key: line.itemKey,
        name: line.itemName,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
      };
      row.quantity += line.quantity;
      row.revenue += line.unitPrice * line.quantity * factor;
      row.cost += line.unitCost * line.quantity;
      map.set(line.itemKey, row);
    }
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      profit: row.revenue - row.cost,
      margin: row.revenue === 0 ? 0 : (row.revenue - row.cost) / row.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface CustomerRow {
  name: string;
  orders: number;
  revenue: number;
}

export function byCustomer(facts: SaleFact[]): CustomerRow[] {
  const map = new Map<string, CustomerRow>();
  for (const fact of facts) {
    const name = fact.customerName.trim() || "—";
    const row = map.get(name) ?? { name, orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += fact.subtotal - fact.discount;
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

// ---- the trend series ------------------------------------------------------

export interface SeriesPoint {
  bucket: string;
  label: string;
  revenue: number;
  profit: number;
  expenses: number;
}

/** Past this many days the series switches from daily to monthly buckets — a
 *  year of daily points is 365 unreadable slivers. */
const MONTH_BUCKET_THRESHOLD = 70;

/**
 * Emits EVERY bucket in the window, including empty ones. Plotting only the
 * days that happen to have a sale spaces two sales a fortnight apart the same
 * as two on consecutive days — the line's slope, the whole reason to draw it,
 * becomes meaningless.
 */
export function buildSeries(
  facts: SaleFact[],
  expenses: ExpenseFact[],
  range: DateRange,
): SeriesPoint[] {
  // For `max`, fall back to the extent of the data INCLUDING expense-only days,
  // or a month with costs and no sales is cropped out of its own loss.
  const days = [...facts.map((f) => f.day), ...expenses.map((e) => e.day)].filter(Boolean);
  const from = range.from ?? (days.length ? days.reduce((a, b) => (a < b ? a : b)) : "");
  const to = range.to ?? (days.length ? days.reduce((a, b) => (a > b ? a : b)) : "");
  if (!from || !to || from > to) return [];

  const monthly = daysBetween(from, to) > MONTH_BUCKET_THRESHOLD;
  const bucketOf = (day: string) => (monthly ? day.slice(0, 7) : day);

  const buckets = new Map<string, SeriesPoint>();
  // Cursor loops are capped so a corrupt date can never spin forever inside a
  // render.
  if (monthly) {
    let cursor = from.slice(0, 7);
    const last = to.slice(0, 7);
    for (let i = 0; i < 400 && cursor <= last; i++) {
      buckets.set(cursor, { bucket: cursor, label: cursor, revenue: 0, profit: 0, expenses: 0 });
      const [y, m] = cursor.split("-").map(Number);
      cursor = toLocalDay(new Date(y, m, 1)).slice(0, 7);
    }
  } else {
    let cursor = from;
    for (let i = 0; i < 600 && cursor <= to; i++) {
      buckets.set(cursor, {
        bucket: cursor,
        label: cursor.slice(5),
        revenue: 0,
        profit: 0,
        expenses: 0,
      });
      cursor = addDays(cursor, 1);
    }
  }

  for (const fact of facts) {
    const point = buckets.get(bucketOf(fact.day));
    if (!point) continue;
    const revenue = fact.subtotal - fact.discount;
    const cogs = fact.lines.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
    point.revenue += revenue;
    point.profit += revenue - cogs;
  }

  for (const expense of expenses) {
    const point = buckets.get(bucketOf(expense.day));
    if (!point) continue;
    point.expenses += expense.amount;
    point.profit -= expense.amount;
  }

  return [...buckets.values()];
}

// ---- CSV -------------------------------------------------------------------

/**
 * Same formula-injection guard as the Excel export: a cell starting with
 * = + - @ is executed as a formula by Excel and Sheets when the file is opened,
 * so it is prefixed with an apostrophe before quoting.
 */
export function csvSafe(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvSafe).join(","), ...rows.map((r) => r.map(csvSafe).join(","))].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM is not optional: without it Excel renders the accented French
  // headers as mojibake. Written as an escape, not a literal — a raw U+FEFF in
  // source is invisible in every editor and trips no-irregular-whitespace.
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
