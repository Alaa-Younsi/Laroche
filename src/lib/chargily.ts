// Client helper for the server-only Chargily checkout endpoint. The secret key
// never touches the browser — this only asks our own /api/chargily/checkout to
// create a hosted checkout for an already-placed order and returns the URL to
// redirect the customer to.

export async function createChargilyCheckout(orderNumber: string): Promise<string> {
  const res = await fetch("/api/chargily/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_number: orderNumber }),
  });
  const data = (await res.json().catch(() => null)) as { checkout_url?: string } | null;
  if (!res.ok || !data?.checkout_url) {
    throw new Error("CHARGILY_CHECKOUT_FAILED");
  }
  return data.checkout_url;
}
