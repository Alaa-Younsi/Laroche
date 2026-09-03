import type { Category, CategoryPromotion } from "@/types/db";

export interface ResolvedPromo {
  percent: number;
  endsAt: string;
  label: string | null;
}

/** price after a percentage off, rounded to 2 decimals to match the SQL
 * `round(price * (1 - pct/100), 2)` in place_order / create_manual_order. */
export function promoPrice(price: number, percent: number): number {
  return Math.round(price * (1 - percent / 100) * 100) / 100;
}

/**
 * Build a `categoryId -> best active promo` lookup. A promotion on a parent
 * category applies to every product filed under it or any of its
 * sub-categories, so each promo's category id is expanded to its whole subtree
 * (this mirrors `active_category_promo()` walking UP the tree server-side).
 * When two promos cover the same category the larger percentage wins.
 */
export function buildPromoResolver(
  promotions: CategoryPromotion[],
  categories: Category[],
): (categoryId: string | null | undefined) => ResolvedPromo | null {
  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parent_id) continue;
    const list = childrenByParent.get(c.parent_id) ?? [];
    list.push(c.id);
    childrenByParent.set(c.parent_id, list);
  }

  const subtree = (rootId: string): string[] => {
    const out: string[] = [];
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop() as string;
      out.push(id);
      for (const child of childrenByParent.get(id) ?? []) stack.push(child);
    }
    return out;
  };

  const best = new Map<string, ResolvedPromo>();
  for (const promo of promotions) {
    for (const id of subtree(promo.category_id)) {
      const current = best.get(id);
      if (!current || promo.percent > current.percent) {
        best.set(id, { percent: promo.percent, endsAt: promo.ends_at, label: promo.label });
      }
    }
  }

  return (categoryId) => (categoryId ? best.get(categoryId) ?? null : null);
}
