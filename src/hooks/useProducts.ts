import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Product, ProductListItem } from "@/types/db";

function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[,()]/g, "")
    .replace(/[\\%_]/g, "\\$&")
    .slice(0, 100);
}

export interface ProductFilters {
  categoryId?: string;
  /** A category id plus all of its descendant ids — pass this instead of
   * `categoryId` when the selected category may have sub-categories, so
   * picking a parent (e.g. "Hommes") also returns products filed under its
   * children (e.g. "Colliers" under "Hommes"). */
  categoryIds?: string[];
  collectionSlug?: string;
  brandId?: string;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  featured?: boolean;
  /** Cap the rows fetched. Pass this whenever the caller renders a fixed number
   *  of cards — without it the query returns the entire active catalogue. */
  limit?: number;
}

/**
 * Products per Shop page. The grid used to render the whole active catalogue,
 * so a visitor who scrolled to the bottom pulled one thumbnail per product —
 * 309 images / 2.7 MB of Supabase egress on a single visit, growing with every
 * product the client adds. Paging makes that cost independent of catalogue size.
 */
export const SHOP_PAGE_SIZE = 48;

/** Everything a product page needs — descriptions, variant rows, the lot. */
const PRODUCT_SELECT = "*, product_images(*), category:categories(*), product_variants(*)";

// A grid card renders a thumbnail, a name and a price, so a list query has no
// reason to carry description_fr/_ar, details, warranty text, colors, sizes,
// quantity_offers or a per-combination product_variants row. Measured against
// the live catalogue (309 active products): PRODUCT_SELECT returns 487 KB,
// which was the storefront's largest single source of Supabase egress because
// every /boutique load paid it in full.
const LIST_SELECT =
  "id, slug, name_fr, name_ar, price, compare_at_price, category_id, stock, featured, product_images(url, alt)";

function listQuery(withCount: boolean) {
  return supabase
    .from("products")
    .select(LIST_SELECT, withCount ? { count: "exact" } : undefined)
    .eq("status", "active");
}

type ProductQuery = ReturnType<typeof listQuery>;

/**
 * Applies every filter to a products query. Resolves to `null` when a filter
 * can only ever match nothing (an unknown collection, or one with no products),
 * so the caller can skip the round trip instead of sending `id=in.()`.
 *
 * ⚠ The builder is returned WRAPPED in an object on purpose. A
 * PostgrestFilterBuilder is a thenable, and returning a thenable from an async
 * function makes the runtime await it — which fires the query immediately and
 * resolves to a response instead of the builder, so the caller's `.range()` /
 * `.limit()` is `undefined` and every page silently retries.
 */
async function applyProductFilters(
  query: ProductQuery,
  filters: ProductFilters,
): Promise<{ query: ProductQuery } | null> {
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    query = query.in("category_id", filters.categoryIds);
  } else if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.brandId) {
    query = query.eq("brand_id", filters.brandId);
  }
  if (filters.featured) {
    query = query.eq("featured", true);
  }
  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search);
    if (term) {
      query = query.or(`name_fr.ilike.%${term}%,name_ar.ilike.%${term}%`);
    }
  }

  if (filters.sort === "price_asc") {
    query = query.order("price", { ascending: true });
  } else if (filters.sort === "price_desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (filters.collectionSlug) {
    const { data: collection } = await supabase
      .from("collections")
      .select("id")
      .eq("slug", filters.collectionSlug)
      .maybeSingle();
    if (!collection) return null;
    const { data: links } = await supabase
      .from("product_collections")
      .select("product_id")
      .eq("collection_id", collection.id);
    const ids = (links ?? []).map((l) => l.product_id);
    if (ids.length === 0) return null;
    query = query.in("id", ids);
  }

  return { query };
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: async (): Promise<ProductListItem[]> => {
      const built = await applyProductFilters(listQuery(false), filters);
      if (!built) return [];
      const { data, error } = filters.limit
        ? await built.query.limit(filters.limit)
        : await built.query;
      if (error) throw error;
      return (data ?? []) as unknown as ProductListItem[];
    },
  });
}

export interface ProductPage {
  items: ProductListItem[];
  /** Total matching the filters, not the number loaded — the Shop header shows
   *  this, and it is what tells us whether another page exists. */
  total: number;
}

/** Shop grid: one `SHOP_PAGE_SIZE` page at a time behind a "load more". */
export function useInfiniteProducts(filters: ProductFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["products-paged", filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ProductPage> => {
      const built = await applyProductFilters(listQuery(true), filters);
      if (!built) return { items: [], total: 0 };
      const from = pageParam * SHOP_PAGE_SIZE;
      const { data, error, count } = await built.query.range(from, from + SHOP_PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as unknown as ProductListItem[], total: count ?? 0 };
    },
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((n, page) => n + page.items.length, 0);
      return loaded < lastPage.total ? pages.length : undefined;
    },
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ["product", slug],
    enabled: !!slug,
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Product | null;
    },
  });
}

export function useRelatedProducts(categoryId: string | undefined, excludeId: string | undefined) {
  return useQuery({
    queryKey: ["related-products", categoryId, excludeId],
    enabled: !!categoryId,
    queryFn: async (): Promise<ProductListItem[]> => {
      let query = supabase
        .from("products")
        .select(LIST_SELECT)
        .eq("status", "active")
        .eq("category_id", categoryId)
        .limit(4);
      // `id` is a uuid column — passing "" would be a 400. Only filter when we
      // actually have a product to exclude.
      if (excludeId) query = query.neq("id", excludeId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ProductListItem[];
    },
  });
}
