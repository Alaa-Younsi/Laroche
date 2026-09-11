// Vercel Edge function: /api/noest/proxy?path=<noest-subpath> → NOEST Express,
// via the shared proxy core. The secret api_token/user_guid are read from
// server env and never reach the browser.
//
// A flat route with a `path` QUERY PARAM, not `api/noest/[...path].ts` — this
// deliberately copies api/ecotrack/proxy.ts's shape after that catch-all
// pattern was found to never register as a function on this Vercel project
// (see that file's history): every /api/ecotrack/* request fell through to
// the SPA rewrite in vercel.json and was answered with index.html. The flat
// sibling routes (api/chargily/checkout.ts, api/admin/create-worker.ts) were
// always reached fine, so every proxy on this project now uses this shape.
import { proxyNoest, type NoestEnv } from "../_lib/noest";

export const config = { runtime: "edge" };

function readEnv(): NoestEnv {
  return {
    apiToken: process.env.NOEST_API_TOKEN ?? "",
    userGuid: process.env.NOEST_USER_GUID ?? "",
    apiUrl: process.env.NOEST_API_URL ?? "https://app.noest-dz.com/api/public",
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  };
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // `path` selects the NOEST endpoint; everything else is forwarded upstream.
  // It is still checked against the core's whitelist, so it cannot be used to
  // reach an endpoint we have not allowed.
  const search = new URLSearchParams(url.searchParams);
  const subpath = (search.get("path") ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
  search.delete("path");

  const jwt =
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || undefined;
  const body = request.method === "POST" ? await request.text() : undefined;

  const result = await proxyNoest(
    { method: request.method, subpath, search, body, jwt },
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
