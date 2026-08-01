// Vercel Edge function: POST /api/chargily/webhook
// Receives Chargily Pay events. Verifies the HMAC-SHA256 `signature` header
// against the RAW body with the secret key, then marks the matching order
// paid/failed via the Supabase service-role key. Set this URL as the Webhook
// endpoint in the Chargily dashboard (Developers Corner).
import { handleWebhook, readChargilyEnv } from "../_lib/chargily";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // The signature is computed over the exact raw bytes — read as text, do not
  // parse-then-restringify before verifying.
  const rawBody = await request.text();
  const signature = request.headers.get("signature");

  const result = await handleWebhook(
    readChargilyEnv((k) => process.env[k]),
    rawBody,
    signature,
  );

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
