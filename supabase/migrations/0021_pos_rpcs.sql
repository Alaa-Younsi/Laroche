-- Business suite, part 3 — the write paths that must be atomic.
-- REQUIRES 0019 and 0020.
--
-- Every one of these does several writes that only make sense together: a crash
-- between them leaves a sale with no lines (revenue with no cost), or stock
-- gone with nothing sold, or a transfer that took stock out of one shop and
-- never put it into another. So they are functions, not client-side sequences.
--
-- All are SECURITY DEFINER, and therefore all share the same non-negotiables:
--
--   * check the section EXPLICITLY at the top — DEFINER writes straight past
--     the very policies that would otherwise enforce it;
--   * `select … for update` on the catalogue row BEFORE the stock check, or two
--     tills selling the last unit both succeed;
--   * the client may override a SELL price (haggling happens at a counter) but
--     NEVER a cost — a browser that could dictate cost could dictate margin;
--   * `revoke execute from public AND from anon` before granting to
--     authenticated. Postgres grants EXECUTE to PUBLIC on every new function
--     and `anon` inherits it; revoking from anon alone leaves the till callable
--     by any visitor.
--
-- Errors are raised as bare codes the UI maps to translations:
--   ERR_FORBIDDEN ERR_NO_STORE ERR_EMPTY_SALE ERR_INVALID_QTY
--   ERR_ITEM_NOT_FOUND ERR_OUT_OF_STOCK ERR_NOT_FOUND ERR_ALREADY_APPLIED
--   ERR_SAME_STORE ERR_NOT_PENDING ERR_MISSING_TARGET

-- 1. the till ----------------------------------------------------------------

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

      -- The weight is a real-world scale reading, so it HAS to come from the
      -- client; it drives price and cost together, so it cannot skew margin on
      -- its own the way a free-typed cost could.
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

      v_cost := case
        when v_prod.kind = 'service' then 0
        when v_prod.pricing_mode = 'gram' then round(v_weight * v_prod.cost_per_gram, 2)
        else v_prod.cost_price
      end;

      -- Services have no stock to move.
      if v_prod.kind = 'product' then
        select quantity into v_stock from store_stock
        where store_id = v_store and store_product_id = v_prod.id
        for update;

        if coalesce(v_stock, 0) < v_qty then raise exception 'ERR_OUT_OF_STOCK'; end if;

        update store_stock set quantity = quantity - v_qty
        where store_id = v_store and store_product_id = v_prod.id;
      end if;

      insert into store_sale_items (sale_id, store_product_id, name, kind, pricing_mode,
                                    weight_grams, unit_price, unit_cost, quantity)
      values (v_sale_id, v_prod.id, v_prod.name, v_prod.kind, v_prod.pricing_mode,
              v_weight, v_price, v_cost, v_qty);
    else
      -- Ad-hoc line: there is no catalogue row to read a cost from, so the
      -- payload is the only source there can be. Clamped non-negative.
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

  -- Clamp the discount to the subtotal, or a fat-fingered discount books
  -- negative revenue.
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

-- 2. returns (retours) -------------------------------------------------------

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

    -- Cost of a returned piece is what it cost when it was SOLD. Prefer the
    -- original sale line; fall back to the catalogue only when the customer
    -- has no receipt.
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

    -- A damaged piece comes back into the ledger but not onto the shelf.
    if v_restock and v_prod.id is not null and v_prod.kind = 'product' then
      insert into store_stock (store_id, store_product_id, quantity)
      values (v_store, v_prod.id, v_qty)
      on conflict (store_id, store_product_id)
      do update set quantity = store_stock.quantity + excluded.quantity;
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

-- 3. transfers between shops -------------------------------------------------
-- Stock leaves the sending shop the moment the transfer is created (it is
-- physically in a box, in a car) and only lands in the receiving shop when
-- somebody there confirms it. Anything else lets a parcel in transit be sold
-- twice.

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
    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::int, 0);
    if v_qty <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

    select * into v_prod from store_products
    where id = (v_item ->> 'store_product_id')::uuid
    for update;
    if not found then raise exception 'ERR_ITEM_NOT_FOUND'; end if;

    select quantity into v_stock from store_stock
    where store_id = v_from and store_product_id = v_prod.id
    for update;
    if coalesce(v_stock, 0) < v_qty then raise exception 'ERR_OUT_OF_STOCK'; end if;

    update store_stock set quantity = quantity - v_qty
    where store_id = v_from and store_product_id = v_prod.id;

    insert into store_transfer_items (transfer_id, store_product_id, name, quantity)
    values (v_id, v_prod.id, v_prod.name, v_qty);
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
  v_tr   store_transfers%rowtype;
  v_item store_transfer_items%rowtype;
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;

  select * into v_tr from store_transfers where id = p_transfer_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if v_tr.status <> 'pending' then raise exception 'ERR_NOT_PENDING'; end if;
  -- Only the receiving shop confirms receipt.
  if not can_access_store(v_tr.to_store_id) then raise exception 'ERR_NO_STORE'; end if;

  for v_item in select * from store_transfer_items where transfer_id = p_transfer_id loop
    insert into store_stock (store_id, store_product_id, quantity)
    values (v_tr.to_store_id, v_item.store_product_id, v_item.quantity)
    on conflict (store_id, store_product_id)
    do update set quantity = store_stock.quantity + excluded.quantity;
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

  -- The box never left, so the units go back where they came from.
  for v_item in select * from store_transfer_items where transfer_id = p_transfer_id loop
    insert into store_stock (store_id, store_product_id, quantity)
    values (v_tr.from_store_id, v_item.store_product_id, v_item.quantity)
    on conflict (store_id, store_product_id)
    do update set quantity = store_stock.quantity + excluded.quantity;
  end loop;

  update store_transfers set status = 'cancelled' where id = p_transfer_id;

  return jsonb_build_object('id', p_transfer_id, 'status', 'cancelled');
end;
$$;

revoke execute on function cancel_store_transfer(uuid) from public;
revoke execute on function cancel_store_transfer(uuid) from anon;
grant execute on function cancel_store_transfer(uuid) to authenticated;

-- 4. counting a purchase into stock -----------------------------------------
-- A SEPARATE action from saving the purchase: back-dated paperwork for stock
-- already on the shelf is the common case, and silently re-adding it inflates
-- the catalogue every time the owner catches up on invoices. `applied_at`
-- makes double-counting impossible rather than merely unlikely.

create or replace function apply_purchase_to_stock(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p   stock_purchases%rowtype;
  v_qty int;
begin
  if not (has_section('finance') or has_section('store')) then raise exception 'ERR_FORBIDDEN'; end if;

  select * into v_p from stock_purchases where id = p_purchase_id for update;
  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  if v_p.applied_at is not null then raise exception 'ERR_ALREADY_APPLIED'; end if;

  v_qty := floor(v_p.quantity)::int;
  if v_qty <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

  if v_p.scope = 'online' then
    if v_p.product_id is null then raise exception 'ERR_MISSING_TARGET'; end if;
    update products set stock = stock + v_qty where id = v_p.product_id;
  else
    if v_p.store_product_id is null or v_p.store_id is null then
      raise exception 'ERR_MISSING_TARGET';
    end if;
    if not can_access_store(v_p.store_id) then raise exception 'ERR_NO_STORE'; end if;
    insert into store_stock (store_id, store_product_id, quantity)
    values (v_p.store_id, v_p.store_product_id, v_qty)
    on conflict (store_id, store_product_id)
    do update set quantity = store_stock.quantity + excluded.quantity;
  end if;

  update stock_purchases set applied_at = now() where id = p_purchase_id;

  return jsonb_build_object('id', p_purchase_id, 'quantity', v_qty);
end;
$$;

revoke execute on function apply_purchase_to_stock(uuid) from public;
revoke execute on function apply_purchase_to_stock(uuid) from anon;
grant execute on function apply_purchase_to_stock(uuid) to authenticated;

-- 5. manual stock correction -------------------------------------------------
-- An inventory count that disagrees with the system needs a way back in that
-- is not "sell the difference".

create or replace function set_store_stock(p_store_id uuid, p_product_id uuid, p_quantity int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if not can_access_store(p_store_id) then raise exception 'ERR_NO_STORE'; end if;
  if p_quantity < 0 then raise exception 'ERR_INVALID_QTY'; end if;
  if not exists (select 1 from store_products where id = p_product_id) then
    raise exception 'ERR_ITEM_NOT_FOUND';
  end if;

  insert into store_stock (store_id, store_product_id, quantity)
  values (p_store_id, p_product_id, p_quantity)
  on conflict (store_id, store_product_id) do update set quantity = excluded.quantity;

  return jsonb_build_object('store_id', p_store_id, 'quantity', p_quantity);
end;
$$;

revoke execute on function set_store_stock(uuid, uuid, int) from public;
revoke execute on function set_store_stock(uuid, uuid, int) from anon;
grant execute on function set_store_stock(uuid, uuid, int) to authenticated;
