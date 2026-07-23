import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { NewsletterSubscriber } from "@/types/db";

export function useNewsletterSubscribers() {
  return useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: async (): Promise<NewsletterSubscriber[]> => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
