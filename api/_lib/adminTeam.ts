// Server-only staff-account creation. Runs in the Vercel Edge function at
// /api/admin/create-worker AND in the Vite dev middleware (see vite.config.ts)
// so `bun run dev` and production share one code path — the same design as
// api/_lib/chargily.ts.
//
// Creating an auth user requires the Supabase SERVICE-ROLE key, which must
// never reach the browser: it bypasses RLS entirely. It lives only here, read
// from server env.
//
// Two things this endpoint must never skip:
//   1. verify the CALLER is an active owner — an authenticated worker must not
//      be able to mint themselves a colleague (or a colleague with more
//      sections than they have);
//   2. re-validate the requested sections against ALLOWED_SECTIONS — the body
//      is client input, so filter, never trust.

// ⚠ Keep in sync with src/lib/adminSections.ts and the has_section('…') strings
// in supabase/migrations/0016_admin_permissions.sql.
export const ALLOWED_SECTIONS = [
  "products",
  "categories",
  "orders",
  "delivery",
  "reviews",
  "newsletter",
  "pixels",
  "finance",
  "store",
] as const;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt truncates past this
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export interface AdminTeamEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
}

export function readAdminTeamEnv(get: (k: string) => string | undefined): AdminTeamEnv {
  return {
    supabaseUrl: get("SUPABASE_URL") ?? get("VITE_SUPABASE_URL") ?? "",
    supabaseAnonKey: get("SUPABASE_ANON_KEY") ?? get("VITE_SUPABASE_ANON_KEY") ?? "",
    serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  };
}

export interface JsonResult {
  status: number;
  body: unknown;
}

export interface CreateWorkerBody {
  email?: unknown;
  password?: unknown;
  sections?: unknown;
}

function base(env: AdminTeamEnv): string {
  return env.supabaseUrl.replace(/\/$/, "");
}

// Resolves the caller's user id from their access token. Returns null for any
// token that Supabase does not accept — expired, forged, or from another
// project.
async function callerUserId(env: AdminTeamEnv, jwt: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${base(env)}/auth/v1/user`, {
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${jwt}` },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return typeof user.id === "string" ? user.id : null;
}

async function isActiveOwner(env: AdminTeamEnv, userId: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(
      `${base(env)}/rest/v1/admin_profiles?user_id=eq.${encodeURIComponent(userId)}&select=is_owner,active`,
      {
        headers: {
          apikey: env.serviceRoleKey,
          Authorization: `Bearer ${env.serviceRoleKey}`,
        },
      },
    );
  } catch {
    return false;
  }
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{ is_owner?: boolean; active?: boolean }>;
  return rows.length === 1 && rows[0].is_owner === true && rows[0].active === true;
}

async function deleteAuthUser(env: AdminTeamEnv, userId: string): Promise<void> {
  await fetch(`${base(env)}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
  }).catch(() => undefined);
}

export async function createWorker(
  env: AdminTeamEnv,
  params: { jwt: string | null; body: CreateWorkerBody },
): Promise<JsonResult> {
  if (!env.supabaseUrl || !env.supabaseAnonKey || !env.serviceRoleKey) {
    return { status: 500, body: { code: "not_configured" } };
  }

  // 1. authenticate + authorize the caller
  if (!params.jwt) return { status: 401, body: { code: "unauthorized" } };
  const userId = await callerUserId(env, params.jwt);
  if (!userId) return { status: 401, body: { code: "unauthorized" } };
  if (!(await isActiveOwner(env, userId))) {
    return { status: 403, body: { code: "forbidden" } };
  }

  // 2. validate the payload
  const email = typeof params.body.email === "string" ? params.body.email.trim().toLowerCase() : "";
  const password = typeof params.body.password === "string" ? params.body.password : "";
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return { status: 400, body: { code: "invalid_email" } };
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { status: 400, body: { code: "weak_password" } };
  }

  // Never trust the requested section list: intersect it with the whitelist.
  const requested = Array.isArray(params.body.sections) ? params.body.sections : [];
  const sections = ALLOWED_SECTIONS.filter((s) => requested.includes(s));

  // 3. create the auth user (email_confirm so a shop employee can log in
  //    immediately — there is no inbox confirmation flow for staff)
  let created: Response;
  try {
    created = await fetch(`${base(env)}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
  } catch {
    return { status: 502, body: { code: "create_failed" } };
  }

  const createdBody = (await created.json().catch(() => ({}))) as {
    id?: string;
    msg?: string;
    message?: string;
    error_code?: string;
  };

  if (!created.ok || !createdBody.id) {
    const detail = `${createdBody.error_code ?? ""} ${createdBody.msg ?? createdBody.message ?? ""}`.toLowerCase();
    if (created.status === 422 || detail.includes("already been registered") || detail.includes("already exists")) {
      return { status: 409, body: { code: "email_exists" } };
    }
    if (detail.includes("password")) {
      return { status: 400, body: { code: "weak_password" } };
    }
    return { status: 502, body: { code: "create_failed" } };
  }

  // 4. grant the sections
  let profile: Response;
  try {
    profile = await fetch(`${base(env)}/rest/v1/admin_profiles`, {
      method: "POST",
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: createdBody.id,
        email,
        is_owner: false,
        sections,
        active: true,
      }),
    });
  } catch {
    await deleteAuthUser(env, createdBody.id);
    return { status: 502, body: { code: "profile_failed" } };
  }

  // Roll back on partial failure: an auth user with no profile can still log in,
  // sees the "no access" screen forever, and blocks the email from being reused.
  if (!profile.ok) {
    await deleteAuthUser(env, createdBody.id);
    return { status: 502, body: { code: "profile_failed" } };
  }

  return { status: 200, body: { ok: true, user_id: createdBody.id, sections } };
}
