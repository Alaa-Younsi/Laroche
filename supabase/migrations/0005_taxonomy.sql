-- Laroche's catalogue needs three taxonomy shapes the generic schema
-- doesn't cover:
--   - categories are two-level (e.g. "Bijoux en Argent 925" > "Bagues")
--   - collections are tags a product can belong to several of at once
--     (Nouveautés, Best Sellers, Mariage…) — many-to-many, not a category
--   - brands are a flat admin-managed list (Michael Kors, Hugo Boss…)

alter table categories add column parent_id uuid references categories (id) on delete cascade;
create index categories_parent_id_idx on categories (parent_id);

create table collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_fr text not null,
  name_ar text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table product_collections (
  product_id uuid not null references products (id) on delete cascade,
  collection_id uuid not null references collections (id) on delete cascade,
  primary key (product_id, collection_id)
);

create index product_collections_collection_id_idx on product_collections (collection_id);

create table brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table products add column brand_id uuid references brands (id) on delete set null;
create index products_brand_id_idx on products (brand_id);

alter table categories enable row level security;
alter table collections enable row level security;
alter table product_collections enable row level security;
alter table brands enable row level security;

create policy collections_anon_select on collections
  for select to anon using (true);
create policy collections_admin_all on collections
  for all to authenticated using (true) with check (true);

create policy product_collections_anon_select on product_collections
  for select to anon using (
    exists (
      select 1 from products p
      where p.id = product_collections.product_id and p.status = 'active'
    )
  );
create policy product_collections_admin_all on product_collections
  for all to authenticated using (true) with check (true);

create policy brands_anon_select on brands
  for select to anon using (true);
create policy brands_admin_all on brands
  for all to authenticated using (true) with check (true);
