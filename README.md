# Laroche Bijoux

Production e-commerce platform for **Laroche Bijoux**, an Algerian jewelry retailer.
Bilingual (French / Arabic, full RTL) storefront with cash-on-delivery checkout, an
admin dashboard, and an in-store point-of-sale system.

Live site: <https://www.larochebijoux.com>

---

## Stack

| Layer      | Technology                                                        |
| ---------- | --------------------------------------------------------------- |
| Frontend   | React 19, TypeScript (strict), Vite, Tailwind CSS, Framer Motion |
| Data       | React Query, Zustand                                             |
| Forms      | react-hook-form + Zod                                            |
| Backend    | Supabase (Postgres, Auth, Storage, RLS)                          |
| Serverless | Vercel Functions (`/api`) — Chargily payments, ECOTRACK shipping |
| Hosting    | Vercel                                                           |
| Tooling    | Bun (runtime + package manager), ESLint                          |

## Features

- **Storefront** — catalogue, product pages, cart, COD checkout, newsletter, store locator
- **Payments** — cash on delivery + Chargily Pay (card / EDAHABIA / CIB)
- **Shipping** — ECOTRACK integration for parcel creation and tracking, 58-wilaya delivery grid
- **Admin dashboard** — orders, products, categories, timed category-wide promotions,
  manual order entry, per-section staff permissions, configurable GA4 / Meta pixels
- **Magasin POS** — multi-shop point of sale, thermal (58 mm) receipts, EAN-13 barcodes,
  bulk-silver gram pool with weighted-average costing
- **Finance** — revenue, cost and margin reporting with SQL-side aggregation

## Getting started

```bash
bun install
bun run dev
```

Create a `.env` from the variables below (never commit it):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SITE_URL=
VITE_GA_MEASUREMENT_ID=
VITE_META_PIXEL_ID=

# server-only (Vercel env, never exposed to the client)
ECOTRACK_API_TOKEN=
ECOTRACK_API_URL=
CHARGILY_SECRET_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_SITE_URL=
```

## Scripts

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `bun run dev`       | Start the dev server                     |
| `bun run build`     | Type-check and build for production      |
| `bun run typecheck` | TypeScript check only                    |
| `bun run lint`      | ESLint (zero warnings allowed)           |
| `bun run preview`   | Preview the production build locally     |

## Database migrations

SQL migrations live in `supabase/migrations/` and are applied **manually, in order**,
through the Supabase SQL editor. There is no linked Supabase CLI.

## Project structure

```
api/                  Vercel serverless functions (payments, shipping, admin)
scripts/              Build + image-optimization scripts
src/
  components/         UI, layout, product, admin, effects
  pages/             Route components (storefront + /admin)
  hooks/             Data hooks (React Query)
  lib/               Supabase client, schemas, helpers
  i18n/              FR / AR translations and language provider
  store/             Zustand stores
  theme/             Theme provider
supabase/migrations/  Ordered SQL schema + RLS + RPCs
```

---

## License and use

**All rights reserved.**

This repository and its contents are the proprietary property of Laroche Bijoux and its
author. It is published for reference only. No permission is granted to use, copy, modify,
merge, publish, distribute, sublicense, or sell any part of this code, its design, or its
assets, in whole or in part, for any purpose. Any reuse without prior written authorization
is prohibited.

Developed by [Alaa Younsi](https://alaayounsi.vercel.app/).
