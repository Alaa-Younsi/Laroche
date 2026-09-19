import { useQuery } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Price } from "@/components/ui/Price";
import { formatPrice } from "@/lib/format";
import { SILVER_TYPES, type SilverType } from "@/types/db";

interface SilverGrade {
  silver_type: SilverType;
  price_per_gram: number;
}

/**
 * The three bulk-silver grades and their current selling rate per gram.
 *
 * `store_products` is gated by RLS on `has_section('store')`, so an account
 * with only the products section reads ZERO rows rather than an error. That is
 * why the calculator hides itself on an empty result instead of rendering an
 * empty grade picker — a staff member who cannot see shop data should not see
 * a broken control.
 */
function useSilverGrades() {
  return useQuery({
    queryKey: ["silver-grades"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SilverGrade[]> => {
      const { data, error } = await supabase
        .from("store_products")
        .select("silver_type, price_per_gram")
        .eq("is_silver_pool", true);
      if (error) throw error;
      const rows = (data ?? []) as SilverGrade[];
      // stable pipeline order (rhodié, bataille, local), never row order
      return SILVER_TYPES.map((st) => rows.find((r) => r.silver_type === st)).filter(
        (r): r is SilverGrade => Boolean(r),
      );
    },
  });
}

/** Same rounding as the till's weighed lines and the SQL generated column, so
 *  a piece priced here matches what the shop would charge for the same grams. */
function silverPrice(weightGrams: number, ratePerGram: number): number {
  return Math.round(weightGrams * ratePerGram * 100) / 100;
}

/**
 * Optional helper on the product form: weight x the chosen grade's rate per
 * gram, written straight into the price field. Entirely opt-in — leaving it
 * untouched keeps the plain "type a price" flow working exactly as before.
 */
export function SilverPriceCalculator({
  weightGrams,
  silverType,
  onChange,
}: {
  weightGrams: number | null;
  silverType: SilverType | null;
  /** Reports the new inputs plus the derived price, or null when it cannot be
   *  derived yet — the form decides whether to accept it into `price`. */
  onChange: (next: {
    weight_grams: number | null;
    silver_type: SilverType | null;
    price: number | null;
  }) => void;
}) {
  const { t } = useLanguage();
  const { data: grades = [] } = useSilverGrades();

  if (grades.length === 0) return null;

  const rate = grades.find((g) => g.silver_type === silverType)?.price_per_gram ?? null;
  const computed =
    weightGrams && weightGrams > 0 && rate != null && rate > 0
      ? silverPrice(weightGrams, rate)
      : null;

  function emit(nextWeight: number | null, nextType: SilverType | null) {
    const nextRate = grades.find((g) => g.silver_type === nextType)?.price_per_gram ?? null;
    const nextPrice =
      nextWeight && nextWeight > 0 && nextRate != null && nextRate > 0
        ? silverPrice(nextWeight, nextRate)
        : null;
    onChange({ weight_grams: nextWeight, silver_type: nextType, price: nextPrice });
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand/30 bg-panel-2/40 p-4">
      <div className="flex items-center gap-2">
        <Calculator size={14} className="text-brand" />
        <h3 className="text-xs uppercase tracking-wide2 text-brand">{t("adminSilverCalc")}</h3>
      </div>
      <p className="text-[0.7rem] leading-snug text-muted">{t("adminSilverCalcHint")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">{t("adminSilverGrade")}</span>
          <Select
            value={silverType ?? ""}
            onChange={(e) => emit(weightGrams, (e.target.value || null) as SilverType | null)}
          >
            <option value="">—</option>
            {grades.map((g) => (
              <option key={g.silver_type} value={g.silver_type}>
                {t(`silverType_${g.silver_type}` as "silverType_local")} —{" "}
                {formatPrice(g.price_per_gram)}/g
              </option>
            ))}
          </Select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted">{t("adminWeightGrams")}</span>
          <Input
            type="number"
            min={0}
            step="0.001"
            dir="ltr"
            value={weightGrams ?? ""}
            onChange={(e) => emit(e.target.value ? Number(e.target.value) : null, silverType)}
          />
        </label>
      </div>

      {computed != null && (
        <div className="flex flex-wrap items-baseline gap-2 border-t border-line pt-3">
          <span className="text-xs text-muted">{t("adminComputedPrice")}</span>
          <Price value={computed} className="text-lg text-brand" />
          <span dir="ltr" className="text-[0.7rem] tabular-nums text-muted">
            {weightGrams} g × {formatPrice(rate ?? 0)}/g
          </span>
        </div>
      )}
    </div>
  );
}
