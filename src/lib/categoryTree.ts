import type { Category } from "@/types/db";

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

/** Builds an arbitrary-depth tree from the flat, self-referencing (parent_id) table. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const c of categories) {
    const list = byParent.get(c.parent_id) ?? [];
    list.push(c);
    byParent.set(c.parent_id, list);
  }
  function attach(parentId: string | null): CategoryNode[] {
    return (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: attach(c.id) }));
  }
  return attach(null);
}

/** A node's own id plus every descendant id, for "show products in this
 * category or any of its sub-categories" filtering. */
export function collectDescendantIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(collectDescendantIds)];
}

export function findCategoryNode(nodes: CategoryNode[], id: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findCategoryNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export function findCategoryNodeBySlug(nodes: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findCategoryNodeBySlug(node.children, slug);
    if (found) return found;
  }
  return undefined;
}

/** Flattens the tree back out with a `depth` (0 = top-level) — handy for
 * indented `<select>`/list rendering that needs every node regardless of nesting. */
export function flattenCategoryTree(
  nodes: CategoryNode[],
  depth = 0,
): Array<{ node: CategoryNode; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ]);
}
