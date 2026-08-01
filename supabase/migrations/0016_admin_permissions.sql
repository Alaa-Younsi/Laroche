-- Staff accounts with per-section permissions.
--
-- Replaces the blanket "any authenticated user can do anything" policies from
-- 0002_rls.sql with a real authorization model:
--   admin_profiles  — one row per person allowed into /admin
--   is_admin()      — has an active profile
--   is_owner()      — active + is_owner (the shop owner)
--   has_section(s)  — owner, or the section is in their granted list
--
-- ⚠ AFTER THIS MIGRATION RUNS, ONLY SEEDED ADMINS CAN WRITE. Every existing
-- Supabase Auth user is seeded as an owner below (step 3), so nobody currently
-- able to log in loses access. Accounts created AFTER this migration (including
-- anyone who self-registers through the public Auth API with the anon key) get
-- no admin_profiles row and therefore no access at all — that is the point.
--
-- The storefront is untouched: anon read policies and the SECURITY DEFINER
-- guest RPCs (place_order, get_order_by_number) keep working exactly as before.

-- 1. table -----------------------------------------------------------------

create table if not exists admin_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  is_owner   boolean not null default false,
  sections   text[] not null default '{}',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table admin_profiles enable row level security;

-- 2. helpers ---------------------------------------------------------------
-- SECURITY DEFINER is REQUIRED, not a shortcut: these read admin_profiles with
-- the definer's rights, bypassing that table's own RLS. Without it, every
-- policy that calls has_section() re-enters admin_profiles' policies and
-- Postgres errors with infinite recursion.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and active
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and active and is_owner
  );
$$;

create or replace function public.has_section(s text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and active and (is_owner or s = any(sections))
  );
$$;

-- 3. seed the owners BEFORE the policies change, or the client is locked out
--    of their own dashboard the moment this file finishes running.

insert into admin_profiles (user_id, email, is_owner, sections)
select id, email, true, '{}'
from auth.users
on conflict (user_id) do update
  set is_owner = true, active = true;

-- 4. admin_profiles' own policies ------------------------------------------
-- A worker may read THEIR OWN row only (that is how the dashboard learns which
-- sections it may show). Only the owner can read the roster or write anything —
-- a worker has no UPDATE policy at all, so they cannot grant themselves a
-- section or flip is_owner.

drop policy if exists admin_profiles_self_select on admin_profiles;
create policy admin_profiles_self_select on admin_profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists admin_profiles_owner_all on admin_profiles;
create policy admin_profiles_owner_all on admin_profiles
  for all to authenticated using (is_owner()) with check (is_owner());

-- 5. rewrite every admin policy -------------------------------------------
-- Pattern: a read policy for any active admin where the data is not sensitive
-- (catalogue, settings — the product form needs categories, the orders list
-- needs delivery prices), and a write policy gated on the owning section.
-- Tables holding customer PII (orders, order_items, newsletter_subscribers)
-- are gated on BOTH read and write.
--
-- Section keys MUST stay in sync with src/lib/adminSections.ts and the
-- ALLOWED_SECTIONS list in api/_lib/adminTeam.ts.

-- categories ---------------------------------------------------------------
drop policy if exists categories_admin_all on categories;
create policy categories_admin_read on categories
  for select to authenticated using (is_admin());
create policy categories_admin_write on categories
  for all to authenticated
  using (has_section('categories')) with check (has_section('categories'));

-- products -----------------------------------------------------------------
drop policy if exists products_admin_all on products;
create policy products_admin_read on products
  for select to authenticated using (is_admin());
create policy products_admin_write on products
  for all to authenticated
  using (has_section('products')) with check (has_section('products'));

-- product_images -----------------------------------------------------------
drop policy if exists product_images_admin_all on product_images;
create policy product_images_admin_read on product_images
  for select to authenticated using (is_admin());
create policy product_images_admin_write on product_images
  for all to authenticated
  using (has_section('products')) with check (has_section('products'));

-- collections / product_collections / brands (0005_taxonomy.sql) ------------
-- Part of the product catalogue: edited from the product form, so they ride
-- along with the 'products' section.
drop policy if exists collections_admin_all on collections;
create policy collections_admin_read on collections
  for select to authenticated using (is_admin());
create policy collections_admin_write on collections
  for all to authenticated
  using (has_section('products')) with check (has_section('products'));

drop policy if exists product_collections_admin_all on product_collections;
create policy product_collections_admin_read on product_collections
  for select to authenticated using (is_admin());
create policy product_collections_admin_write on product_collections
  for all to authenticated
  using (has_section('products')) with check (has_section('products'));

drop policy if exists brands_admin_all on brands;
create policy brands_admin_read on brands
  for select to authenticated using (is_admin());
create policy brands_admin_write on brands
  for all to authenticated
  using (has_section('products')) with check (has_section('products'));

-- store_settings — global config, not a grantable section. Every admin needs
-- it (shipping fee drives the whole checkout), nobody should have to be
-- granted it.
drop policy if exists store_settings_admin_all on store_settings;
create policy store_settings_admin_all on store_settings
  for all to authenticated using (is_admin()) with check (is_admin());

-- delivery_prices ----------------------------------------------------------
drop policy if exists delivery_prices_admin_all on delivery_prices;
create policy delivery_prices_admin_read on delivery_prices
  for select to authenticated using (is_admin());
create policy delivery_prices_admin_write on delivery_prices
  for all to authenticated
  using (has_section('delivery')) with check (has_section('delivery'));

-- orders / order_items — customer names, phone numbers and addresses. Read is
-- gated too, not just write: a worker granted only 'products' must not be able
-- to dump the customer list through PostgREST.
drop policy if exists orders_admin_all on orders;
create policy orders_admin_all on orders
  for all to authenticated
  using (has_section('orders')) with check (has_section('orders'));

drop policy if exists order_items_admin_all on order_items;
create policy order_items_admin_all on order_items
  for all to authenticated
  using (has_section('orders')) with check (has_section('orders'));

-- client_reviews -----------------------------------------------------------
drop policy if exists client_reviews_admin_all on client_reviews;
create policy client_reviews_admin_read on client_reviews
  for select to authenticated using (is_admin());
create policy client_reviews_admin_write on client_reviews
  for all to authenticated
  using (has_section('reviews')) with check (has_section('reviews'));

-- newsletter_subscribers — an email list is PII: read + write both gated.
-- (anon INSERT from the storefront signup form stays untouched.)
drop policy if exists newsletter_subscribers_admin_all on newsletter_subscribers;
create policy newsletter_subscribers_admin_all on newsletter_subscribers
  for all to authenticated
  using (has_section('newsletter')) with check (has_section('newsletter'));

-- 6. storage ---------------------------------------------------------------
-- Object-level RLS per section is not worth it (the tables that reference an
-- upload are gated), but writes should at least require a real admin rather
-- than any authenticated session.

drop policy if exists product_images_bucket_admin_write on storage.objects;
drop policy if exists product_images_bucket_admin_update on storage.objects;
drop policy if exists product_images_bucket_admin_delete on storage.objects;
create policy product_images_bucket_admin_write on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and is_admin());
create policy product_images_bucket_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and is_admin());
create policy product_images_bucket_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and is_admin());

drop policy if exists product_videos_bucket_admin_write on storage.objects;
drop policy if exists product_videos_bucket_admin_update on storage.objects;
drop policy if exists product_videos_bucket_admin_delete on storage.objects;
create policy product_videos_bucket_admin_write on storage.objects
  for insert to authenticated with check (bucket_id = 'product-videos' and is_admin());
create policy product_videos_bucket_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'product-videos' and is_admin());
create policy product_videos_bucket_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'product-videos' and is_admin());
