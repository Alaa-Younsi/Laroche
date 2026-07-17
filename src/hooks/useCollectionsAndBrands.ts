import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Collection {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  sort_order: number;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  sort_order: number;
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: async (): Promise<Collection[]> => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
