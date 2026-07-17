-- Laroche Bijoux — core schema

create extension if not exists "pgcrypto";

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- categories --------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_fr text not null,
  name_ar text not null,
  description_fr text,
  description_ar text,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- products ------------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_fr text not null,
  name_ar text not null,
  description_fr text not null default '',
  description_ar text not null default '',
  details_fr text[] not null default '{}',
  details_ar text[] not null default '{}',
  price numeric(10, 2) not null check (price >= 0),
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  category_id uuid references categories (id) on delete set null,
  stock int not null default 0 check (stock >= 0),
  style_code text,
  material text,
  warranty_fr text,
  warranty_ar text,
  colors jsonb not null default '[]',
  sizes jsonb not null default '[]',
  variants jsonb not null default '[]',
  quantity_offers jsonb not null default '[]',
  video_url text,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('active', 'draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on products (category_id);
create index products_status_idx on products (status);
create index products_featured_idx on products (featured) where featured = true;

create trigger products_set_updated_at
before update on products
for each row execute function update_updated_at();

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0
);

create index product_images_product_id_idx on product_images (product_id);

-- store settings / delivery -------------------------------------------------

create table store_settings (
  id int primary key default 1 check (id = 1),
  shipping_fee numeric(10, 2) not null default 500,
  free_ship_threshold numeric(10, 2)
);

insert into store_settings (id, shipping_fee, free_ship_threshold)
values (1, 500, null);

create table delivery_prices (
  id uuid primary key default gen_random_uuid(),
  wilaya text unique not null,
  home_price numeric(10, 2) not null default 0,
  office_price numeric(10, 2) not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger delivery_prices_set_updated_at
before update on delivery_prices
for each row execute function update_updated_at();

-- orders ----------------------------------------------------------------

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_name text not null,
  customer_phone text not null,
  wilaya text not null,
  city text not null,
  address text,
  notes text,
  subtotal numeric(10, 2) not null,
  shipping numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  language text not null default 'fr' check (language in ('fr', 'ar')),
  delivery_type text not null default 'home' check (delivery_type in ('home', 'office')),
  created_at timestamptz not null default now()
);

create index orders_phone_created_idx on orders (customer_phone, created_at desc);
create index orders_status_idx on orders (status);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name_fr text not null,
  name_ar text not null,
  price numeric(10, 2) not null,
  quantity int not null check (quantity > 0),
  color text,
  size text,
  variants jsonb not null default '[]',
  image_url text
);

create index order_items_order_id_idx on order_items (order_id);

-- restock on cancellation ----------------------------------------------------

create or replace function restock_on_cancel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update products p
    set stock = p.stock + oi.quantity
    from order_items oi
    where oi.order_id = new.id
      and oi.product_id = p.id;
  end if;
  return new;
end;
$$;

create trigger orders_restock_on_cancel
after update of status on orders
for each row execute function restock_on_cancel();

-- client reviews --------------------------------------------------------

create table client_reviews (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  stars int not null check (stars between 1 and 5),
  review_text text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
