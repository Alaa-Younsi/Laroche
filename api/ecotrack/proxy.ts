// Vercel Edge function: /api/ecotrack/proxy?path=<ecotrack-subpath> → ECOTRACK,
// via the shared proxy core. The secret token is read from server env and never
// reaches the browser.
//
// ⚠ Why a flat route with a `path` QUERY PARAM instead of the obvious
// `api/ecotrack/[...path].ts` catch-all: the catch-all was never registered as a
// function on this Vercel project. Every /api/ecotrack/* request fell through to
// the SPA rewrite in vercel.json and was answered with index.html — GET returned
// 200 text/html (which `res.json()` then parsed as null) and POST returned a
// bodiless 405, so "Expédier via ECOTRACK" failed for every order in production
// while working locally through the Vite dev middleware. The flat sibling routes
// (api/chargily/checkout.ts, api/admin/create-worker.ts) were always reached
// fine, so this file deliberately copies that shape.
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

  // `path` selects the ECOTRACK endpoint; everything else is forwarded upstream.
  // It is still checked against the core's whitelist, so it cannot be used to
  // reach an endpoint we have not allowed.
  const search = new URLSearchParams(url.searchParams);
  const subpath = (search.get("path") ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
  search.delete("path");

  const jwt =
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || undefined;
  const body = request.method === "POST" ? await request.text() : undefined;

  const result = await proxyEcotrack(
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
