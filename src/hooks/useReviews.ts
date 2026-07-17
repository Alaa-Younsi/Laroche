import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ClientReview } from "@/types/db";

export function useReviews(activeOnly = true) {
  return useQuery({
    queryKey: ["reviews", activeOnly],
    queryFn: async (): Promise<ClientReview[]> => {
      let query = supabase
        .from("client_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (activeOnly) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
