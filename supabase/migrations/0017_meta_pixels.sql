-- Admin-managed Meta Pixels (multi-pixel, DB-driven).
--
-- The owner runs several campaigns at once with different objectives, so the
-- shop runs several pixels and which one is live depends on the page. Both the
-- pixel IDs and their targeting are edited in /admin/pixels — no redeploy, no
-- snippet in index.html.
--
-- Requires 0016_admin_permissions.sql (has_section / is_admin).

create table if not exists meta_pixels (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,                    -- human name: "Retargeting — hiver"
  pixel_id        text not null check (pixel_id ~ '^[0-9]{10,20}$'),
  active          boolean not null default true,
  scope           text not null default 'all'
                  check (scope in ('all', 'paths', 'products', 'landing')),
  match_values    text[] not null default '{}',
  events          jsonb not null default
    '{"page_view":true,"view_content":true,"add_to_cart":true,"initiate_checkout":true,"purchase":true,"lead":true,"search":true}'::jsonb,
  test_event_code text,
  currency        text not null default 'DZD',
  sort_order      integer not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists meta_pixels_active_idx on meta_pixels (active, sort_order);

drop trigger if exists meta_pixels_set_updated_at on meta_pixels;
create trigger meta_pixels_set_updated_at
before update on meta_pixels
for each row execute function update_updated_at();

alter table meta_pixels enable row level security;

drop policy if exists meta_pixels_anon_select on meta_pixels;
drop policy if exists meta_pixels_admin_read on meta_pixels;
drop policy if exists meta_pixels_admin_write on meta_pixels;

-- The storefront has to read this to know what to load, so anon SELECT is
-- filtered to active = true — a paused campaign's pixel ID must not be
-- readable through the REST API.
create policy meta_pixels_anon_select on meta_pixels
  for select to anon using (active = true);

-- Any active admin can read the full list (harmless config); only the 'pixels'
-- section can change it. Keep the key in sync with src/lib/adminSections.ts
-- and ALLOWED_SECTIONS in api/_lib/adminTeam.ts.
create policy meta_pixels_admin_read on meta_pixels
  for select to authenticated using (is_admin());
create policy meta_pixels_admin_write on meta_pixels
  for all to authenticated
  using (has_section('pixels')) with check (has_section('pixels'));
