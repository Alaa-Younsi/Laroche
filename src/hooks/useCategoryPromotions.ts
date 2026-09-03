import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { buildPromoResolver, type ResolvedPromo } from "@/lib/promo";
import { useCategories } from "@/hooks/useCategories";
import type { CategoryPromotion } from "@/types/db";

/** Every promotion, running or not — for the admin management table. */
export function useCategoryPromotions() {
  return useQuery({
    queryKey: ["category-promotions", "all"],
    queryFn: async (): Promise<CategoryPromotion[]> => {
      const { data, error } = await supabase
        .from("category_promotions")
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Only the promotions active right now — for storefront pricing. */
export function useActiveCategoryPromotions() {
  return useQuery({
    queryKey: ["category-promotions", "active"],
    staleTime: 60_000,
    queryFn: async (): Promise<CategoryPromotion[]> => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("category_promotions")
        .select("*")
        .lte("starts_at", now)
        .gt("ends_at", now);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * `resolve(categoryId)` → the best active promo for a product in that category,
 * or null. Safe to call before the queries settle (returns null).
 */
export function useCategoryPromoResolver(): {
  resolve: (categoryId: string | null | undefined) => ResolvedPromo | null;
  isLoading: boolean;
} {
  const { data: promotions = [], isLoading: pl } = useActiveCategoryPromotions();
  const { data: categories = [], isLoading: cl } = useCategories();
  const resolve = useMemo(
    () => buildPromoResolver(promotions, categories),
    [promotions, categories],
  );
  return { resolve, isLoading: pl || cl };
}

export type CategoryPromotionDraft = {
  id?: string;
  category_id: string;
  percent: number;
  starts_at: string;
  ends_at: string;
  label?: string | null;
};

export function useSaveCategoryPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: CategoryPromotionDraft) => {
      const { id, ...values } = draft;
      const { error } = id
        ? await supabase.from("category_promotions").update(values).eq("id", id)
        : await supabase.from("category_promotions").insert(values);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["category-promotions"] }),
  });
}

export function useDeleteCategoryPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("category_promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["category-promotions"] }),
  });
}
