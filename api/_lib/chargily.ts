// Server-only Chargily Pay v2 core. Runs in the Vercel Edge functions AND the
// Vite dev middleware (see vite.config.ts) so `bun run dev` and production
// share one code path — the same design as api/_lib/ecotrack.ts.
//
// The Chargily SECRET key and the Supabase SERVICE-ROLE key live ONLY here
// (server env); neither is ever sent to the browser. The checkout amount is
// always read back from the database (orders.total), never trusted from the
// client — a customer can't pay a price they invented.

const CHARGILY_API_BASE = "https://pay.chargily.com/api/v2";

export interface ChargilyEnv {
  secretKey: string; // test_sk_… or live_sk_…
  apiBase: string; // override of CHARGILY_API_BASE (rarely needed)
  siteUrl: string; // public origin for success/failure/webhook URLs (optional)
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string; // used only by the webhook to mark orders paid
}

export function readChargilyEnv(
  get: (k: string) => string | undefined,
): ChargilyEnv {
  return {
    secretKey: get("CHARGILY_SECRET_KEY") ?? "",
    apiBase: get("CHARGILY_API_URL") ?? CHARGILY_API_BASE,
    siteUrl: get("PUBLIC_SITE_URL") ?? get("VITE_SITE_URL") ?? "",
    supabaseUrl: get("SUPABASE_URL") ?? get("VITE_SUPABASE_URL") ?? "",
    supabaseAnonKey: get("SUPABASE_ANON_KEY") ?? get("VITE_SUPABASE_ANON_KEY") ?? "",
    serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  };
}

export interface JsonResult {
  status: number;
  body: unknown;
}

function base(env: ChargilyEnv): string {
  return env.apiBase.replace(/\/$/, "");
}

async function callSupabaseRpc(
  env: ChargilyEnv,
  fn: string,
  args: Record<string, unknown>,
  key: string,
): Promise<Response> {
  return fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
}

interface OrderRecap {
  order_number: string;
  total: number;
  status: string;
  language: string;
}

// Creates a Chargily checkout for an already-placed order. The amount comes
// from the DB (get_order_by_number), so it is authoritative. Returns the hosted
// checkout URL the browser is redirected to.
export async function createCheckoutForOrder(
  env: ChargilyEnv,
  params: { orderNumber: string; origin: string },
): Promise<JsonResult> {
  if (!env.secretKey) {
    return { status: 500, body: { error: "Chargily is not configured on the server." } };
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return { status: 500, body: { error: "Supabase is not configured on the server." } };
  }

  const orderNumber = (params.orderNumber ?? "").trim();
  if (!orderNumber || orderNumber.length > 40) {
    return { status: 400, body: { error: "Missing or invalid order_number." } };
  }

  // 1. authoritative amount from the DB
  const recapRes = await callSupabaseRpc(
    env,
    "get_order_by_number",
    { p_order_number: orderNumber },
    env.supabaseAnonKey,
  );
  if (!recapRes.ok) {
    return { status: 502, body: { error: "Could not load the order." } };
  }
  const recap = (await recapRes.json()) as OrderRecap | null;
  if (!recap) {
    return { status: 404, body: { error: "Order not found." } };
  }
  const amount = Math.round(Number(recap.total));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { error: "Order total is invalid." } };
  }

  // 2. build the redirect/webhook URLs from the public origin
  const origin = (env.siteUrl || params.origin).replace(/\/$/, "");
  const locale = recap.language === "ar" ? "ar" : "fr";

  const payload = {
    amount,
    currency: "dzd",
    success_url: `${origin}/commande/${encodeURIComponent(orderNumber)}?payment=success`,
    failure_url: `${origin}/commande/${encodeURIComponent(orderNumber)}?payment=failed`,
    webhook_endpoint: `${origin}/api/chargily/webhook`,
    description: `Laroche Bijoux — commande ${orderNumber}`,
    locale,
    metadata: [{ order_number: orderNumber }],
  };

  // 3. create the checkout
  let created: Response;
  try {
    created = await fetch(`${base(env)}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { status: 502, body: { error: "Chargily unreachable", detail: String(err) } };
  }

  const checkout = (await created.json()) as { id?: string; checkout_url?: string; message?: unknown };
  if (!created.ok || !checkout.checkout_url) {
    return { status: 502, body: { error: "Chargily checkout failed", detail: checkout } };
  }

  // 4. link the checkout id to the order (best-effort; failure here doesn't
  //    stop the customer from paying, the webhook still resolves by number)
  await callSupabaseRpc(
    env,
    "attach_checkout",
    { p_order_number: orderNumber, p_checkout_id: checkout.id ?? null },
    env.supabaseAnonKey,
  ).catch(() => undefined);

  return { status: 200, body: { checkout_url: checkout.checkout_url, checkout_id: checkout.id } };
}

// --- webhook -------------------------------------------------------------

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string compare — avoids leaking how many leading chars matched.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// HMAC-SHA256 of the RAW request body with the secret key, per Chargily docs:
// the `signature` header must equal this hex digest.
export async function verifyWebhookSignature(
  secretKey: string,
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!secretKey || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(hex(mac), signature.trim().toLowerCase());
}

interface ChargilyEvent {
  type?: string;
  data?: { metadata?: Array<Record<string, unknown>> | Record<string, unknown>; id?: string };
}

function orderNumberFromEvent(event: ChargilyEvent): string | null {
  const md = event.data?.metadata;
  if (Array.isArray(md)) {
    for (const entry of md) {
      if (entry && typeof entry.order_number === "string") return entry.order_number;
    }
  } else if (md && typeof (md as Record<string, unknown>).order_number === "string") {
    return (md as Record<string, unknown>).order_number as string;
  }
  return null;
}

// Verifies the signature, then applies the payment result to the order using
// the service-role key. Returns the HTTP status the endpoint should reply with
// (2xx so Chargily stops retrying; 4xx/5xx so it retries).
export async function handleWebhook(
  env: ChargilyEnv,
  rawBody: string,
  signature: string | null,
): Promise<JsonResult> {
  if (!(await verifyWebhookSignature(env.secretKey, rawBody, signature))) {
    return { status: 403, body: { error: "Invalid signature" } };
  }
  if (!env.serviceRoleKey || !env.supabaseUrl) {
    return { status: 500, body: { error: "Webhook DB access is not configured." } };
  }

  let event: ChargilyEvent;
  try {
    event = JSON.parse(rawBody) as ChargilyEvent;
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }

  const orderNumber = orderNumberFromEvent(event);
  const checkoutId = event.data?.id ?? null;
  if (!orderNumber) {
    // Nothing to reconcile, but signature was valid — ack so Chargily stops.
    return { status: 200, body: { ok: true, note: "no order_number in metadata" } };
  }

  if (event.type === "checkout.paid") {
    const res = await callSupabaseRpc(
      env,
      "mark_order_paid",
      { p_order_number: orderNumber, p_checkout_id: checkoutId },
      env.serviceRoleKey,
    );
    if (!res.ok) return { status: 500, body: { error: "Failed to mark paid" } };
    return { status: 200, body: { ok: true } };
  }

  if (event.type === "checkout.failed" || event.type === "checkout.canceled" || event.type === "checkout.expired") {
    await callSupabaseRpc(
      env,
      "mark_order_failed",
      { p_order_number: orderNumber },
      env.serviceRoleKey,
    ).catch(() => undefined);
    return { status: 200, body: { ok: true } };
  }

  return { status: 200, body: { ok: true, ignored: event.type } };
}
