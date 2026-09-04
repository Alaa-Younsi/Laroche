-- The bulk-silver purchase log (0022) had no way to fix a typo: add_silver_purchase
-- only ever appended, and store_silver_pool.avg_cost_per_gram is a running
-- weighted average, not a value you can patch in place — editing or deleting
-- one purchase means recomputing every purchase/sale/return after it.
--
-- store_silver_pool is order-sensitive: a sale changes grams but never the
-- average, so the average after N purchases depends on how many grams had
-- already been sold before each of them. That means a correct fix has to
-- replay the shop's whole silver history in timestamp order, not just adjust
-- the one edited row. recompute_silver_pool() does that replay; the edit and
-- delete RPCs are thin wrappers that mutate store_silver_purchases and then
-- call it.
--
-- REQUIRES 0022.

create or replace function public.recompute_silver_pool(p_store uuid)
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
    where p.store_id = p_store
    union all
    -- Sold grams: leaves the shop, average is untouched.
    select s.created_at, i.weight_grams * i.quantity, null::numeric, 'sell'
    from store_sale_items i
    join store_sales s on s.id = i.sale_id
    join store_products pr on pr.id = i.store_product_id
    where s.store_id = p_store and pr.is_silver_pool
    union all
    -- Returned grams: back on hand at no new cost, average is untouched.
    select r.created_at, i.weight_grams * i.quantity, null::numeric, 'restock'
    from store_return_items i
    join store_returns r on r.id = i.return_id
    join store_products pr on pr.id = i.store_product_id
    where r.store_id = p_store and pr.is_silver_pool and i.restock
    order by 1
  loop
    if v_event.kind = 'buy' then
      v_avg := case when (v_grams + v_event.grams) > 0
                    then round((v_grams * v_avg + v_event.cost) / (v_grams + v_event.grams), 2)
                    else 0 end;
      v_grams := v_grams + v_event.grams;
    else
      v_grams := greatest(v_grams - case when v_event.kind = 'sell' then v_event.grams else -v_event.grams end, 0);
    end if;
  end loop;

  insert into store_silver_pool (store_id, grams, avg_cost_per_gram)
  values (p_store, v_grams, v_avg)
  on conflict (store_id) do update set
    grams = excluded.grams, avg_cost_per_gram = excluded.avg_cost_per_gram;
end;
$$;

revoke execute on function public.recompute_silver_pool(uuid) from public;
revoke execute on function public.recompute_silver_pool(uuid) from anon;
grant execute on function public.recompute_silver_pool(uuid) to authenticated;

create or replace function public.update_silver_purchase(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid := nullif(p ->> 'id', '')::uuid;
  v_store uuid;
  v_grams numeric := coalesce(nullif(p ->> 'grams', '')::numeric, 0);
  v_cost  numeric := greatest(coalesce(nullif(p ->> 'total_cost', '')::numeric, 0), 0);
begin
  select store_id into v_store from store_silver_purchases where id = v_id;
  if v_store is null then raise exception 'ERR_ITEM_NOT_FOUND'; end if;
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;
  if v_grams <= 0 then raise exception 'ERR_INVALID_QTY'; end if;

  update store_silver_purchases
  set grams = v_grams,
      total_cost = v_cost,
      purchased_at = coalesce(nullif(p ->> 'purchased_at', '')::date, purchased_at),
      note = nullif(p ->> 'note', '')
  where id = v_id;

  perform recompute_silver_pool(v_store);

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
begin
  select store_id into v_store from store_silver_purchases where id = p_id;
  if v_store is null then raise exception 'ERR_ITEM_NOT_FOUND'; end if;
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;

  delete from store_silver_purchases where id = p_id;

  perform recompute_silver_pool(v_store);
end;
$$;

revoke execute on function public.delete_silver_purchase(uuid) from public;
revoke execute on function public.delete_silver_purchase(uuid) from anon;
grant execute on function public.delete_silver_purchase(uuid) to authenticated;
