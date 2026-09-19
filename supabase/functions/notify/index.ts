// @ts-nocheck — this file runs on Deno (Supabase Edge Functions), not in the
// Vite/browser TypeScript project. The editor's default TS server does not know
// the `Deno` global and cannot resolve `https://` imports, so it reports errors
// on correct code. `supabase/functions/deno.json` + `.vscode/settings.json`
// hand this folder to the Deno language server, which type-checks it properly;
// this directive keeps the plain TS server quiet if that extension is absent.
// It does NOT affect deployment — `supabase functions deploy` type-checks with
// Deno regardless.

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// Order notification dispatcher — email via Resend.
//
// Deploy:  supabase functions deploy notify
// Secrets: supabase secrets set RESEND_API_KEY=re_xxx [RESEND_FROM="..."] [SITE_ADMIN_URL=...]
//
// Called by the SHOPPER'S browser right after place_order succeeds, so there is
// no admin session at that point. That single fact drives the design:
//
//   * it runs with the SERVICE-ROLE key and reads admin_notification_prefs
//     directly (RLS on that table is irrelevant to this caller);
//   * anything an anonymous caller can reach can be replayed or probed, so the
//     claim RPC is an atomic `update ... where notified_at is null returning`.
//     Every order notifies AT MOST ONCE, ever, and a probe is indistinguishable
//     from a duplicate: both get "nothing to do".
//
// Default JWT verification is fine — the anon key IS a valid Supabase JWT and
// supabase-js sends it automatically for a signed-out caller. No
// --no-verify-jwt needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Resend's sandbox sender works before the client's domain is verified, but
// only delivers to the address the Resend ACCOUNT was signed up with — enough
// to test the whole pipeline on day one. Once the domain verifies in Resend,
// set RESEND_FROM to "Laroche Bijoux <commandes@larochebijoux.com>" and
// redeploy; no code changes.
const DEFAULT_FROM = "Laroche Bijoux <onboarding@resend.dev>";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface OrderRow {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  wilaya: string;
  city: string;
  total: number;
  item_count: number;
  created_at: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(n: number): string {
  return `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 2 }).format(n)} DA`;
}

function buildEmail(order: OrderRow, adminUrl: string | null) {
  const subject = `Nouvelle commande ${order.order_number} — ${money(order.total)}`;
  const rows: [string, string][] = [
    ["Commande", order.order_number],
    ["Client", order.customer_name],
    ["Téléphone", order.customer_phone],
    ["Wilaya", `${order.wilaya}${order.city ? ` — ${order.city}` : ""}`],
    ["Articles", String(order.item_count)],
    ["Total", money(order.total)],
  ];

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#faf9f6;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1a1a1a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e2d8;border-radius:12px;padding:24px">
    <h1 style="margin:0 0 4px;font-size:18px;font-weight:600">Nouvelle commande</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#77716a">Laroche Bijoux</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:7px 0;color:#77716a">${escapeHtml(label)}</td>` +
            `<td style="padding:7px 0;text-align:right;font-weight:600">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}
    </table>
    ${
      adminUrl
        ? `<p style="margin:22px 0 0"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px">Ouvrir le tableau de bord</a></p>`
        : ""
    }
  </div>
</body></html>`;

  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  return { subject, html, text };
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  mail: { subject: string; html: string; text: string },
): Promise<void> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) {
    // Logged, never rethrown past the fan-out: one bad address must not stop
    // the others, and nothing here may reach the shopper.
    console.error("resend send failed", res.status, (await res.text()).slice(0, 300));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ code: "method_not_allowed" }, 405);

  let body: { kind?: string; order_number?: string };
  try {
    body = await req.json();
  } catch {
    return json({ code: "bad_request" }, 400);
  }

  // Routed on `kind` so a second event type (contact message, …) is one more
  // branch plus its own claim RPC — the recipient lookup and sender below stay
  // shared.
  if (body.kind !== "order" || !body.order_number) return json({ code: "bad_request" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !serviceKey) return json({ code: "not_configured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Atomic claim. An already-notified order (retry, double invoke, probe)
  // returns zero rows and we stop here, revealing nothing either way.
  const { data: claimed, error: claimError } = await admin.rpc("claim_order_notification", {
    p_order_number: body.order_number,
  });
  if (claimError) {
    console.error("claim failed", claimError.message);
    return json({ code: "claim_failed" }, 500);
  }
  const order = (claimed as OrderRow[] | null)?.[0];
  if (!order) return json({ ok: true, claimed: false });

  // No key configured yet: the order is already claimed, so say so plainly in
  // the logs rather than pretending a mail went out.
  if (!resendKey) {
    console.error("RESEND_API_KEY missing — order claimed but no email sent");
    return json({ ok: true, claimed: true, sent: 0 });
  }

  const { data: recipients, error: recipientsError } = await admin
    .from("admin_notification_prefs")
    .select("notify_email, email_enabled, admin_profiles!inner(active)")
    .eq("email_enabled", true)
    .eq("admin_profiles.active", true);
  if (recipientsError) {
    console.error("recipient lookup failed", recipientsError.message);
    return json({ code: "lookup_failed" }, 500);
  }

  const addresses = ((recipients ?? []) as { notify_email: string | null }[])
    .map((r: { notify_email: string | null }) => (r.notify_email ?? "").trim())
    .filter((email: string) => email.includes("@"));
  if (addresses.length === 0) return json({ ok: true, claimed: true, sent: 0 });

  const from = Deno.env.get("RESEND_FROM") || DEFAULT_FROM;
  const adminUrl = Deno.env.get("SITE_ADMIN_URL") || null;
  const mail = buildEmail(order, adminUrl);

  // allSettled, not all: one recipient's failure must never block another's.
  await Promise.allSettled(addresses.map((to: string) => sendEmail(resendKey, from, to, mail)));

  return json({ ok: true, claimed: true, sent: addresses.length });
});
