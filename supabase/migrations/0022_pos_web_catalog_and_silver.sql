-- POS, follow-up to 0020/0021 — two things the client asked for after using it:
--
--   1. The shop sells the SAME pieces as the website. Re-typing every product
--      into the counter catalogue is the complaint. So every active website
--      product is now MIRRORED into store_products automatically: name and
--      price follow the website, the shop still keeps its own per-branch stock
--      count, and the shop may pin its own price (price_custom) or add
--      shop-only articles exactly as before.
--
--   2. Silver 925 is bought in bulk by weight, not as individual pieces. The
--      owner enters "I bought 800 g for 640 000 DA", then just weighs out what
--      he sells. store_silver_pool is a single running gram balance per shop
--      with a weighted-average cost; every gram-priced sale of the bulk-silver
--      catalogue row draws the grams out of it and costs them at that average.
--
-- REQUIRES 0019, 0020, 0021.

-- 1. in-store EAN-13 generator (plpgsql mirror of src/lib/barcode.ts) --------
-- Mirrored website rows need a scannable barcode; generating one in SQL keeps
-- the trigger self-contained. Prefix 200 is GS1's in-store range, so these can
-- never collide with a manufacturer's real code.

create or replace function public.gen_instore_ean13()
returns text
language plpgsql
as $$
declare
  v_body  text := '200';
  i       int;
  v_sum   int := 0;
  v_digit int;
  v_check int;
begin
  for i in 1..9 loop
    v_body := v_body || floor(random() * 10)::int::text;
  end loop;
  for i in 1..12 loop
    v_digit := substr(v_body, i, 1)::int;
    v_sum := v_sum + v_digit * (case when (i % 2) = 1 then 1 else 3 end);
  end loop;
  v_check := (10 - (v_sum % 10)) % 10;
  return v_body || v_check::text;
end;
$$;

-- 2. link + pin columns on the counter catalogue ---------------------------

alter table store_products
  add column if not exists product_id uuid references products (id) on delete set null,
  add column if not exists price_custom boolean not null default false,
  add column if not exists is_silver_pool boolean not null default false;

-- One mirror row per website product. A plain (non-partial) unique index:
-- Postgres already treats NULLs as distinct, so the many shop-only rows
-- (product_id null) coexist freely, and ON CONFLICT (product_id) can use it as
-- its arbiter — a partial index can't be inferred without repeating its WHERE.
drop index if exists store_products_product_id_key;
create unique index store_products_product_id_key
  on store_products (product_id);

-- Only ever one bulk-silver catalogue row.
create unique index if not exists store_products_one_silver_pool
  on store_products (is_silver_pool) where is_silver_pool;

-- 3. website product -> counter catalogue mirror --------------------------

create or replace function public.mirror_web_product()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    return old;  -- FK is ON DELETE SET NULL: the mirror row survives as a
                 -- plain shop item, keeping its stock and sale history.
  end if;

  insert into store_products (product_id, name, kind, pricing_mode, barcode,
                              cost_price, price, active)
  values (new.id, new.name_fr, 'product', 'unit', gen_instore_ean13(),
          0, new.price, new.status = 'active')
  on conflict (product_id) do update set
    name   = excluded.name,
    -- price only tracks the website while the shop hasn't pinned its own.
    price  = case when store_products.price_custom then store_products.price
                  else excluded.price end,
    active = (new.status = 'active'),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists products_mirror_to_store on products;
create trigger products_mirror_to_store
after insert or update of name_fr, price, status on products
for each row execute function mirror_web_product();

-- backfill existing catalogue
insert into store_products (product_id, name, kind, pricing_mode, barcode, cost_price, price, active)
select p.id, p.name_fr, 'product', 'unit', gen_instore_ean13(), 0, p.price, (p.status = 'active')
from products p
on conflict (product_id) do nothing;

-- 4. bulk silver ---------------------------------------------------------------

-- The single shared catalogue row the till sells bulk silver through.
insert into store_products (name, kind, pricing_mode, is_silver_pool, price_per_gram, active)
select 'Argent 925 (vrac)', 'product', 'gram', true, 0, true
where not exists (select 1 from store_products where is_silver_pool);

-- One running gram balance per shop, weighted-average cost.
create table if not exists store_silver_pool (
  store_id           uuid primary key references stores (id) on delete cascade,
  grams              numeric(12, 3) not null default 0 check (grams >= 0),
  avg_cost_per_gram  numeric(12, 2) not null default 0 check (avg_cost_per_gram >= 0),
  updated_at         timestamptz not null default now()
);

drop trigger if exists store_silver_pool_updated_at on store_silver_pool;
create trigger store_silver_pool_updated_at
before update on store_silver_pool
for each row execute function update_updated_at();

-- The purchase log — one row per "I bought X g for Y DA".
create table if not exists store_silver_purchases (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores (id) on delete cascade,
  grams         numeric(12, 3) not null check (grams > 0),
  total_cost    numeric(12, 2) not null check (total_cost >= 0),
  cost_per_gram numeric(12, 2) generated always as (
    case when grams > 0 then round(total_cost / grams, 2) else 0 end
  ) stored,
  purchased_at  date not null default current_date,
  note          text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists store_silver_purchases_store_idx
  on store_silver_purchases (store_id, purchased_at desc);

alter table store_silver_pool      enable row level security;
alter table store_silver_purchases enable row level security;

drop policy if exists store_silver_pool_all on store_silver_pool;
create policy store_silver_pool_all on store_silver_pool
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));
drop policy if exists store_silver_pool_finance_read on store_silver_pool;
create policy store_silver_pool_finance_read on store_silver_pool
  for select to authenticated using (has_section('finance'));

drop policy if exists store_silver_purchases_all on store_silver_purchases;
create policy store_silver_purchases_all on store_silver_purchases
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));
drop policy if exists store_silver_purchases_finance_read on store_silver_purchases;
create policy store_silver_purchases_finance_read on store_silver_purchases
  for select to authenticated using (has_section('finance'));

-- Record a bulk purchase and roll the weighted-average cost forward.
create or replace function public.add_silver_purchase(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store uuid := nullif(p ->> 'store_id', '')::uuid;
  v_grams numeric := coalesce(nullif(p ->> 'grams', '')::numeric, 0);
  v_cost  numeric := greatest(coalesce(nullif(p ->> 'total_cost', '')::numeric, 0), 0);
  v_old_grams numeric;
  v_old_avg   numeric;
  v_new_grams numeric;
  v_new_avg   numeric;
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if v_store is null or not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;
  if v_grams <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

  insert into store_silver_purchases (store_id, grams, total_cost, purchased_at, note, created_by)
  values (v_store, v_grams, v_cost,
          coalesce(nullif(p ->> 'purchased_at', '')::date, current_date),
          nullif(p ->> 'note', ''), auth.uid());

  select grams, avg_cost_per_gram into v_old_grams, v_old_avg
  from store_silver_pool where store_id = v_store for update;

  v_old_grams := coalesce(v_old_grams, 0);
  v_old_avg   := coalesce(v_old_avg, 0);
  v_new_grams := v_old_grams + v_grams;
  v_new_avg   := case when v_new_grams > 0
                      then round((v_old_grams * v_old_avg + v_cost) / v_new_grams, 2)
                      else 0 end;

  insert into store_silver_pool (store_id, grams, avg_cost_per_gram)
  values (v_store, v_new_grams, v_new_avg)
  on conflict (store_id) do update set
    grams = excluded.grams, avg_cost_per_gram = excluded.avg_cost_per_gram;

  return jsonb_build_object('grams', v_new_grams, 'avg_cost_per_gram', v_new_avg);
end;
$$;

revoke execute on function public.add_silver_purchase(jsonb) from public;
revoke execute on function public.add_silver_purchase(jsonb) from anon;
grant execute on function public.add_silver_purchase(jsonb) to authenticated;

-- 5. re-point create_store_sale at the silver pool -------------------------
-- Same body as 0021 with one branch added: a line whose catalogue row is the
-- bulk-silver row draws grams from store_silver_pool (not store_stock) and
-- costs them at the pool's weighted-average.

create or replace function create_store_sale(sale jsonb, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store    uuid := nullif(sale ->> 'store_id', '')::uuid;
  v_sale_id  uuid;
  v_number   text;
  v_item     jsonb;
  v_prod     store_products%rowtype;
  v_qty      int;
  v_weight   numeric;
  v_price    numeric;
  v_cost     numeric;
  v_stock    int;
  v_pool_g   numeric;
  v_pool_avg numeric;
  v_need_g   numeric;
  v_subtotal numeric := 0;
  v_costtot  numeric := 0;
  v_discount numeric;
  v_total    numeric;
  v_pay      text := coalesce(nullif(sale ->> 'payment_method', ''), 'cash');
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if v_store is null or not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'ERR_EMPTY_SALE';
  end if;

  v_number := next_document_number('ST');

  insert into store_sales (sale_number, store_id, customer_name, customer_phone,
                           payment_method, sold_at, created_by, notes)
  values (v_number, v_store,
          nullif(sale ->> 'customer_name', ''), nullif(sale ->> 'customer_phone', ''),
          v_pay,
          coalesce(nullif(sale ->> 'sold_at', '')::date, current_date),
          auth.uid(), nullif(sale ->> 'notes', ''))
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(items) loop
    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::int, 0);
    if v_qty <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

    if nullif(v_item ->> 'store_product_id', '') is not null then
      select * into v_prod from store_products
      where id = (v_item ->> 'store_product_id')::uuid
      for update;
      if not found then raise exception 'ERR_ITEM_NOT_FOUND'; end if;

      v_weight := case when v_prod.pricing_mode = 'gram'
                       then coalesce(nullif(v_item ->> 'weight_grams', '')::numeric, v_prod.weight_grams)
                       else 0 end;
      v_weight := greatest(coalesce(v_weight, 0), 0);

      v_price := greatest(coalesce(
        nullif(v_item ->> 'unit_price', '')::numeric,
        case when v_prod.pricing_mode = 'gram'
             then round(v_weight * v_prod.price_per_gram, 2)
             else v_prod.price end
      ), 0);

      if v_prod.is_silver_pool then
        -- Bulk silver: grams come out of the shop's pool, cost is the pool's
        -- weighted average. No store_stock row is involved.
        v_need_g := v_weight * v_qty;
        select grams, avg_cost_per_gram into v_pool_g, v_pool_avg
        from store_silver_pool where store_id = v_store for update;
        if coalesce(v_pool_g, 0) < v_need_g then raise exception 'ERR_OUT_OF_STOCK'; end if;
        update store_silver_pool set grams = grams - v_need_g where store_id = v_store;
        v_cost := round(v_weight * coalesce(v_pool_avg, 0), 2);
      else
        v_cost := case
          when v_prod.kind = 'service' then 0
          when v_prod.pricing_mode = 'gram' then round(v_weight * v_prod.cost_per_gram, 2)
          else v_prod.cost_price
        end;

        if v_prod.kind = 'product' then
          select quantity into v_stock from store_stock
          where store_id = v_store and store_product_id = v_prod.id
          for update;

          if coalesce(v_stock, 0) < v_qty then raise exception 'ERR_OUT_OF_STOCK'; end if;

          update store_stock set quantity = quantity - v_qty
          where store_id = v_store and store_product_id = v_prod.id;
        end if;
      end if;

      insert into store_sale_items (sale_id, store_product_id, name, kind, pricing_mode,
                                    weight_grams, unit_price, unit_cost, quantity)
      values (v_sale_id, v_prod.id, v_prod.name, v_prod.kind, v_prod.pricing_mode,
              v_weight, v_price, v_cost, v_qty);
    else
      if coalesce(nullif(v_item ->> 'name', ''), '') = '' then
        raise exception 'ERR_ITEM_NOT_FOUND';
      end if;
      insert into store_sale_items (sale_id, store_product_id, name, kind, pricing_mode,
                                    weight_grams, unit_price, unit_cost, quantity)
      values (v_sale_id, null, v_item ->> 'name', 'product', 'unit', 0,
              greatest(coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0), 0),
              greatest(coalesce(nullif(v_item ->> 'unit_cost', '')::numeric, 0), 0),
              v_qty);
    end if;
  end loop;

  select coalesce(sum(line_total), 0), coalesce(sum(unit_cost * quantity), 0)
  into v_subtotal, v_costtot
  from store_sale_items where sale_id = v_sale_id;

  v_discount := least(greatest(coalesce(nullif(sale ->> 'discount', '')::numeric, 0), 0), v_subtotal);
  v_total := v_subtotal - v_discount;

  update store_sales
  set subtotal = v_subtotal, discount = v_discount, total = v_total, cost_total = v_costtot
  where id = v_sale_id;

  if v_pay = 'cash' and v_total <> 0 then
    insert into store_cash_movements (store_id, kind, amount, label, sale_id, occurred_at, created_by)
    values (v_store, 'sale', v_total, v_number, v_sale_id,
            coalesce(nullif(sale ->> 'sold_at', '')::date, current_date), auth.uid());
  end if;

  return jsonb_build_object('id', v_sale_id, 'sale_number', v_number,
                            'subtotal', v_subtotal, 'discount', v_discount,
                            'total', v_total, 'cost_total', v_costtot);
end;
$$;

revoke execute on function create_store_sale(jsonb, jsonb) from public;
revoke execute on function create_store_sale(jsonb, jsonb) from anon;
grant execute on function create_store_sale(jsonb, jsonb) to authenticated;

-- 6. give grams back when a silver sale is deleted / returned --------------

create or replace function restock_on_sale_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- unit stock
  insert into store_stock (store_id, store_product_id, quantity)
  select old.store_id, i.store_product_id, sum(i.quantity)
  from store_sale_items i
  join store_products p on p.id = i.store_product_id
  where i.sale_id = old.id
    and i.store_product_id is not null
    and i.kind = 'product'
    and not p.is_silver_pool
  group by i.store_product_id
  on conflict (store_id, store_product_id)
  do update set quantity = store_stock.quantity + excluded.quantity;

  -- bulk-silver grams
  update store_silver_pool sp
  set grams = sp.grams + agg.g
  from (
    select sum(i.weight_grams * i.quantity) as g
    from store_sale_items i
    join store_products p on p.id = i.store_product_id
    where i.sale_id = old.id and p.is_silver_pool
  ) agg
  where sp.store_id = old.store_id and coalesce(agg.g, 0) > 0;

  return old;
end;
$$;

-- returns: mirror the same silver-pool branch into create_store_return's
-- restock step.
create or replace function create_store_return(ret jsonb, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store   uuid := nullif(ret ->> 'store_id', '')::uuid;
  v_sale    uuid := nullif(ret ->> 'sale_id', '')::uuid;
  v_ret_id  uuid;
  v_number  text;
  v_item    jsonb;
  v_prod    store_products%rowtype;
  v_qty     int;
  v_weight  numeric;
  v_price   numeric;
  v_cost    numeric;
  v_restock boolean;
  v_total   numeric := 0;
  v_costtot numeric := 0;
  v_refund  text := coalesce(nullif(ret ->> 'refund_method', ''), 'cash');
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if v_store is null or not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'ERR_EMPTY_SALE';
  end if;

  v_number := next_document_number('RT');

  insert into store_returns (return_number, store_id, sale_id, customer_name,
                             refund_method, reason, returned_at, created_by, notes)
  values (v_number, v_store, v_sale, nullif(ret ->> 'customer_name', ''),
          v_refund, nullif(ret ->> 'reason', ''),
          coalesce(nullif(ret ->> 'returned_at', '')::date, current_date),
          auth.uid(), nullif(ret ->> 'notes', ''))
  returning id into v_ret_id;

  for v_item in select * from jsonb_array_elements(items) loop
    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::int, 0);
    if v_qty <= 0 then raise exception 'ERR_INVALID_QTY'; end if;
    v_restock := coalesce(nullif(v_item ->> 'restock', '')::boolean, true);

    v_prod := null;
    if nullif(v_item ->> 'store_product_id', '') is not null then
      select * into v_prod from store_products
      where id = (v_item ->> 'store_product_id')::uuid
      for update;
      if not found then raise exception 'ERR_ITEM_NOT_FOUND'; end if;
    end if;

    v_weight := greatest(coalesce(nullif(v_item ->> 'weight_grams', '')::numeric, 0), 0);
    v_price  := greatest(coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0), 0);

    v_cost := null;
    if v_sale is not null and v_prod.id is not null then
      select unit_cost into v_cost from store_sale_items
      where sale_id = v_sale and store_product_id = v_prod.id
      limit 1;
    end if;
    if v_cost is null then
      v_cost := case
        when v_prod.id is null then 0
        when v_prod.kind = 'service' then 0
        when v_prod.pricing_mode = 'gram' then round(v_weight * v_prod.cost_per_gram, 2)
        else v_prod.cost_price
      end;
    end if;

    insert into store_return_items (return_id, store_product_id, name, weight_grams,
                                    unit_price, unit_cost, quantity, restock)
    values (v_ret_id, v_prod.id, coalesce(v_prod.name, v_item ->> 'name', '—'),
            v_weight, v_price, v_cost, v_qty, v_restock);

    if v_restock and v_prod.id is not null then
      if v_prod.is_silver_pool then
        update store_silver_pool set grams = grams + v_weight * v_qty
        where store_id = v_store;
      elsif v_prod.kind = 'product' then
        insert into store_stock (store_id, store_product_id, quantity)
        values (v_store, v_prod.id, v_qty)
        on conflict (store_id, store_product_id)
        do update set quantity = store_stock.quantity + excluded.quantity;
      end if;
    end if;
  end loop;

  select coalesce(sum(line_total), 0), coalesce(sum(unit_cost * quantity), 0)
  into v_total, v_costtot
  from store_return_items where return_id = v_ret_id;

  update store_returns set total = v_total, cost_total = v_costtot where id = v_ret_id;

  if v_refund = 'cash' and v_total <> 0 then
    insert into store_cash_movements (store_id, kind, amount, label, return_id, occurred_at, created_by)
    values (v_store, 'return', -v_total, v_number, v_ret_id,
            coalesce(nullif(ret ->> 'returned_at', '')::date, current_date), auth.uid());
  end if;

  return jsonb_build_object('id', v_ret_id, 'return_number', v_number,
                            'total', v_total, 'cost_total', v_costtot);
end;
$$;

revoke execute on function create_store_return(jsonb, jsonb) from public;
revoke execute on function create_store_return(jsonb, jsonb) from anon;
grant execute on function create_store_return(jsonb, jsonb) to authenticated;
