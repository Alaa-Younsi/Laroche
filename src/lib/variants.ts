import type { VariantPick } from "@/types/db";

/** Mirrors the DB's generated `product_variants.options_key` column (0030) —
 * sorted so custom-group ordering never matters. Used both by the admin
 * combination generator and the storefront's exact-combo lookup, so the two
 * sides can never disagree on what identifies a variant row. */
export function comboKey(color: string | null, size: string | null, options: VariantPick[]): string {
  const optKey = [...options]
    .sort((a, b) => a.name_fr.localeCompare(b.name_fr))
    .map((o) => `${o.name_fr}:${o.value}`)
    .join("|");
  return `${color ?? ""}||${size ?? ""}||${optKey}`;
}
