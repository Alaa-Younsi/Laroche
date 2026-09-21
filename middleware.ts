import { next } from "@vercel/edge";

export const config = {
  matcher: "/produit/:slug*",
};

const CRAWLER_UA =
  /facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|Discordbot|LinkedInBot|Slackbot|Pinterest/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default async function middleware(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!CRAWLER_UA.test(userAgent)) return next();

  try {
    const url = new URL(request.url);
    const slug = url.pathname.split("/").pop();
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey || !slug) return next();

    const res = await fetch(
      // product_images.order: PostgREST returns an embedded table unordered, so
      // without this the share preview picked an arbitrary photo instead of the
      // cover the admin chose in ImagesEditor. limit=1 — only rows[0] is read.
      `${supabaseUrl}/rest/v1/products?select=name_fr,description_fr,price,stock,product_images(url)` +
        `&slug=eq.${encodeURIComponent(slug)}&status=eq.active` +
        `&product_images.order=sort_order&limit=1`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (!res.ok) return next();
    const rows = await res.json();
    const product = rows[0];
    if (!product) return next();

    const title = escapeHtml(`${product.name_fr} — Laroche Bijoux`);
    const description = escapeHtml(product.description_fr || "Laroche Bijoux — bijouterie de luxe.");
    const image = escapeHtml(product.product_images?.[0]?.url || `${url.origin}/og-image.jpg`);
    const availability = product.stock > 0 ? "in stock" : "out of stock";

    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta property="og:type" content="product" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${escapeHtml(url.toString())}" />
<meta property="product:price:amount" content="${product.price}" />
<meta property="product:price:currency" content="DZD" />
<meta property="product:availability" content="${availability}" />
<meta name="twitter:card" content="summary_large_image" />
</head>
<body></body>
</html>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return next();
  }
}
