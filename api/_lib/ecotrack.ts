// Server-only ECOTRACK proxy core. Runs in the Vercel Edge function AND the
// Vite dev middleware (see vite.config.ts) so `bun run dev` and production
// share one code path. The ECOTRACK api_token lives ONLY here (server env);
// it is never sent to the browser. Every call is gated behind a valid
// Supabase admin session, and only whitelisted endpoints/methods are
// forwarded — the SPA can never turn this into an open proxy.

export interface EcotrackEnv {
  apiToken: string;
  apiUrl: string; // e.g. https://app.ecotrack.dz
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface ProxyRequest {
  method: string;
  subpath: string; // e.g. "validate/token" or "get/wilayas"
  search: URLSearchParams;
  body: string | undefined; // raw JSON text for POST, forwarded as-is
  jwt: string | undefined; // caller's Supabase access token
}

export interface ProxyResponse {
  status: number;
  contentType: string;
  body: Uint8Array;
}

// Whitelist of forwardable ECOTRACK endpoints → allowed HTTP methods.
// Destructive/bulk operations (delete/order, create/orders, valid/returns)
// are deliberately omitted — least privilege. Add them here if ever needed.
const ALLOW: Record<string, string[]> = {
  "validate/token": ["GET"],
  "get/wilayas": ["GET"],
  "get/communes": ["GET"],
  "get/fees": ["GET"],
  "get/products/list": ["GET"],
  "get/tracking/info": ["GET"],
  "get/maj": ["GET"],
  "get/order/label": ["GET"],
  "get/orders": ["GET"],
  "get/orders/status": ["GET"],
  "create/order": ["POST"],
  "update/order": ["POST"],
  "valid/order": ["POST"], // "expédier" — dispatch a parcel to the courier
  "add/maj": ["POST"],
  "ask/for/order/return": ["POST"],
};

function json(status: number, obj: unknown): ProxyResponse {
  return {
    status,
    contentType: "application/json",
    body: new TextEncoder().encode(JSON.stringify(obj)),
  };
}

// Any authenticated Supabase user is an admin here — public sign-up is
// disabled (see 0002_rls.sql), matching the app's own RLS model where the
// `authenticated` role has full access. Verified by asking Supabase whether
// the presented access token resolves to a user; no service-role key needed.
async function isAdmin(jwt: string | undefined, env: EcotrackEnv): Promise<boolean> {
  if (!jwt) return false;
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${jwt}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function proxyEcotrack(
  req: ProxyRequest,
  env: EcotrackEnv,
): Promise<ProxyResponse> {
  if (!env.apiToken || !env.apiUrl) {
    return json(500, { error: "ECOTRACK is not configured on the server." });
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

  const url = new URL(`${env.apiUrl.replace(/\/$/, "")}/api/v1/${req.subpath}`);
  for (const [key, value] of req.search) url.searchParams.set(key, value);
  // Inject the secret token server-side. ECOTRACK reads it from the query on
  // both GET and POST (Laravel merges query + body), so this covers all routes.
  url.searchParams.set("api_token", env.apiToken);

  const init: RequestInit = { method: req.method };
  if (req.method === "POST") {
    init.headers = { "Content-Type": "application/json", Accept: "application/json" };
    init.body = req.body && req.body.length > 0 ? req.body : "{}";
  } else {
    init.headers = { Accept: "application/json" };
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    return json(502, { error: "ECOTRACK unreachable", detail: String(err) });
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
