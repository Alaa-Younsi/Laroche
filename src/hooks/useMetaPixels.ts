import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MetaPixel } from "@/types/db";

// Storefront: the active pixels only (anon RLS also filters to active = true, so
// a paused campaign's ID is not even readable). Long staleTime because campaign
// config changes rarely and every page mounts this; retry: 0 so a project whose
// DB hasn't run 0017 yet degrades to "no pixels" instead of hammering PostgREST.
export function useActivePixels() {
  return useQuery({
    queryKey: ["meta-pixels", "active"],
    staleTime: 60 * 60_000,
    retry: 0,
    queryFn: async (): Promise<MetaPixel[]> => {
      const { data, error } = await supabase
        .from("meta_pixels")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });
}

// Admin: the full list, paused rows included.
export function useAllPixelsAdmin() {
  return useQuery({
    queryKey: ["meta-pixels", "admin"],
    queryFn: async (): Promise<MetaPixel[]> => {
      const { data, error } = await supabase
        .from("meta_pixels")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type PixelDraft = Omit<MetaPixel, "id" | "created_at" | "updated_at"> & { id?: string };

export function useSavePixel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: PixelDraft) => {
      const { id, ...values } = draft;
      const { error } = id
        ? await supabase.from("meta_pixels").update(values).eq("id", id)
        : await supabase.from("meta_pixels").insert(values);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meta-pixels"] }),
  });
}

export function useDeletePixel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meta_pixels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meta-pixels"] }),
  });
}
