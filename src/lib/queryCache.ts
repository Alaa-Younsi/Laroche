import type { QueryClient } from "@tanstack/react-query";

// A product row is cached under four different keys — the admin table, the
// storefront listings, the single-product page and the "related" rail. An edit
// that only refreshed the admin list left the storefront showing the old price
// for the rest of the session, so every product write invalidates all four.
const PRODUCT_QUERY_KEYS = ["admin-products", "products", "product", "related-products"];

export function invalidateProductCaches(queryClient: QueryClient): void {
  for (const key of PRODUCT_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

// Categories, collections and brands all feed the storefront nav and the
// product form's pickers, and renaming one has to reach both.
const TAXONOMY_QUERY_KEYS = ["categories", "collections", "brands"];

export function invalidateTaxonomyCaches(queryClient: QueryClient): void {
  for (const key of TAXONOMY_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
  // A category rename changes what the product listings show alongside each
  // row (they embed `category:categories(*)`).
  invalidateProductCaches(queryClient);
}
