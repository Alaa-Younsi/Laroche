import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { AdminProfile } from "@/types/db";

// The caller's own admin_profiles row (RLS lets an admin read only that one).
// This MIRRORS the database gate so the UI can hide what the DB would refuse —
// it is never the boundary itself: every table is protected by has_section()
// policies in 0016_admin_permissions.sql.
export function useAdminProfile() {
  const { session, loading: sessionLoading } = useAuth();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["admin-profile", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    retry: 0,
    queryFn: async (): Promise<AdminProfile | null> => {
      const { data, error } = await supabase
        .from("admin_profiles")
        .select("*")
        .eq("user_id", userId as string)
        .maybeSingle();
      // A project that hasn't run 0016 yet has no admin_profiles table at all —
      // treat that as "no profile" rather than crashing the whole dashboard.
      if (error) return null;
      return data;
    },
  });

  const profile = query.data ?? null;
  const isOwner = !!profile?.is_owner && profile.active;
  const isActive = !!profile?.active;

  function hasSection(key: string): boolean {
    if (!profile || !profile.active) return false;
    return profile.is_owner || profile.sections.includes(key);
  }

  return {
    profile,
    isOwner,
    isActive,
    hasSection,
    isLoading: sessionLoading || (!!userId && query.isLoading),
  };
}
