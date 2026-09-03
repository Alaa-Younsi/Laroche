import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/db";

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
}

const PRODUCT_SELECT = "*, product_images(*), category:categories(*)";

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: async (): Promise<Product[]> => {
      let query = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active");

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
        if (!collection) return [];
        const { data: links } = await supabase
          .from("product_collections")
          .select("product_id")
          .eq("collection_id", collection.id);
        const ids = (links ?? []).map((l) => l.product_id);
        if (ids.length === 0) return [];
        query = query.in("id", ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
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
    queryFn: async (): Promise<Product[]> => {
      let query = supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .eq("category_id", categoryId)
        .limit(4);
      // `id` is a uuid column — passing "" would be a 400. Only filter when we
      // actually have a product to exclude.
      if (excludeId) query = query.neq("id", excludeId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });
}
