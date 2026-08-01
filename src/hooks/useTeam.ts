import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AdminProfile } from "@/types/db";

// Roster management for the owner. Reads/writes go straight through PostgREST:
// only an active owner has a policy on admin_profiles (0016_admin_permissions),
// so a worker calling these gets zero rows back, not a partial roster.
// Creating an ACCOUNT is different — it needs the service-role key and lives in
// /api/admin/create-worker (see src/lib/adminTeamApi.ts).

export function useWorkers() {
  return useQuery({
    queryKey: ["admin-workers"],
    queryFn: async (): Promise<AdminProfile[]> => {
      const { data, error } = await supabase
        .from("admin_profiles")
        .select("*")
        .eq("is_owner", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; sections?: string[]; active?: boolean }) => {
      const patch: { sections?: string[]; active?: boolean } = {};
      if (input.sections) patch.sections = input.sections;
      if (input.active !== undefined) patch.active = input.active;

      const { error } = await supabase
        .from("admin_profiles")
        .update(patch)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-workers"] }),
  });
}
