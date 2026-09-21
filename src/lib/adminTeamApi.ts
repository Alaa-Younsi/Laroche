import { supabase } from "@/lib/supabase";
import type { TranslationKey } from "@/i18n/translations";

// Client helper for the server-only staff-account endpoint. Account creation
// needs the service-role key, so it happens in /api/admin/create-worker — this
// only forwards the owner's own access token so the server can verify who is
// asking (see api/_lib/adminTeam.ts).

export class CreateWorkerError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "CreateWorkerError";
    this.code = code;
  }
}

export async function createWorkerAccount(input: {
  email: string;
  password: string;
  sections: string[];
}): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CreateWorkerError("unauthorized");

  let res: Response;
  try {
    res = await fetch("/api/admin/create-worker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new CreateWorkerError("network");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    throw new CreateWorkerError(body?.code ?? "create_failed");
  }
}

// One generic message for every failure makes "this email already exists" look
// like a bug — map the server's machine-readable code instead.
export function createWorkerErrorKey(code: string): TranslationKey {
  switch (code) {
    case "email_exists":
      return "teamErrorEmailExists";
    case "weak_password":
      return "teamErrorWeakPassword";
    case "invalid_email":
      return "teamErrorInvalidEmail";
    case "unauthorized":
    case "forbidden":
      return "teamErrorForbidden";
    case "not_configured":
      return "teamErrorNotConfigured";
    default:
      return "teamErrorGeneric";
  }
}
