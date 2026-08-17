-- Business suite, part 1 of 2 — the WEBSITE's profit & loss layer.
--
--   suppliers        shared by both ledgers (the only thing they share)
--   product_costs    buy price for a website product — a SIDE table, on purpose
--   order_items.unit_cost   cost frozen onto each sold line, by trigger
--   stock_purchases  stock bought in, scoped online | store
--   expenses         running costs, scoped online | store
--
-- Part 2 (0020_pos_multi_store.sql) adds the physical shops, their catalogue,
-- the till, returns, transfers and cash boxes. Run 0019 FIRST — 0020 references
-- suppliers and extends stock_purchases/expenses with a store_id.
--
-- Adds two grantable section keys, `finance` and `store`, which MUST stay in
-- sync with src/lib/adminSections.ts and ALLOWED_SECTIONS in
-- api/_lib/adminTeam.ts. ('store' is used by 0020 but declared here so both
-- files can be run back to back without an ordering trap.)

-- 1. suppliers ---------------------------------------------------------------

create table if not exists suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  email      text,
  address    text,
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. product_costs -----------------------------------------------------------
-- cost_price must NOT be a column on `products`: that table carries a public
-- "read active products" policy for anon, so a cost column there publishes the
-- shop's margins to its competitors through the REST API. A side table keeps
-- the storefront query unchanged and the number private.

create table if not exists product_costs (
  product_id  uuid primary key references products (id) on delete cascade,
  cost_price  numeric(12, 2) not null default 0 check (cost_price >= 0),
  supplier_id uuid references suppliers (id) on delete set null,
  notes       text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists product_costs_updated_at on product_costs;
create trigger product_costs_updated_at
before update on product_costs
for each row execute function update_updated_at();

-- One row per existing product so the buy-price screen opens on an editable
-- list instead of an empty join.
insert into product_costs (product_id, cost_price)
select id, 0 from products
on conflict (product_id) do nothing;

-- 3. cost snapshot on the sold line -----------------------------------------
-- Margin must be computed against what the unit cost was ON THE DAY OF THE
-- SALE. Joining live to product_costs would silently rewrite last month's
-- profit every time the owner records a new buy price.
--
-- A BEFORE INSERT trigger rather than editing place_order(): that RPC has been
-- hardened repeatedly (stock locking, offers, variants) and re-declaring it to
-- add one column risks regressing all of it. The trigger fires on every insert
-- path, the RPC included.

alter table order_items
  add column if not exists unit_cost numeric(12, 2) not null default 0;

create or replace function snapshot_order_item_cost()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.unit_cost, 0) = 0 and new.product_id is not null then
    select coalesce(cost_price, 0) into new.unit_cost
    from product_costs where product_id = new.product_id;
    new.unit_cost := coalesce(new.unit_cost, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_snapshot_cost on order_items;
create trigger order_items_snapshot_cost
before insert on order_items
for each row execute function snapshot_order_item_cost();

-- Backfill history at today's cost. Better than leaving every past line at 0
-- (which reads as 100 % margin forever); the owner is told at handoff that
-- pre-existing orders are priced at the cost entered now.
update order_items oi
set unit_cost = pc.cost_price
from product_costs pc
where oi.product_id = pc.product_id
  and oi.unit_cost = 0
  and pc.cost_price > 0;

-- 4. stock purchases ---------------------------------------------------------
-- `scope` discriminates the two ledgers. store_id is added by 0020.

create table if not exists stock_purchases (
  id               uuid primary key default gen_random_uuid(),
  scope            text not null default 'online' check (scope in ('online', 'store')),
  product_id       uuid references products (id) on delete set null,
  store_product_id uuid,  -- FK added in 0020, once store_products exists
  label            text not null default '',
  supplier_id      uuid references suppliers (id) on delete set null,
  quantity         numeric(12, 3) not null default 0 check (quantity >= 0),
  unit_cost        numeric(12, 2) not null default 0 check (unit_cost >= 0),
  total_cost       numeric(14, 2) generated always as (quantity * unit_cost) stored,
  purchased_at     date not null default current_date,
  -- Back-dated paperwork for stock already counted in is the common case, so
  -- adding to stock is a SEPARATE, explicit action; this records whether it
  -- happened so the owner cannot silently double-count an invoice.
  applied_at       timestamptz,
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists stock_purchases_scope_date_idx
  on stock_purchases (scope, purchased_at desc);

-- 5. expenses ----------------------------------------------------------------

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null default 'online' check (scope in ('online', 'store')),
  label       text not null default '',
  category    text not null default 'other'
    check (category in ('rent', 'salary', 'marketing', 'delivery', 'supplies', 'utilities', 'other')),
  amount      numeric(12, 2) not null default 0 check (amount >= 0),
  spent_at    date not null default current_date,
  supplier_id uuid references suppliers (id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_scope_date_idx on expenses (scope, spent_at desc);

-- 6. RLS ---------------------------------------------------------------------
-- suppliers / stock_purchases / expenses are shared by both ledgers, so either
-- section unlocks them.

alter table suppliers      enable row level security;
alter table product_costs  enable row level security;
alter table stock_purchases enable row level security;
alter table expenses       enable row level security;

drop policy if exists suppliers_admin_all on suppliers;
create policy suppliers_admin_all on suppliers
  for all to authenticated
  using (has_section('finance') or has_section('store'))
  with check (has_section('finance') or has_section('store'));

drop policy if exists stock_purchases_admin_all on stock_purchases;
create policy stock_purchases_admin_all on stock_purchases
  for all to authenticated
  using (has_section('finance') or has_section('store'))
  with check (has_section('finance') or has_section('store'));

drop policy if exists expenses_admin_all on expenses;
create policy expenses_admin_all on expenses
  for all to authenticated
  using (has_section('finance') or has_section('store'))
  with check (has_section('finance') or has_section('store'));

-- product_costs also answers to 'products': the product form writes the buy
-- price inline when a product is created.
drop policy if exists product_costs_admin_all on product_costs;
create policy product_costs_admin_all on product_costs
  for all to authenticated
  using (has_section('finance') or has_section('products'))
  with check (has_section('finance') or has_section('products'));

-- 7. widen the reads the finance dashboard depends on ------------------------
-- 0016 granted these to the owning section only, so a finance-only worker
-- would open an empty dashboard. Read-only: finance derives revenue from
-- orders priced against the catalogue, it never writes either.

drop policy if exists orders_admin_read_finance on orders;
create policy orders_admin_read_finance on orders
  for select to authenticated
  using (has_section('orders') or has_section('finance'));

drop policy if exists order_items_admin_read_finance on order_items;
create policy order_items_admin_read_finance on order_items
  for select to authenticated
  using (has_section('orders') or has_section('finance'));

-- products already has a read-for-any-admin policy from 0016; nothing to widen.
