-- Three kinds of bulk silver instead of one.
--
-- 0022 modelled bulk silver as ONE pool per shop, sold through a single
-- "Argent 925 (vrac)" catalogue row. The client actually buys and sells three
-- distinct grades, each at its own price and each a separate stock:
--
--     rhodie    → "Argent rhodié"
--     bataille  → "Argent bataille"
--     local     → "Argent local"
--
-- So the pool becomes keyed by (store_id, silver_type), there are three
-- catalogue rows instead of one, and every gram that moves — a purchase, a
-- till sale, a return, an inter-shop transfer — carries its silver_type so it
-- lands in the right pool at the right average cost.
--
-- Existing data: the single current pool + its whole purchase history is
-- assigned to 'local' (the client's choice — he can move grams to the other
-- two grades later with a stock adjustment). The old "Argent 925 (vrac)"
-- catalogue row is renamed to "Argent local"; the other two rows are created.
--
-- REQUIRES 0022 and 0026.

-- 1. silver_type everywhere a gram is counted ------------------------------

alter table store_products
  add column if not exists silver_type text
  check (silver_type in ('rhodie', 'bataille', 'local'));

alter table store_silver_pool
  add column if not exists silver_type text not null default 'local'
  check (silver_type in ('rhodie', 'bataille', 'local'));

alter table store_silver_purchases
  add column if not exists silver_type text not null default 'local'
  check (silver_type in ('rhodie', 'bataille', 'local'));

-- Transfer lines can now carry a weight (silver) instead of only a unit count.
-- unit_cost is the sending shop's average cost per gram, snapshotted so the
-- receiving shop can blend it into its own weighted average on receipt.
alter table store_transfer_items
  add column if not exists weight_grams numeric(12, 3) not null default 0
    check (weight_grams >= 0),
  add column if not exists unit_cost numeric(12, 2) not null default 0
    check (unit_cost >= 0),
  add column if not exists silver_type text
    check (silver_type in ('rhodie', 'bataille', 'local'));

-- 2. re-key the pool by (store, grade) -----------------------------------

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'store_silver_pool'::regclass and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (store_id)'
  ) then
    alter table store_silver_pool drop constraint store_silver_pool_pkey;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'store_silver_pool'::regclass and contype = 'p'
  ) then
    alter table store_silver_pool add primary key (store_id, silver_type);
  end if;
end;
$$;

-- 3. the three catalogue rows -------------------------------------------

-- Only ever one bulk-silver row PER GRADE now.
drop index if exists store_products_one_silver_pool;
create unique index if not exists store_products_one_silver_pool_per_type
  on store_products (silver_type) where is_silver_pool;

-- The existing vrac row becomes "Argent local" (keeps its price_per_gram and
-- every sale/return line already pointing at it). This MUST run before the
-- CHECK below, or that row (is_silver_pool with a null silver_type) fails it.
update store_products
set name = 'Argent local', silver_type = 'local'
where is_silver_pool and silver_type is null;

-- The other two grades. price_per_gram starts at 0 — the client sets each in
-- the catalogue's silver card.
insert into store_products (name, kind, pricing_mode, is_silver_pool, silver_type, price_per_gram, active)
select v.name, 'product', 'gram', true, v.st, 0, true
from (values ('Argent rhodié', 'rhodie'), ('Argent bataille', 'bataille')) as v(name, st)
where not exists (
  select 1 from store_products where is_silver_pool and silver_type = v.st
);

-- silver_type is set exactly when is_silver_pool is. Added last, once every
-- bulk-silver row above has its grade.
alter table store_products drop constraint if exists store_products_silver_type_ck;
alter table store_products add constraint store_products_silver_type_ck check (
  (is_silver_pool and silver_type is not null)
  or (not is_silver_pool and silver_type is null)
);

-- 4. replay a shop's silver history for ONE grade ----------------------
-- Same idea as 0026 but per (store, grade), and it now also replays the grams
-- that move via inter-shop transfers: sent grams leave like a sale (average
-- untouched), received grams arrive like a purchase at the snapshot cost.

drop function if exists public.recompute_silver_pool(uuid);

create or replace function public.recompute_silver_pool(p_store uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grams numeric := 0;
  v_avg   numeric := 0;
  v_event record;
begin
  for v_event in
    -- Bought grams: raises the average, weighted by what was already on hand.
    select p.created_at as ts, p.grams as grams, p.total_cost as cost, 'buy' as kind
    from store_silver_purchases p
    where p.store_id = p_store and p.silver_type = p_type
    union all
    -- Sold grams: leave the shop, average is untouched.
    select s.created_at, i.weight_grams * i.quantity, null::numeric, 'sell'
    from store_sale_items i
    join store_sales s on s.id = i.sale_id
    join store_products pr on pr.id = i.store_product_id
    where s.store_id = p_store and pr.is_silver_pool and pr.silver_type = p_type
    union all
    -- Returned grams: back on hand at no new cost, average is untouched.
    select r.created_at, i.weight_grams * i.quantity, null::numeric, 'restock'
    from store_return_items i
    join store_returns r on r.id = i.return_id
    join store_products pr on pr.id = i.store_product_id
    where r.store_id = p_store and pr.is_silver_pool and pr.silver_type = p_type
      and i.restock
    union all
    -- Grams sent to another shop (pending or already received): gone, like a sale.
    select tr.created_at, ti.weight_grams, null::numeric, 'sell'
    from store_transfer_items ti
    join store_transfers tr on tr.id = ti.transfer_id
    where tr.from_store_id = p_store and ti.silver_type = p_type
      and tr.status in ('pending', 'received')
    union all
    -- Grams received from another shop: on hand at the snapshot cost, like a buy.
    select coalesce(tr.received_at, tr.created_at),
           ti.weight_grams, ti.weight_grams * ti.unit_cost, 'buy'
    from store_transfer_items ti
    join store_transfers tr on tr.id = ti.transfer_id
    where tr.to_store_id = p_store and ti.silver_type = p_type
      and tr.status = 'received'
    order by 1
  loop
    if v_event.kind = 'buy' then
      v_avg := case when (v_grams + v_event.grams) > 0
                    then round((v_grams * v_avg + v_event.cost) / (v_grams + v_event.grams), 2)
                    else 0 end;
      v_grams := v_grams + v_event.grams;
    else
      v_grams := greatest(
        v_grams - case when v_event.kind = 'sell' then v_event.grams else -v_event.grams end,
        0);
    end if;
  end loop;

  insert into store_silver_pool (store_id, silver_type, grams, avg_cost_per_gram)
  values (p_store, p_type, v_grams, v_avg)
  on conflict (store_id, silver_type) do update set
    grams = excluded.grams, avg_cost_per_gram = excluded.avg_cost_per_gram;
end;
$$;

revoke execute on function public.recompute_silver_pool(uuid, text) from public;
revoke execute on function public.recompute_silver_pool(uuid, text) from anon;
grant execute on function public.recompute_silver_pool(uuid, text) to authenticated;

-- 5. record a bulk purchase of a given grade --------------------------

create or replace function public.add_silver_purchase(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store uuid := nullif(p ->> 'store_id', '')::uuid;
  v_type  text := coalesce(nullif(p ->> 'silver_type', ''), 'local');
  v_grams numeric := coalesce(nullif(p ->> 'grams', '')::numeric, 0);
  v_cost  numeric := greatest(coalesce(nullif(p ->> 'total_cost', '')::numeric, 0), 0);
  v_old_grams numeric;
  v_old_avg   numeric;
  v_new_grams numeric;
  v_new_avg   numeric;
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if v_store is null or not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;
  if v_type not in ('rhodie', 'bataille', 'local') then raise exception 'ERR_ITEM_NOT_FOUND'; end if;
  if v_grams <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

  insert into store_silver_purchases (store_id, silver_type, grams, total_cost, purchased_at, note, created_by)
  values (v_store, v_type, v_grams, v_cost,
          coalesce(nullif(p ->> 'purchased_at', '')::date, current_date),
          nullif(p ->> 'note', ''), auth.uid());

  select grams, avg_cost_per_gram into v_old_grams, v_old_avg
  from store_silver_pool where store_id = v_store and silver_type = v_type for update;

  v_old_grams := coalesce(v_old_grams, 0);
  v_old_avg   := coalesce(v_old_avg, 0);
  v_new_grams := v_old_grams + v_grams;
  v_new_avg   := case when v_new_grams > 0
                      then round((v_old_grams * v_old_avg + v_cost) / v_new_grams, 2)
                      else 0 end;

  insert into store_silver_pool (store_id, silver_type, grams, avg_cost_per_gram)
  values (v_store, v_type, v_new_grams, v_new_avg)
  on conflict (store_id, silver_type) do update set
    grams = excluded.grams, avg_cost_per_gram = excluded.avg_cost_per_gram;

  return jsonb_build_object('grams', v_new_grams, 'avg_cost_per_gram', v_new_avg, 'silver_type', v_type);
end;
$$;

revoke execute on function public.add_silver_purchase(jsonb) from public;
revoke execute on function public.add_silver_purchase(jsonb) from anon;
grant execute on function public.add_silver_purchase(jsonb) to authenticated;

-- 6. edit / delete a purchase (replays the affected grade[s]) ----------

create or replace function public.update_silver_purchase(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id       uuid := nullif(p ->> 'id', '')::uuid;
  v_store    uuid;
  v_old_type text;
  v_new_type text;
  v_grams    numeric := coalesce(nullif(p ->> 'grams', '')::numeric, 0);
  v_cost     numeric := greatest(coalesce(nullif(p ->> 'total_cost', '')::numeric, 0), 0);
begin
  select store_id, silver_type into v_store, v_old_type
  from store_silver_purchases where id = v_id;
  if v_store is null then raise exception 'ERR_ITEM_NOT_FOUND'; end if;
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;
  if v_grams <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

  v_new_type := coalesce(nullif(p ->> 'silver_type', ''), v_old_type);
  if v_new_type not in ('rhodie', 'bataille', 'local') then raise exception 'ERR_ITEM_NOT_FOUND'; end if;

  update store_silver_purchases
  set grams = v_grams,
      total_cost = v_cost,
      silver_type = v_new_type,
      purchased_at = coalesce(nullif(p ->> 'purchased_at', '')::date, purchased_at),
      note = nullif(p ->> 'note', '')
  where id = v_id;

  perform recompute_silver_pool(v_store, v_new_type);
  if v_old_type is distinct from v_new_type then
    perform recompute_silver_pool(v_store, v_old_type);
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.update_silver_purchase(jsonb) from public;
revoke execute on function public.update_silver_purchase(jsonb) from anon;
grant execute on function public.update_silver_purchase(jsonb) to authenticated;

create or replace function public.delete_silver_purchase(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store uuid;
  v_type  text;
begin
  select store_id, silver_type into v_store, v_type
  from store_silver_purchases where id = p_id;
  if v_store is null then raise exception 'ERR_ITEM_NOT_FOUND'; end if;
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;

  delete from store_silver_purchases where id = p_id;

  perform recompute_silver_pool(v_store, v_type);
end;
$$;

revoke execute on function public.delete_silver_purchase(uuid) from public;
revoke execute on function public.delete_silver_purchase(uuid) from anon;
grant execute on function public.delete_silver_purchase(uuid) to authenticated;

-- 7. the till — route each silver line to its grade's pool -------------

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
        -- Bulk silver: grams come out of THIS grade's pool for the shop, cost
        -- is that pool's weighted average. No store_stock row is involved.
        v_need_g := v_weight * v_qty;
        select grams, avg_cost_per_gram into v_pool_g, v_pool_avg
        from store_silver_pool
        where store_id = v_store and silver_type = v_prod.silver_type
        for update;
        if coalesce(v_pool_g, 0) < v_need_g then raise exception 'ERR_OUT_OF_STOCK'; end if;
        update store_silver_pool set grams = grams - v_need_g
        where store_id = v_store and silver_type = v_prod.silver_type;
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

-- 8. give grams back to the right grade on delete / return ------------

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

  -- bulk-silver grams, per grade
  insert into store_silver_pool (store_id, silver_type, grams, avg_cost_per_gram)
  select old.store_id, p.silver_type, sum(i.weight_grams * i.quantity), 0
  from store_sale_items i
  join store_products p on p.id = i.store_product_id
  where i.sale_id = old.id and p.is_silver_pool
  group by p.silver_type
  on conflict (store_id, silver_type)
  do update set grams = store_silver_pool.grams + excluded.grams;

  return old;
end;
$$;

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
        insert into store_silver_pool (store_id, silver_type, grams, avg_cost_per_gram)
        values (v_store, v_prod.silver_type, v_weight * v_qty, 0)
        on conflict (store_id, silver_type)
        do update set grams = store_silver_pool.grams + excluded.grams;
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

-- 9. inter-shop transfers, by unit OR by silver weight ---------------
-- A line is a SILVER line when its catalogue row is a bulk-silver row: it
-- carries weight_grams (not a unit count) and moves grams between the two
-- shops' pools of that grade. On creation the grams leave the sending pool at
-- its current average; that average is snapshotted onto the line so the
-- receiving shop can blend it into its own weighted average on receipt.

create or replace function create_store_transfer(tr jsonb, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from   uuid := nullif(tr ->> 'from_store_id', '')::uuid;
  v_to     uuid := nullif(tr ->> 'to_store_id', '')::uuid;
  v_id     uuid;
  v_number text;
  v_item   jsonb;
  v_prod   store_products%rowtype;
  v_qty    int;
  v_stock  int;
  v_weight numeric;
  v_pool_g numeric;
  v_pool_avg numeric;
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if v_from is null or not can_access_store(v_from) then raise exception 'ERR_NO_STORE'; end if;
  if v_to is null or not exists (select 1 from stores where id = v_to) then
    raise exception 'ERR_MISSING_TARGET';
  end if;
  if v_from = v_to then raise exception 'ERR_SAME_STORE'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'ERR_EMPTY_SALE';
  end if;

  v_number := next_document_number('TR');

  insert into store_transfers (transfer_number, from_store_id, to_store_id, notes, created_by)
  values (v_number, v_from, v_to, nullif(tr ->> 'notes', ''), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(items) loop
    select * into v_prod from store_products
    where id = (v_item ->> 'store_product_id')::uuid
    for update;
    if not found then raise exception 'ERR_ITEM_NOT_FOUND'; end if;

    if v_prod.is_silver_pool then
      v_weight := greatest(coalesce(nullif(v_item ->> 'weight_grams', '')::numeric, 0), 0);
      if v_weight <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

      select grams, avg_cost_per_gram into v_pool_g, v_pool_avg
      from store_silver_pool
      where store_id = v_from and silver_type = v_prod.silver_type
      for update;
      if coalesce(v_pool_g, 0) < v_weight then raise exception 'ERR_OUT_OF_STOCK'; end if;

      update store_silver_pool set grams = grams - v_weight
      where store_id = v_from and silver_type = v_prod.silver_type;

      insert into store_transfer_items (transfer_id, store_product_id, name, quantity,
                                        weight_grams, unit_cost, silver_type)
      values (v_id, v_prod.id, v_prod.name, 1,
              v_weight, coalesce(v_pool_avg, 0), v_prod.silver_type);
    else
      v_qty := coalesce(nullif(v_item ->> 'quantity', '')::int, 0);
      if v_qty <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

      select quantity into v_stock from store_stock
      where store_id = v_from and store_product_id = v_prod.id
      for update;
      if coalesce(v_stock, 0) < v_qty then raise exception 'ERR_OUT_OF_STOCK'; end if;

      update store_stock set quantity = quantity - v_qty
      where store_id = v_from and store_product_id = v_prod.id;

      insert into store_transfer_items (transfer_id, store_product_id, name, quantity)
      values (v_id, v_prod.id, v_prod.name, v_qty);
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'transfer_number', v_number);
end;
$$;

revoke execute on function create_store_transfer(jsonb, jsonb) from public;
revoke execute on function create_store_transfer(jsonb, jsonb) from anon;
grant execute on function create_store_transfer(jsonb, jsonb) to authenticated;

create or replace function receive_store_transfer(p_transfer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tr    store_transfers%rowtype;
  v_item  store_transfer_items%rowtype;
  v_g     numeric;
  v_avg   numeric;
  v_new_g numeric;
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;

  select * into v_tr from store_transfers where id = p_transfer_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if v_tr.status <> 'pending' then raise exception 'ERR_NOT_PENDING'; end if;
  if not can_access_store(v_tr.to_store_id) then raise exception 'ERR_NO_STORE'; end if;

  for v_item in select * from store_transfer_items where transfer_id = p_transfer_id loop
    if v_item.silver_type is not null then
      -- Blend the incoming grams into the receiving shop's weighted average.
      select grams, avg_cost_per_gram into v_g, v_avg
      from store_silver_pool
      where store_id = v_tr.to_store_id and silver_type = v_item.silver_type
      for update;
      v_g := coalesce(v_g, 0);
      v_avg := coalesce(v_avg, 0);
      v_new_g := v_g + v_item.weight_grams;

      insert into store_silver_pool (store_id, silver_type, grams, avg_cost_per_gram)
      values (v_tr.to_store_id, v_item.silver_type, v_new_g,
              case when v_new_g > 0
                   then round((v_g * v_avg + v_item.weight_grams * v_item.unit_cost) / v_new_g, 2)
                   else 0 end)
      on conflict (store_id, silver_type) do update set
        grams = excluded.grams, avg_cost_per_gram = excluded.avg_cost_per_gram;
    else
      insert into store_stock (store_id, store_product_id, quantity)
      values (v_tr.to_store_id, v_item.store_product_id, v_item.quantity)
      on conflict (store_id, store_product_id)
      do update set quantity = store_stock.quantity + excluded.quantity;
    end if;
  end loop;

  update store_transfers
  set status = 'received', received_by = auth.uid(), received_at = now()
  where id = p_transfer_id;

  return jsonb_build_object('id', p_transfer_id, 'status', 'received');
end;
$$;

revoke execute on function receive_store_transfer(uuid) from public;
revoke execute on function receive_store_transfer(uuid) from anon;
grant execute on function receive_store_transfer(uuid) to authenticated;

create or replace function cancel_store_transfer(p_transfer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tr   store_transfers%rowtype;
  v_item store_transfer_items%rowtype;
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;

  select * into v_tr from store_transfers where id = p_transfer_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if v_tr.status <> 'pending' then raise exception 'ERR_NOT_PENDING'; end if;
  if not can_access_store(v_tr.from_store_id) then raise exception 'ERR_NO_STORE'; end if;

  -- The box never left, so units / grams go back where they came from.
  for v_item in select * from store_transfer_items where transfer_id = p_transfer_id loop
    if v_item.silver_type is not null then
      insert into store_silver_pool (store_id, silver_type, grams, avg_cost_per_gram)
      values (v_tr.from_store_id, v_item.silver_type, v_item.weight_grams, v_item.unit_cost)
      on conflict (store_id, silver_type)
      do update set grams = store_silver_pool.grams + excluded.grams;
    else
      insert into store_stock (store_id, store_product_id, quantity)
      values (v_tr.from_store_id, v_item.store_product_id, v_item.quantity)
      on conflict (store_id, store_product_id)
      do update set quantity = store_stock.quantity + excluded.quantity;
    end if;
  end loop;

  update store_transfers set status = 'cancelled' where id = p_transfer_id;

  return jsonb_build_object('id', p_transfer_id, 'status', 'cancelled');
end;
$$;

revoke execute on function cancel_store_transfer(uuid) from public;
revoke execute on function cancel_store_transfer(uuid) from anon;
grant execute on function cancel_store_transfer(uuid) to authenticated;

-- 10. reconcile every existing pool against the replay ----------------
-- The 'local' pool already holds the migrated balance; this proves the new
-- per-grade replay reproduces it, and creates empty rhodie/bataille rows.

do $$
declare
  s record;
  g text;
begin
  for s in select id from stores loop
    foreach g in array array['rhodie', 'bataille', 'local'] loop
      perform recompute_silver_pool(s.id, g);
    end loop;
  end loop;
end;
$$;
