// Server-only NOEST Express proxy core. Runs in the Vercel Edge function AND
// the Vite dev middleware (see vite.config.ts) so `bun run dev` and
// production share one code path. NOEST's api_token/user_guid live ONLY here
// (server env); they are never sent to the browser. Every call is gated
// behind a valid Supabase admin session, and only whitelisted
// endpoints/methods are forwarded — the SPA can never turn this into an open
// proxy.
//
// Replaces the ECOTRACK integration (api/_lib/ecotrack.ts, now removed) after
// the client switched couriers. NOEST's raw API (confirmed live against
// https://app.noest-dz.com/api/public, not documented publicly) shares
// ECOTRACK's overall shape — REST-ish endpoints under one base URL, JSON
// errors, no OAuth — but everything else differs: the base path, which
// fields the credentials travel as (api_token + user_guid, never a bearer
// token), and every field name in the create/order payload. That is why this
// is a parallel module and not a drop-in edit of the old one.

export interface NoestEnv {
  apiToken: string;
  userGuid: string;
  apiUrl: string; // e.g. https://app.noest-dz.com/api/public
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface ProxyRequest {
  method: string;
  subpath: string; // e.g. "get/wilayas" or "create/order"
  search: URLSearchParams;
  body: string | undefined; // raw JSON text for POST, forwarded as-is (credentials get merged in)
  jwt: string | undefined; // caller's Supabase access token
}

export interface ProxyResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
}

// Whitelist of forwardable NOEST endpoints → allowed HTTP methods, confirmed
// live (a wrong path 404s with an empty message; a right path but wrong verb
// 405s naming the methods it does support — that is how each of these was
// checked without needing NOEST's own docs). Destructive `delete/order` is
// included since cancelling a mis-created parcel is the only way to undo one
// — NOEST has no "draft" stage; create/order ships a real parcel immediately.
const ALLOW: Record<string, string[]> = {
  "get/wilayas": ["GET"],
  "get/communes": ["GET"],
  "create/order": ["POST"],
  "update/order": ["POST"],
  "valid/order": ["POST"], // "expédier" — dispatch a parcel to the courier
  "delete/order": ["POST"], // cancel a parcel
  "get/trackings/info": ["POST"], // NOEST reads this one via POST, not GET
  "get/order/label": ["GET"],
};

function json(status: number, obj: unknown): ProxyResponse {
  return {
    status,
    contentType: "application/json",
    body: new TextEncoder().encode(JSON.stringify(obj)),
  };
}

// Dispatching/creating/cancelling a parcel is an ORDERS action, so the caller
// must be an active admin who actually holds that section
// (0016_admin_permissions.sql) — a valid session alone is not enough now that
// staff accounts exist, and a deactivated worker's token stays valid until it
// expires.
//
// No service-role key needed: admin_profiles' RLS lets a caller read their OWN
// row, so asking with the caller's own token returns their row or nothing.
async function isAdmin(jwt: string | undefined, env: NoestEnv): Promise<boolean> {
  if (!jwt) return false;
  const base = env.supabaseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return false;

    const profileRes = await fetch(
      `${base}/rest/v1/admin_profiles?select=is_owner,active,sections`,
      { headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${jwt}` } },
    );
    if (!profileRes.ok) return false;
    const rows = (await profileRes.json()) as Array<{
      is_owner?: boolean;
      active?: boolean;
      sections?: string[];
    }>;
    const profile = rows[0];
    if (!profile?.active) return false;
    return profile.is_owner === true || (profile.sections ?? []).includes("orders");
  } catch {
    return false;
  }
}

export async function proxyNoest(req: ProxyRequest, env: NoestEnv): Promise<ProxyResponse> {
  if (!env.apiToken || !env.userGuid || !env.apiUrl) {
    return json(500, { error: "NOEST is not configured on the server." });
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return json(500, { error: "Supabase auth is not configured on the server." });
  }

  if (!(await isAdmin(req.jwt, env))) {
    return json(401, { error: "Unauthorized" });
  }

  const methods = ALLOW[req.subpath];
  if (!methods) return json(403, { error: `Endpoint not allowed: ${req.subpath}` });
  if (!methods.includes(req.method)) {
    return json(405, { error: `Method ${req.method} not allowed for ${req.subpath}` });
  }

  const url = new URL(`${env.apiUrl.replace(/\/$/, "")}/${req.subpath}`);
  const init: RequestInit = { method: req.method, headers: { Accept: "application/json" } };

  if (req.method === "GET") {
    // NOEST's GET endpoints (get/wilayas, get/communes, get/order/label) read
    // credentials from the query string alongside whatever the caller passed
    // (e.g. `tracking` for the label).
    for (const [key, value] of req.search) url.searchParams.set(key, value);
    url.searchParams.set("api_token", env.apiToken);
    url.searchParams.set("user_guid", env.userGuid);
  } else {
    // Every write endpoint reads api_token/user_guid from the JSON body
    // instead — confirmed live against create/order. Merge them into
    // whatever the caller sent rather than trusting the caller to include
    // them (it never has the secret token to include).
    let payload: Record<string, unknown>;
    try {
      payload = req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {};
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }
    payload.api_token = env.apiToken;
    payload.user_guid = env.userGuid;
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(payload);
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    return json(502, { error: "NOEST unreachable", detail: String(err) });
  }

  // Pass the upstream response straight through — transparently handles JSON
  // as well as the binary PDF returned by get/order/label.
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  return {
    status: upstream.status,
    contentType: upstream.headers.get("content-type") ?? "application/json",
    body: bytes,
  };
}
