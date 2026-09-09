-- Two independent additions to the till that both land on `create_store_sale`,
-- so they are bundled into one redefinition of that function (same pattern as
-- 0022/0026/0027 stacking on top of each other).
--
-- A. Désignation on a weighed-silver line — what was actually sold (Bague,
--    Collier, …), not just which grade and how many grams.
-- B. Versement (deposit) sales — the customer pays part of the total now
--    (within an admin-configured % range), the piece is set aside immediately
--    (full stock/pool decrement, unchanged), and the balance is settled later
--    via `record_sale_payment`.
--
-- REQUIRES 0020, 0021, 0027, 0029.

-- A.1 designation on a weighed line -----------------------------------------

alter table store_sale_items add column if not exists designation text;

-- B.1 the admin-configured deposit range, per shop --------------------------

alter table stores
  add column if not exists deposit_min_percent numeric(5, 2) not null default 20
    check (deposit_min_percent >= 0 and deposit_min_percent <= 100),
  add column if not exists deposit_max_percent numeric(5, 2) not null default 80
    check (deposit_max_percent >= 0 and deposit_max_percent <= 100);

alter table stores drop constraint if exists stores_deposit_range_ck;
alter table stores add constraint stores_deposit_range_ck
  check (deposit_min_percent <= deposit_max_percent);

-- B.2 partial payment on the sale header -------------------------------------

alter table store_sales add column if not exists amount_paid numeric(12, 2) not null default 0;
alter table store_sales add column if not exists balance_due numeric(12, 2)
  generated always as (round(total - amount_paid, 2)) stored;

-- Every payment EVENT against a sale: the initial deposit (posted by
-- create_store_sale below) plus any later settlement (record_sale_payment).
create table if not exists store_sale_payments (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references store_sales (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  method      text not null default 'cash' check (method in ('cash', 'card', 'transfer', 'other')),
  occurred_at date not null default current_date,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists store_sale_payments_sale_idx on store_sale_payments (sale_id);

alter table store_sale_payments enable row level security;

drop policy if exists store_sale_payments_all on store_sale_payments;
create policy store_sale_payments_all on store_sale_payments
  for all to authenticated
  using (exists (select 1 from store_sales s where s.id = sale_id and can_access_store(s.store_id)))
  with check (exists (select 1 from store_sales s where s.id = sale_id and can_access_store(s.store_id)));
drop policy if exists store_sale_payments_finance_read on store_sale_payments;
create policy store_sale_payments_finance_read on store_sale_payments
  for select to authenticated using (has_section('finance'));

-- B.3 the till, redefined ----------------------------------------------------
-- Stock/pool decrement is UNCHANGED — the whole quantity/weight is drawn
-- immediately regardless of a deposit (the piece is reserved the moment the
-- deposit is taken). What changes: an optional `sale->>'amount_paid'`
-- (omitted ⇒ paid in full, so every existing caller keeps working
-- unchanged), validated against the shop's deposit range when partial, and
-- the till only ever receives cash actually taken.

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
  v_designation text;
  v_name     text;
  v_stock    int;
  v_pool_g   numeric;
  v_pool_avg numeric;
  v_need_g   numeric;
  v_subtotal numeric := 0;
  v_costtot  numeric := 0;
  v_discount numeric;
  v_total    numeric;
  v_pay      text := coalesce(nullif(sale ->> 'payment_method', ''), 'cash');
  v_store_row stores%rowtype;
  v_amount_paid numeric;
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if v_store is null or not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'ERR_EMPTY_SALE';
  end if;

  select * into v_store_row from stores where id = v_store;

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
    v_designation := nullif(btrim(coalesce(v_item ->> 'designation', '')), '');

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

      -- A désignation only makes sense on a weighed silver line — what piece
      -- was actually put on the scale, not just which grade.
      v_name := case when v_prod.is_silver_pool and v_designation is not null
                     then v_designation || ' — ' || v_prod.name
                     else v_prod.name end;

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
                                    weight_grams, unit_price, unit_cost, quantity, designation)
      values (v_sale_id, v_prod.id, v_name, v_prod.kind, v_prod.pricing_mode,
              v_weight, v_price, v_cost, v_qty,
              case when v_prod.is_silver_pool then v_designation else null end);
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

  v_amount_paid := nullif(sale ->> 'amount_paid', '')::numeric;
  if v_amount_paid is null then
    v_amount_paid := v_total;
  else
    v_amount_paid := greatest(v_amount_paid, 0);
    if v_amount_paid < v_total then
      if v_total > 0 and (
           v_amount_paid < round(v_total * v_store_row.deposit_min_percent / 100, 2)
        or v_amount_paid > round(v_total * v_store_row.deposit_max_percent / 100, 2)
      ) then
        raise exception 'ERR_DEPOSIT_OUT_OF_RANGE';
      end if;
    else
      v_amount_paid := v_total;
    end if;
  end if;

  update store_sales
  set subtotal = v_subtotal, discount = v_discount, total = v_total, cost_total = v_costtot,
      amount_paid = v_amount_paid
  where id = v_sale_id;

  if v_amount_paid > 0 then
    insert into store_sale_payments (sale_id, amount, method, occurred_at, created_by)
    values (v_sale_id, v_amount_paid, v_pay,
            coalesce(nullif(sale ->> 'sold_at', '')::date, current_date), auth.uid());
  end if;

  if v_pay = 'cash' and v_amount_paid <> 0 then
    insert into store_cash_movements (store_id, kind, amount, label, sale_id, occurred_at, created_by)
    values (v_store, 'sale', v_amount_paid, v_number, v_sale_id,
            coalesce(nullif(sale ->> 'sold_at', '')::date, current_date), auth.uid());
  end if;

  return jsonb_build_object('id', v_sale_id, 'sale_number', v_number,
                            'subtotal', v_subtotal, 'discount', v_discount,
                            'total', v_total, 'cost_total', v_costtot,
                            'amount_paid', v_amount_paid);
end;
$$;

revoke execute on function create_store_sale(jsonb, jsonb) from public;
revoke execute on function create_store_sale(jsonb, jsonb) from anon;
grant execute on function create_store_sale(jsonb, jsonb) to authenticated;

-- B.4 settle (part of) the balance later -------------------------------------

create or replace function public.record_sale_payment(p_sale_id uuid, p_amount numeric, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale   store_sales%rowtype;
  v_method text := coalesce(nullif(p_method, ''), 'cash');
  v_amount numeric;
begin
  select * into v_sale from store_sales where id = p_sale_id for update;
  if not found then raise exception 'ERR_ITEM_NOT_FOUND'; end if;
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if not can_access_store(v_sale.store_id) then raise exception 'ERR_NO_STORE'; end if;
  if v_method not in ('cash', 'card', 'transfer', 'other') then raise exception 'ERR_INVALID_QTY'; end if;

  v_amount := least(greatest(coalesce(p_amount, 0), 0), greatest(v_sale.total - v_sale.amount_paid, 0));
  if v_amount <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

  update store_sales set amount_paid = amount_paid + v_amount where id = p_sale_id;

  insert into store_sale_payments (sale_id, amount, method, created_by)
  values (p_sale_id, v_amount, v_method, auth.uid());

  if v_method = 'cash' then
    insert into store_cash_movements (store_id, kind, amount, label, sale_id, created_by)
    values (v_sale.store_id, 'sale', v_amount, v_sale.sale_number || ' (solde)', p_sale_id, auth.uid());
  end if;

  return jsonb_build_object('sale_id', p_sale_id, 'amount_paid', v_sale.amount_paid + v_amount,
                            'balance_due', greatest(v_sale.total - v_sale.amount_paid - v_amount, 0));
end;
$$;

revoke execute on function public.record_sale_payment(uuid, numeric, text) from public;
revoke execute on function public.record_sale_payment(uuid, numeric, text) from anon;
grant execute on function public.record_sale_payment(uuid, numeric, text) to authenticated;

-- B.5 an invoice must reflect the ACTUAL amount paid, not always the total --

create or replace function public.create_store_invoice(p_sale_id uuid, doc jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale     store_sales%rowtype;
  v_existing uuid;
  v_id       uuid;
  v_number   text;
begin
  select * into v_sale from store_sales where id = p_sale_id;
  if not found then raise exception 'ERR_ITEM_NOT_FOUND'; end if;
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if not can_access_store(v_sale.store_id) then raise exception 'ERR_NO_STORE'; end if;

  select id into v_existing from store_invoices where sale_id = p_sale_id;
  if v_existing is not null then
    select invoice_number into v_number from store_invoices where id = v_existing;
    return jsonb_build_object('id', v_existing, 'invoice_number', v_number);
  end if;

  v_number := next_document_number('FA');

  insert into store_invoices (invoice_number, sale_id, store_id, customer_name,
                              customer_address, customer_city, customer_phone,
                              customer_email, payment_method, subtotal, discount,
                              total, amount_paid, created_by)
  values (v_number, p_sale_id, v_sale.store_id,
          coalesce(nullif(doc ->> 'customer_name', ''), v_sale.customer_name),
          nullif(doc ->> 'customer_address', ''),
          nullif(doc ->> 'customer_city', ''),
          coalesce(nullif(doc ->> 'customer_phone', ''), v_sale.customer_phone),
          nullif(doc ->> 'customer_email', ''),
          v_sale.payment_method,
          v_sale.subtotal, v_sale.discount, v_sale.total, v_sale.amount_paid,
          auth.uid())
  returning id into v_id;

  insert into store_invoice_items (invoice_id, line_no, name, material, quantity, unit_price)
  select v_id, row_number() over (order by i.id), i.name,
         case when i.weight_grams > 0 then i.weight_grams || ' g' else null end,
         i.quantity, i.unit_price
  from store_sale_items i
  where i.sale_id = p_sale_id;

  return jsonb_build_object('id', v_id, 'invoice_number', v_number);
end;
$$;

revoke execute on function public.create_store_invoice(uuid, jsonb) from public;
revoke execute on function public.create_store_invoice(uuid, jsonb) from anon;
grant execute on function public.create_store_invoice(uuid, jsonb) to authenticated;
