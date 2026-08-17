-- Business suite, part 2 of 2 — the physical shops (POS).
-- REQUIRES 0019_business_suite.sql to have run first.
--
--   stores                 one row per shop
--   store_members          which staff account works in which shop
--   store_products         the counter's OWN catalogue: unit- or gram-priced
--   store_stock            quantity per (shop, product) — never a single total
--   store_sales/_items     the till's sales + the receipt
--   store_returns/_items   retours, restocking as they are booked
--   store_transfers/_items stock moved between shops, logged both ends
--   store_cash_movements   each shop's cash box (caisse)
--
-- Design notes that are expensive to reverse:
--
-- 1. The store catalogue is a SECOND table, not a flag on `products`. The two
--    businesses stock different things, price them differently, and must never
--    cross-contaminate a stock count — which is the entire point of a second
--    ledger. Services live here too via `kind`, sharing one sale-line shape.
-- 2. Stock lives in store_stock, NOT as a column on store_products. With more
--    than one shop a single `stock` column has no meaning, and a transfer
--    between shops becomes unrepresentable.
-- 3. Gram-priced goods (silver 925) carry weight × per-gram rates; unit-priced
--    goods (watches, accessories) carry flat cost/price. `effective_*` are
--    generated so every list can read one column regardless of mode.
-- 4. cost_total is denormalised onto the sale header, or every range dashboard
--    would have to load every line just to show a margin.

-- 1. shops -------------------------------------------------------------------

create table if not exists stores (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text unique,
  address    text,
  phone      text,
  active     boolean not null default true,
  notes      text,
  created_at timestamptz not null default now()
);

-- Which staff account works in which shop. A non-owner sees ONLY the shops
-- they are a member of — that is the "each shop has its own users" requirement,
-- and it fails closed: no membership, no shop.
create table if not exists store_members (
  store_id uuid not null references stores (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  role     text not null default 'seller' check (role in ('seller', 'manager')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index if not exists store_members_user_idx on store_members (user_id);

-- SECURITY DEFINER for the same reason as has_section(): a policy that read
-- store_members directly would re-enter that table's own policy and Postgres
-- would error with infinite recursion.
create or replace function public.can_access_store(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_owner() or (
    has_section('store')
    and exists (
      select 1 from public.store_members m
      where m.store_id = sid and m.user_id = auth.uid()
    )
  );
$$;

-- 2. the counter's catalogue -------------------------------------------------

create table if not exists store_products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           text not null default 'product' check (kind in ('product', 'service')),
  -- 'unit' → flat cost/price (watches, accessories)
  -- 'gram' → weighed goods (silver 925): cost and price derive from the weight
  pricing_mode   text not null default 'unit' check (pricing_mode in ('unit', 'gram')),
  sku            text,
  barcode        text unique,
  category       text,
  cost_price     numeric(12, 2) not null default 0 check (cost_price >= 0),
  price          numeric(12, 2) not null default 0 check (price >= 0),
  weight_grams   numeric(10, 3) not null default 0 check (weight_grams >= 0),
  cost_per_gram  numeric(12, 2) not null default 0 check (cost_per_gram >= 0),
  price_per_gram numeric(12, 2) not null default 0 check (price_per_gram >= 0),
  effective_cost numeric(12, 2) generated always as (
    case when pricing_mode = 'gram' then round(weight_grams * cost_per_gram, 2) else cost_price end
  ) stored,
  effective_price numeric(12, 2) generated always as (
    case when pricing_mode = 'gram' then round(weight_grams * price_per_gram, 2) else price end
  ) stored,
  supplier_id    uuid references suppliers (id) on delete set null,
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists store_products_updated_at on store_products;
create trigger store_products_updated_at
before update on store_products
for each row execute function update_updated_at();

create index if not exists store_products_active_idx on store_products (active);
create index if not exists store_products_barcode_idx on store_products (barcode);

-- Deferred FK from 0019, now that the table exists.
alter table stock_purchases
  drop constraint if exists stock_purchases_store_product_id_fkey;
alter table stock_purchases
  add constraint stock_purchases_store_product_id_fkey
  foreign key (store_product_id) references store_products (id) on delete set null;

alter table stock_purchases
  add column if not exists store_id uuid references stores (id) on delete set null;

-- 3. stock, per shop ---------------------------------------------------------

create table if not exists store_stock (
  store_id         uuid not null references stores (id) on delete cascade,
  store_product_id uuid not null references store_products (id) on delete cascade,
  quantity         int not null default 0 check (quantity >= 0),
  updated_at       timestamptz not null default now(),
  primary key (store_id, store_product_id)
);

drop trigger if exists store_stock_updated_at on store_stock;
create trigger store_stock_updated_at
before update on store_stock
for each row execute function update_updated_at();

-- 4. sales -------------------------------------------------------------------

create table if not exists store_sales (
  id             uuid primary key default gen_random_uuid(),
  sale_number    text unique not null,
  store_id       uuid not null references stores (id) on delete restrict,
  customer_name  text,
  customer_phone text,
  subtotal       numeric(12, 2) not null default 0,
  discount       numeric(12, 2) not null default 0,
  total          numeric(12, 2) not null default 0,
  cost_total     numeric(12, 2) not null default 0,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'card', 'transfer', 'other')),
  sold_at        date not null default current_date,
  created_by     uuid references auth.users (id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists store_sales_store_date_idx on store_sales (store_id, sold_at desc);

create table if not exists store_sale_items (
  id               uuid primary key default gen_random_uuid(),
  sale_id          uuid not null references store_sales (id) on delete cascade,
  store_product_id uuid references store_products (id) on delete set null,
  name             text not null,
  kind             text not null default 'product',
  pricing_mode     text not null default 'unit',
  -- The weight actually put on the scale for THIS sale, which is why it is a
  -- line column and not just a catalogue one: silver is weighed per sale.
  weight_grams     numeric(10, 3) not null default 0,
  unit_price       numeric(12, 2) not null default 0,
  unit_cost        numeric(12, 2) not null default 0,
  quantity         int not null default 1 check (quantity > 0),
  line_total       numeric(14, 2) generated always as (unit_price * quantity) stored
);

create index if not exists store_sale_items_sale_idx on store_sale_items (sale_id);

-- Deleting a mistyped sale must give the units back, or the catalogue drifts
-- every time.
--
-- ⚠ This hangs off the HEADER, not off store_sale_items. The obvious version —
-- a BEFORE DELETE on the items table — does not work: when the header is
-- deleted, the lines go via the FK's ON DELETE CASCADE, which runs as a *later
-- command* in the same statement, by which point the header row is no longer
-- visible to the trigger. It would look up store_id, find nothing, and silently
-- skip the restock. Firing BEFORE DELETE on store_sales instead means the lines
-- are all still there and the shop is known.
-- (Contrast the website side, where deleting an order does NOT restock — that
-- restock fires on the *cancelled* transition instead. Tell the client.)
create or replace function restock_on_sale_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into store_stock (store_id, store_product_id, quantity)
  select old.store_id, i.store_product_id, sum(i.quantity)
  from store_sale_items i
  where i.sale_id = old.id
    and i.store_product_id is not null
    and i.kind = 'product'
  group by i.store_product_id
  on conflict (store_id, store_product_id)
  do update set quantity = store_stock.quantity + excluded.quantity;
  return old;
end;
$$;

drop trigger if exists store_sale_items_restock on store_sale_items;
drop trigger if exists store_sales_restock on store_sales;
create trigger store_sales_restock
before delete on store_sales
for each row execute function restock_on_sale_delete();

-- 5. returns (retours) -------------------------------------------------------

create table if not exists store_returns (
  id            uuid primary key default gen_random_uuid(),
  return_number text unique not null,
  store_id      uuid not null references stores (id) on delete restrict,
  -- Nullable: a customer returning a piece without their receipt is normal.
  sale_id       uuid references store_sales (id) on delete set null,
  customer_name text,
  total         numeric(12, 2) not null default 0,
  cost_total    numeric(12, 2) not null default 0,
  refund_method text not null default 'cash'
    check (refund_method in ('cash', 'card', 'transfer', 'other', 'exchange')),
  reason        text,
  returned_at   date not null default current_date,
  created_by    uuid references auth.users (id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists store_returns_store_date_idx on store_returns (store_id, returned_at desc);

create table if not exists store_return_items (
  id               uuid primary key default gen_random_uuid(),
  return_id        uuid not null references store_returns (id) on delete cascade,
  store_product_id uuid references store_products (id) on delete set null,
  name             text not null,
  weight_grams     numeric(10, 3) not null default 0,
  unit_price       numeric(12, 2) not null default 0,
  unit_cost        numeric(12, 2) not null default 0,
  quantity         int not null default 1 check (quantity > 0),
  -- A damaged piece comes back into the ledger but not onto the shelf.
  restock          boolean not null default true,
  line_total       numeric(14, 2) generated always as (unit_price * quantity) stored
);

create index if not exists store_return_items_return_idx on store_return_items (return_id);

-- 6. transfers between shops -------------------------------------------------

create table if not exists store_transfers (
  id              uuid primary key default gen_random_uuid(),
  transfer_number text unique not null,
  from_store_id   uuid not null references stores (id) on delete restrict,
  to_store_id     uuid not null references stores (id) on delete restrict,
  status          text not null default 'pending'
    check (status in ('pending', 'received', 'cancelled')),
  notes           text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  received_by     uuid references auth.users (id) on delete set null,
  received_at     timestamptz,
  check (from_store_id <> to_store_id)
);

create table if not exists store_transfer_items (
  id               uuid primary key default gen_random_uuid(),
  transfer_id      uuid not null references store_transfers (id) on delete cascade,
  store_product_id uuid not null references store_products (id) on delete restrict,
  name             text not null,
  quantity         int not null check (quantity > 0)
);

create index if not exists store_transfer_items_transfer_idx
  on store_transfer_items (transfer_id);

-- 7. the cash box (caisse) ---------------------------------------------------
-- One signed ledger per shop; the balance is its running sum. Sales and cash
-- refunds post automatically from the RPCs so the till can never disagree with
-- the sales list.

create table if not exists store_cash_movements (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores (id) on delete cascade,
  kind        text not null check (kind in
    ('sale', 'return', 'expense', 'deposit', 'withdrawal', 'adjustment')),
  amount      numeric(12, 2) not null,  -- signed: + in, − out
  label       text,
  -- CASCADE, not SET NULL: a deleted sale must take its cash movement with it,
  -- or the till keeps money for a sale that no longer exists and stops
  -- reconciling against the sales list.
  sale_id     uuid references store_sales (id) on delete cascade,
  return_id   uuid references store_returns (id) on delete cascade,
  expense_id  uuid references expenses (id) on delete cascade,
  occurred_at date not null default current_date,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists store_cash_store_date_idx
  on store_cash_movements (store_id, occurred_at desc);

-- An expense paid out of the till must hit the till exactly once. Keeping that
-- in a trigger means it stays true however the row was written.
alter table expenses add column if not exists store_id uuid references stores (id) on delete set null;
alter table expenses add column if not exists paid_from_till boolean not null default false;

create or replace function sync_expense_cash_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from store_cash_movements where expense_id = new.id;
  if new.paid_from_till and new.store_id is not null and new.amount > 0 then
    insert into store_cash_movements
      (store_id, kind, amount, label, expense_id, occurred_at, created_by)
    values
      (new.store_id, 'expense', -new.amount, new.label, new.id, new.spent_at, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_sync_cash on expenses;
create trigger expenses_sync_cash
after insert or update on expenses
for each row execute function sync_expense_cash_movement();

-- 8. numbering ---------------------------------------------------------------

-- One sequence shared by every document type; the prefix is what distinguishes
-- a sale from a return from a transfer. A sequence rather than random digits
-- because a collision here surfaces as a bare unique-violation from deep
-- inside the till RPC, and sequences do not roll back — a document number must
-- never be reused even when the transaction that drew it aborts.
create sequence if not exists store_document_seq;

create or replace function next_document_number(prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return prefix || '-' || to_char(now(), 'YYYYMMDD') || '-' ||
         lpad(nextval('store_document_seq')::text, 5, '0');
end;
$$;

-- 9. RLS ---------------------------------------------------------------------

alter table stores               enable row level security;
alter table store_members        enable row level security;
alter table store_products       enable row level security;
alter table store_stock          enable row level security;
alter table store_sales          enable row level security;
alter table store_sale_items     enable row level security;
alter table store_returns        enable row level security;
alter table store_return_items   enable row level security;
alter table store_transfers      enable row level security;
alter table store_transfer_items enable row level security;
alter table store_cash_movements enable row level security;

-- Shops: any store user may LIST them (they need to pick a transfer
-- destination); only the owner may create, rename or deactivate one.
drop policy if exists stores_read on stores;
create policy stores_read on stores
  for select to authenticated using (has_section('store') or has_section('finance'));
drop policy if exists stores_owner_write on stores;
create policy stores_owner_write on stores
  for all to authenticated using (is_owner()) with check (is_owner());

drop policy if exists store_members_read on store_members;
create policy store_members_read on store_members
  for select to authenticated using (is_owner() or user_id = auth.uid());
drop policy if exists store_members_owner_write on store_members;
create policy store_members_owner_write on store_members
  for all to authenticated using (is_owner()) with check (is_owner());

-- The catalogue is shared across shops (one definition, many stock rows), so
-- it is gated on the section rather than on a shop.
drop policy if exists store_products_all on store_products;
create policy store_products_all on store_products
  for all to authenticated
  using (has_section('store') or has_section('finance'))
  with check (has_section('store'));

-- Everything below is per-shop.
drop policy if exists store_stock_all on store_stock;
create policy store_stock_all on store_stock
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));

drop policy if exists store_sales_all on store_sales;
create policy store_sales_all on store_sales
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));

drop policy if exists store_sale_items_all on store_sale_items;
create policy store_sale_items_all on store_sale_items
  for all to authenticated
  using (exists (select 1 from store_sales s where s.id = sale_id and can_access_store(s.store_id)))
  with check (exists (select 1 from store_sales s where s.id = sale_id and can_access_store(s.store_id)));

drop policy if exists store_returns_all on store_returns;
create policy store_returns_all on store_returns
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));

drop policy if exists store_return_items_all on store_return_items;
create policy store_return_items_all on store_return_items
  for all to authenticated
  using (exists (select 1 from store_returns r where r.id = return_id and can_access_store(r.store_id)))
  with check (exists (select 1 from store_returns r where r.id = return_id and can_access_store(r.store_id)));

-- A transfer is visible from BOTH ends, or the receiving shop can never see
-- what is on its way.
drop policy if exists store_transfers_all on store_transfers;
create policy store_transfers_all on store_transfers
  for all to authenticated
  using (can_access_store(from_store_id) or can_access_store(to_store_id))
  with check (can_access_store(from_store_id) or can_access_store(to_store_id));

drop policy if exists store_transfer_items_all on store_transfer_items;
create policy store_transfer_items_all on store_transfer_items
  for all to authenticated
  using (exists (select 1 from store_transfers tr where tr.id = transfer_id
                 and (can_access_store(tr.from_store_id) or can_access_store(tr.to_store_id))))
  with check (exists (select 1 from store_transfers tr where tr.id = transfer_id
                 and (can_access_store(tr.from_store_id) or can_access_store(tr.to_store_id))));

drop policy if exists store_cash_all on store_cash_movements;
create policy store_cash_all on store_cash_movements
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));

-- Owners run the whole business from one dashboard, and a finance worker needs
-- shop numbers for the group P&L: give both a read across every shop.
drop policy if exists store_sales_finance_read on store_sales;
create policy store_sales_finance_read on store_sales
  for select to authenticated using (has_section('finance'));
drop policy if exists store_sale_items_finance_read on store_sale_items;
create policy store_sale_items_finance_read on store_sale_items
  for select to authenticated using (has_section('finance'));
drop policy if exists store_returns_finance_read on store_returns;
create policy store_returns_finance_read on store_returns
  for select to authenticated using (has_section('finance'));
drop policy if exists store_return_items_finance_read on store_return_items;
create policy store_return_items_finance_read on store_return_items
  for select to authenticated using (has_section('finance'));
drop policy if exists store_stock_finance_read on store_stock;
create policy store_stock_finance_read on store_stock
  for select to authenticated using (has_section('finance'));
drop policy if exists store_cash_finance_read on store_cash_movements;
create policy store_cash_finance_read on store_cash_movements
  for select to authenticated using (has_section('finance'));
