// Vercel Edge function: POST /api/chargily/checkout
// Body: { order_number: string }. Creates a Chargily hosted checkout for the
// order (amount read server-side from the DB) and returns { checkout_url }.
// The Chargily secret key is read from server env and never reaches the browser.
import { createCheckoutForOrder, readChargilyEnv } from "../_lib/chargily";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body: { order_number?: string };
  try {
    body = (await request.json()) as { order_number?: string };
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const origin = new URL(request.url).origin;
  const result = await createCheckoutForOrder(readChargilyEnv((k) => process.env[k]), {
    orderNumber: body.order_number ?? "",
    origin,
  });

  return json(result.status, result.body);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
