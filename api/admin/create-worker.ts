// Vercel Edge function: POST /api/admin/create-worker
// Body: { email, password, sections[] }. Creates a staff Supabase Auth account
// and its admin_profiles row. Only an active OWNER may call it — the caller's
// access token is verified server-side (see api/_lib/adminTeam.ts).
// The service-role key is read from server env and never reaches the browser.
import { createWorker, readAdminTeamEnv, type CreateWorkerBody } from "../_lib/adminTeam";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { code: "method_not_allowed" });
  }

  let body: CreateWorkerBody;
  try {
    body = (await request.json()) as CreateWorkerBody;
  } catch {
    return json(400, { code: "invalid_json" });
  }

  const jwt = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || null;
  const result = await createWorker(readAdminTeamEnv((k) => process.env[k]), { jwt, body });

  return json(result.status, result.body);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
