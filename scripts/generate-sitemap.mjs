// Generates public/sitemap.xml at build time (wired as the `prebuild` script)
// so product pages — the money pages, and dynamic — never go stale between
// deploys. Every entry here must exist as a <Route> in src/App.tsx.
import { writeFileSync } from "node:fs";

const SITE_URL = process.env.VITE_SITE_URL || "https://larochebijoux.dz";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const STATIC_ROUTES = ["/", "/boutique"];

async function fetchProductSlugs() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[sitemap] missing Supabase env vars — writing static routes only");
    return [];
  }
  const url = `${SUPABASE_URL}/rest/v1/products?select=slug&status=eq.active`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) {
    console.warn(`[sitemap] products fetch failed (${res.status}) — writing static routes only`);
    return [];
  }
  const rows = await res.json();
  return rows.map((r) => r.slug);
}

function buildXml(routes) {
  const urls = routes
    .map((route) => `  <url><loc>${SITE_URL}${route}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const slugs = await fetchProductSlugs();
const routes = [...STATIC_ROUTES, ...slugs.map((slug) => `/produit/${slug}`)];
writeFileSync("public/sitemap.xml", buildXml(routes));
console.log(`[sitemap] wrote ${routes.length} routes to public/sitemap.xml`);
