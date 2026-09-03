-- Category-wide, time-boxed % promotions.
--
-- The owner picks a category, a discount %, and a start/end date. Every product
-- filed under that category (or any of its sub-categories) sells at
-- price * (1 - percent/100) for the window. Promotions never touch the stored
-- `price` — the reduction is computed on read (storefront) and re-computed
-- authoritatively in place_order, exactly like the quantity offers.
--
-- REQUIRES 0001 (products/categories), 0015 (place_order).

create table if not exists category_promotions (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  percent     numeric(5, 2) not null check (percent > 0 and percent <= 90),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  label       text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  check (ends_at > starts_at)
);

create index if not exists category_promotions_window_idx
  on category_promotions (category_id, starts_at, ends_at);

alter table category_promotions enable row level security;

-- Public read: the storefront needs to price the catalogue for anon visitors.
drop policy if exists category_promotions_read on category_promotions;
create policy category_promotions_read on category_promotions
  for select to anon, authenticated using (true);

-- Only staff with the catalogue section (or the owner) may manage them.
drop policy if exists category_promotions_write on category_promotions;
create policy category_promotions_write on category_promotions
  for all to authenticated
  using (is_owner() or has_section('categories'))
  with check (is_owner() or has_section('categories'));

-- Best active percentage for a product's category, walking UP the tree so a
-- promo on a parent category covers everything filed beneath it. Returns 0 when
-- nothing is running.
create or replace function public.active_category_promo(p_category_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recursive chain as (
    select id, parent_id from categories where id = p_category_id
    union all
    select c.id, c.parent_id from categories c join chain ch on c.id = ch.parent_id
  )
  select coalesce(max(pr.percent), 0)
  from category_promotions pr
  where pr.category_id in (select id from chain)
    and now() >= pr.starts_at
    and now() < pr.ends_at;
$$;

-- Re-create place_order with the promo applied to each line's unit price,
-- BEFORE the quantity-offer search (so an offer discounts the already-reduced
-- price, matching what the storefront shows). Body is otherwise identical to
-- 0015_chargily_payments.sql.
create or replace function place_order(items jsonb, customer jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
  v_wilaya text;
  v_city text;
  v_address text;
  v_notes text;
  v_delivery_type text;
  v_language text;
  v_payment_method text;
  v_payment_status text;

  v_item jsonb;
  v_product products%rowtype;
  v_qty int;
  v_color text;
  v_size text;
  v_variants jsonb;
  v_clean_variants jsonb;

  v_promo_pct numeric;
  v_unit_price numeric;

  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_line_base numeric;
  v_line_best numeric;
  v_offer jsonb;
  v_candidate numeric;

  v_shipping numeric;
  v_delivery delivery_prices%rowtype;
  v_settings store_settings%rowtype;

  v_order_id uuid;
  v_order_number text;
  v_item_count int := 0;
  v_recent_count int;
  v_daily_count int;
begin
  -- 0. validate customer -----------------------------------------------
  v_name := btrim(customer->>'customer_name');
  v_phone := btrim(customer->>'customer_phone');
  v_wilaya := btrim(customer->>'wilaya');
  v_city := btrim(customer->>'city');
  v_address := nullif(btrim(coalesce(customer->>'address', '')), '');
  v_notes := nullif(btrim(coalesce(customer->>'notes', '')), '');
  v_delivery_type := coalesce(customer->>'delivery_type', 'home');
  v_language := coalesce(customer->>'language', 'fr');
  v_payment_method := coalesce(customer->>'payment_method', 'cod');

  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'ERR_INVALID_INPUT: name';
  end if;
  if v_phone !~ '^0[5-7][0-9]{8}$' then
    raise exception 'ERR_INVALID_INPUT: phone';
  end if;
  if v_wilaya is null or char_length(v_wilaya) < 1 or char_length(v_wilaya) > 80 then
    raise exception 'ERR_INVALID_INPUT: wilaya';
  end if;
  if v_city is null or char_length(v_city) < 1 or char_length(v_city) > 80 then
    raise exception 'ERR_INVALID_INPUT: city';
  end if;
  if v_delivery_type not in ('home', 'office') then
    raise exception 'ERR_INVALID_INPUT: delivery_type';
  end if;
  if v_payment_method not in ('cod', 'online') then
    v_payment_method := 'cod';
  end if;
  v_payment_status := case when v_payment_method = 'online' then 'pending' else 'unpaid' end;
  if v_language not in ('fr', 'ar') then
    v_language := 'fr';
  end if;
  if v_address is not null then
    v_address := left(v_address, 200);
  end if;
  if v_notes is not null then
    v_notes := left(v_notes, 500);
  end if;

  -- 1. rate-limit by phone ----------------------------------------------
  select count(*) into v_recent_count
  from orders
  where customer_phone = v_phone and created_at > now() - interval '10 minutes';
  if v_recent_count >= 3 then
    raise exception 'ERR_RATE_LIMIT: too many recent orders';
  end if;

  select count(*) into v_daily_count
  from orders
  where customer_phone = v_phone and created_at > now() - interval '24 hours';
  if v_daily_count >= 10 then
    raise exception 'ERR_RATE_LIMIT: too many orders today';
  end if;

  -- 1b. global circuit breaker — the per-phone limit does nothing against a
  --     bot rotating fake numbers, so also cap total order volume. A real shop
  --     never legitimately books 20 orders in a minute from the storefront.
  select count(*) into v_recent_count from orders where created_at > now() - interval '1 minute';
  if v_recent_count >= 20 then
    raise exception 'ERR_RATE_LIMIT: system busy, retry shortly';
  end if;
  select count(*) into v_recent_count from orders where created_at > now() - interval '1 hour';
  if v_recent_count >= 200 then
    raise exception 'ERR_RATE_LIMIT: system busy, retry shortly';
  end if;

  -- 2. cart shape ---------------------------------------------------------
  if items is null or jsonb_array_length(items) = 0 then
    raise exception 'ERR_CART_EMPTY: cart is empty';
  end if;
  if jsonb_array_length(items) > 20 then
    raise exception 'ERR_INVALID_INPUT: too many lines';
  end if;

  -- pass 1: validate, price, accumulate subtotal/discount (no writes yet)
  for v_item in select * from jsonb_array_elements(items)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 or v_qty > 20 then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: invalid quantity';
    end if;

    v_variants := coalesce(v_item->'variants', '[]'::jsonb);
    if jsonb_array_length(v_variants) > 10 then
      raise exception 'ERR_INVALID_INPUT: too many variants';
    end if;

    select * into v_product
    from products
    where id = (v_item->>'product_id')::uuid and status = 'active'
    for update;

    if not found then
      raise exception 'ERR_PRODUCT_UNAVAILABLE: product not found';
    end if;

    if v_product.stock < v_qty then
      raise exception 'ERR_STOCK: insufficient stock for %', v_product.slug;
    end if;

    -- category promo: reduce the unit price before the offer search.
    v_promo_pct := active_category_promo(v_product.category_id);
    v_unit_price := round(v_product.price * (1 - v_promo_pct / 100.0), 2);

    v_line_base := v_unit_price * v_qty;
    v_line_best := v_line_base;

    for v_offer in select * from jsonb_array_elements(v_product.quantity_offers)
    loop
      if v_offer->>'type' = 'free' then
        declare
          v_buy int := coalesce((v_offer->>'buy')::int, 0);
          v_get int := coalesce((v_offer->>'get')::int, 0);
          v_group int;
          v_groups int;
          v_remainder int;
          v_paid int;
        begin
          v_group := v_buy + v_get;
          if v_group > 0 and v_buy > 0 then
            v_groups := v_qty / v_group;
            v_remainder := v_qty % v_group;
            v_paid := v_groups * v_buy + least(v_remainder, v_buy);
            v_candidate := v_paid * v_unit_price;
            if v_candidate < v_line_best then
              v_line_best := v_candidate;
            end if;
          end if;
        end;
      elsif v_offer->>'type' = 'price' then
        declare
          v_bundle_qty int := coalesce((v_offer->>'qty')::int, 0);
          v_bundle_price numeric := coalesce((v_offer->>'price')::numeric, -1);
          v_bundles int;
          v_remainder int;
        begin
          if v_bundle_qty > 0 and v_bundle_price >= 0 then
            v_bundles := v_qty / v_bundle_qty;
            v_remainder := v_qty % v_bundle_qty;
            v_candidate := v_bundles * v_bundle_price + v_remainder * v_unit_price;
            if v_candidate < v_line_best then
              v_line_best := v_candidate;
            end if;
          end if;
        end;
      end if;
    end loop;

    v_subtotal := v_subtotal + v_line_base;
    v_discount := v_discount + (v_line_base - v_line_best);
    v_item_count := v_item_count + 1;
  end loop;

  -- 3. shipping -------------------------------------------------------------
  select * into v_delivery from delivery_prices where wilaya = v_wilaya;
  if not found then
    raise exception 'ERR_INVALID_INPUT: unknown wilaya';
  end if;
  if not v_delivery.active then
    raise exception 'ERR_WILAYA_DISABLED: %', v_wilaya;
  end if;

  select * into v_settings from store_settings where id = 1;

  v_shipping := case
    when v_delivery_type = 'home' then v_delivery.home_price
    else v_delivery.office_price
  end;

  if v_settings.free_ship_threshold is not null
     and (v_subtotal - v_discount) >= v_settings.free_ship_threshold then
    v_shipping := 0;
  end if;

  -- 4. insert order -----------------------------------------------------
  -- 10 hex chars (~1.1e12 space) instead of 5: the old width was small enough
  -- to enumerate, and get_order_by_number is anon-readable by number.
  v_order_number := 'LB-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  insert into orders (
    order_number, customer_name, customer_phone, wilaya, city, address, notes,
    subtotal, shipping, discount, total, status, language, delivery_type,
    payment_method, payment_status
  ) values (
    v_order_number, v_name, v_phone, v_wilaya, v_city, v_address, v_notes,
    v_subtotal, v_shipping, v_discount, v_subtotal - v_discount + v_shipping,
    'pending', v_language, v_delivery_type,
    v_payment_method, v_payment_status
  )
  returning id into v_order_id;

  -- pass 2: insert snapshotted line items + decrement stock
  for v_item in select * from jsonb_array_elements(items)
  loop
    v_qty := (v_item->>'quantity')::int;
    v_color := nullif(left(coalesce(v_item->>'color', ''), 40), '');
    v_size := nullif(left(coalesce(v_item->>'size', ''), 40), '');

    select * into v_product
    from products where id = (v_item->>'product_id')::uuid;

    v_promo_pct := active_category_promo(v_product.category_id);
    v_unit_price := round(v_product.price * (1 - v_promo_pct / 100.0), 2);

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name_fr', left(coalesce(elem->>'name_fr', ''), 40),
        'name_ar', left(coalesce(elem->>'name_ar', ''), 40),
        'value', left(coalesce(elem->>'value', ''), 40)
      )
    ), '[]'::jsonb)
    into v_clean_variants
    from jsonb_array_elements(coalesce(v_item->'variants', '[]'::jsonb)) elem;

    insert into order_items (
      order_id, product_id, name_fr, name_ar, price, quantity,
      color, size, variants, image_url
    ) values (
      v_order_id, v_product.id, v_product.name_fr, v_product.name_ar,
      v_unit_price, v_qty, v_color, v_size, v_clean_variants,
      (select url from product_images where product_id = v_product.id order by sort_order limit 1)
    );

    update products set stock = stock - v_qty where id = v_product.id;
  end loop;

  return v_order_number;
end;
$$;

grant execute on function place_order(jsonb, jsonb) to anon;
grant execute on function public.active_category_promo(uuid) to anon, authenticated;
