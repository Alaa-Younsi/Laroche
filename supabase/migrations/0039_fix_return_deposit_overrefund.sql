-- CRITICAL FIX — create_store_return refunded cash the till never collected,
-- for any return against a Versement (deposit) sale.
--
-- 0031 (weight_sale_and_deposits) added store_sales.amount_paid/balance_due
-- so a sale can be only partially collected up front (e.g. 30% deposit on a
-- custom silver order). create_store_return was never updated for this: its
-- cash-refund cash movement is `-v_total`, the sum of the RETURNED LINES'
-- ORIGINAL unit_price — it never looks at how much of the sale was actually
-- paid. So returning an item from a sale that only had a deposit collected
-- debits the till for the full original price, not the (smaller) amount the
-- till actually received. Left unfixed, every deposit-sale return silently
-- overdraws the cash drawer relative to reality and CashPanel stops
-- reconciling — exactly the kind of payment mistake this pass is hunting for.
--
-- Fix: when the return is linked to a sale (sale_id given), cap the cash
-- refund at that sale's amount_paid — the till can never be asked to hand
-- back more cash than it took in for that sale.
--
-- Known residual limitation (documented, not silently pretended away): this
-- caps EACH return independently at the sale's amount_paid; it does not track
-- how much of that deposit has already been refunded by an earlier partial
-- return against the same sale. Two separate partial returns against one
-- deposit sale could each be capped at the full deposit and jointly still
-- over-refund. Closing that fully would need a running "amount already
-- refunded" column on store_sales, which is a real feature decision (does a
-- return reduce balance_due instead of paying cash? does it block until the
-- balance is settled?) rather than a mechanical fix — flagged for a decision,
-- not invented here. This migration eliminates the common case (one return
-- per sale, or the return exceeding what was ever collected at all).

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
  v_paid_in numeric;
  v_cash_out numeric;
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

  -- The till can never hand back more cash than it actually took in for the
  -- linked sale. With no linked sale (walk-in / ad-hoc return, no deposit
  -- context available) the full line total is refunded, unchanged from before.
  v_cash_out := v_total;
  if v_sale is not null then
    select amount_paid into v_paid_in from store_sales where id = v_sale;
    if v_paid_in is not null then
      v_cash_out := least(v_total, v_paid_in);
    end if;
  end if;

  if v_refund = 'cash' and v_cash_out <> 0 then
    insert into store_cash_movements (store_id, kind, amount, label, return_id, occurred_at, created_by)
    values (v_store, 'return', -v_cash_out, v_number, v_ret_id,
            coalesce(nullif(ret ->> 'returned_at', '')::date, current_date), auth.uid());
  end if;

  return jsonb_build_object('id', v_ret_id, 'return_number', v_number,
                            'total', v_total, 'cost_total', v_costtot);
end;
$$;

revoke execute on function create_store_return(jsonb, jsonb) from public;
revoke execute on function create_store_return(jsonb, jsonb) from anon;
grant execute on function create_store_return(jsonb, jsonb) to authenticated;
