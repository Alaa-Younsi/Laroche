import { useMemo } from "react";
import { RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { comboKey } from "@/lib/variants";
import type { ProductColor, VariantGroup, VariantPick } from "@/types/db";

/** A row of the per-variant stock table, whether already persisted (`id` set)
 * or only drafted locally (about to be created on save). */
export interface VariantDraft {
  id?: string;
  color: string | null;
  size: string | null;
  options: VariantPick[];
  sku: string;
  barcode: string;
  stock: number;
  price_override: number | null;
  active: boolean;
}

function comboLabel(color: string | null, size: string | null, options: VariantPick[]): string {
  const parts = [color, size, ...options.map((o) => `${o.name_fr}: ${o.value}`)].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

function cartesian(colors: ProductColor[], sizes: string[], groups: VariantGroup[]) {
  const colorAxis: (string | null)[] = colors.length > 0 ? colors.map((c) => c.label_fr) : [null];
  const sizeAxis: (string | null)[] = sizes.length > 0 ? sizes : [null];

  let optionCombos: VariantPick[][] = [[]];
  for (const g of groups) {
    if (!g.name_fr.trim() || g.values.length === 0) continue;
    const next: VariantPick[][] = [];
    for (const combo of optionCombos) {
      for (const value of g.values) {
        next.push([...combo, { name_fr: g.name_fr, name_ar: g.name_ar, value }]);
      }
    }
    optionCombos = next;
  }

  const combos: Array<{ color: string | null; size: string | null; options: VariantPick[] }> = [];
  for (const color of colorAxis) {
    for (const size of sizeAxis) {
      for (const options of optionCombos) {
        combos.push({ color, size, options });
      }
    }
  }
  return combos;
}

export function VariantsEditor({
  colors,
  sizes,
  groups,
  variants,
  onChange,
}: {
  colors: ProductColor[];
  sizes: string[];
  groups: VariantGroup[];
  variants: VariantDraft[];
  onChange: (next: VariantDraft[]) => void;
}) {
  const definedCombos = useMemo(() => cartesian(colors, sizes, groups), [colors, sizes, groups]);
  const definedKeys = useMemo(
    () => new Set(definedCombos.map((c) => comboKey(c.color, c.size, c.options))),
    [definedCombos],
  );

  const usesVariants = colors.length > 0 || sizes.length > 0 || groups.some((g) => g.name_fr.trim() && g.values.length > 0);
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

  function generate() {
    const existingKeys = new Set(variants.map((v) => comboKey(v.color, v.size, v.options)));
    const additions: VariantDraft[] = definedCombos
      .filter((c) => !existingKeys.has(comboKey(c.color, c.size, c.options)))
      .map((c) => ({
        color: c.color,
        size: c.size,
        options: c.options,
        sku: "",
        barcode: "",
        stock: 0,
        price_override: null,
        active: true,
      }));
    if (additions.length > 0) onChange([...variants, ...additions]);
  }

  function patch(index: number, changes: Partial<VariantDraft>) {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...changes } : v)));
  }

  function remove(index: number) {
    onChange(variants.filter((_, i) => i !== index));
  }

  if (!usesVariants && variants.length === 0) {
    return (
      <p className="text-sm text-muted">
        Définissez au moins une couleur, une taille ou un groupe de variantes personnalisé
        ci-dessus pour activer le stock par variante.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Stock total (somme des variantes) : <span className="font-medium text-ink">{totalStock}</span>
        </p>
        <button
          type="button"
          onClick={generate}
          className="flex items-center gap-2 text-sm text-brand hover:brightness-110"
        >
          <RefreshCw size={14} /> Générer les combinaisons
        </button>
      </div>

      {variants.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide2 text-muted">
                <th className="px-3 py-2 text-start">Combinaison</th>
                <th className="px-3 py-2 text-start">SKU</th>
                <th className="px-3 py-2 text-start">Code-barres</th>
                <th className="px-3 py-2 text-end">Stock</th>
                <th className="px-3 py-2 text-end">Prix (override)</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => {
                const key = comboKey(v.color, v.size, v.options);
                const orphaned = !definedKeys.has(key);
                return (
                  <tr key={v.id ?? key} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink">
                      {comboLabel(v.color, v.size, v.options)}
                      {orphaned && (
                        <span
                          title="Cette combinaison n'existe plus dans les couleurs/tailles/variantes ci-dessus"
                          className="ms-2 inline-flex items-center gap-1 text-[0.65rem] text-amber-500"
                        >
                          <AlertTriangle size={11} /> obsolète
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-28 px-2 py-1.5"
                        value={v.sku}
                        onChange={(e) => patch(i, { sku: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        dir="ltr"
                        className="w-32 px-2 py-1.5"
                        value={v.barcode}
                        onChange={(e) => patch(i, { barcode: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        className="w-20 px-2 py-1.5 text-end"
                        value={v.stock}
                        onChange={(e) => patch(i, { stock: Math.max(0, Number(e.target.value)) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="—"
                        className="w-24 px-2 py-1.5 text-end"
                        value={v.price_override ?? ""}
                        onChange={(e) =>
                          patch(i, { price_override: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label="Supprimer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
