// Vercel Edge function: /api/ecotrack/* → ECOTRACK, via the shared proxy core.
// The secret token is read from server env and never reaches the browser.
import { proxyEcotrack, type EcotrackEnv } from "../_lib/ecotrack";

export const config = { runtime: "edge" };

function readEnv(): EcotrackEnv {
  return {
    apiToken: process.env.ECOTRACK_API_TOKEN ?? "",
    apiUrl: process.env.ECOTRACK_API_URL ?? "https://app.ecotrack.dz",
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  };
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const subpath = url.pathname
    .replace(/^\/api\/ecotrack\//, "")
    .replace(/\/+$/, "");
  const jwt =
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") ||
    undefined;
  const body = request.method === "POST" ? await request.text() : undefined;

  const result = await proxyEcotrack(
    { method: request.method, subpath, search: url.searchParams, body, jwt },
    readEnv(),
  );

  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
    },
  });
}
