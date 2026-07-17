-- RLS policies — anon sees the public storefront surface only;
-- authenticated (admin) has full access. See go-live checklist:
-- public sign-up MUST be disabled in Supabase Auth settings, or any
-- self-registered "authenticated" user gets full admin write access.

alter table categories enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;
alter table store_settings enable row level security;
alter table delivery_prices enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table client_reviews enable row level security;

-- categories
create policy categories_anon_select on categories
  for select to anon using (true);
create policy categories_admin_all on categories
  for all to authenticated using (true) with check (true);

-- products (anon only sees active)
create policy products_anon_select on products
  for select to anon using (status = 'active');
create policy products_admin_all on products
  for all to authenticated using (true) with check (true);

-- product_images
create policy product_images_anon_select on product_images
  for select to anon using (
    exists (
      select 1 from products p
      where p.id = product_images.product_id and p.status = 'active'
    )
  );
create policy product_images_admin_all on product_images
  for all to authenticated using (true) with check (true);

-- store_settings
create policy store_settings_anon_select on store_settings
  for select to anon using (true);
create policy store_settings_admin_all on store_settings
  for all to authenticated using (true) with check (true);

-- delivery_prices
create policy delivery_prices_anon_select on delivery_prices
  for select to anon using (true);
create policy delivery_prices_admin_all on delivery_prices
  for all to authenticated using (true) with check (true);

-- orders / order_items — no anon policy at all; writes go exclusively
-- through the place_order SECURITY DEFINER RPC (0003_functions.sql),
-- reads through get_order_by_number for guests.
create policy orders_admin_all on orders
  for all to authenticated using (true) with check (true);
create policy order_items_admin_all on order_items
  for all to authenticated using (true) with check (true);

-- client_reviews
create policy client_reviews_anon_select on client_reviews
  for select to anon using (active = true);
create policy client_reviews_admin_all on client_reviews
  for all to authenticated using (true) with check (true);

-- storage buckets ---------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('product-videos', 'product-videos', true)
on conflict (id) do nothing;

create policy product_images_bucket_public_read on storage.objects
  for select to public using (bucket_id = 'product-images');
create policy product_images_bucket_admin_write on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');
create policy product_images_bucket_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'product-images');
create policy product_images_bucket_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

create policy product_videos_bucket_public_read on storage.objects
  for select to public using (bucket_id = 'product-videos');
create policy product_videos_bucket_admin_write on storage.objects
  for insert to authenticated with check (bucket_id = 'product-videos');
create policy product_videos_bucket_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'product-videos');
create policy product_videos_bucket_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'product-videos');
