-- place_order: the single write path for orders. Never trust client-sent
-- prices — everything financial is recomputed server-side from the
-- authoritative products/delivery_prices/store_settings rows.

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

  v_item jsonb;
  v_variant jsonb;
  v_product products%rowtype;
  v_qty int;
  v_color text;
  v_size text;
  v_variants jsonb;
  v_clean_variants jsonb;

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

    v_line_base := v_product.price * v_qty;
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
            v_candidate := v_paid * v_product.price;
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
            v_candidate := v_bundles * v_bundle_price + v_remainder * v_product.price;
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
  v_order_number := 'LB-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text), 1, 5));

  insert into orders (
    order_number, customer_name, customer_phone, wilaya, city, address, notes,
    subtotal, shipping, discount, total, status, language, delivery_type
  ) values (
    v_order_number, v_name, v_phone, v_wilaya, v_city, v_address, v_notes,
    v_subtotal, v_shipping, v_discount, v_subtotal - v_discount + v_shipping,
    'pending', v_language, v_delivery_type
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
      v_product.price, v_qty, v_color, v_size, v_clean_variants,
      (select url from product_images where product_id = v_product.id order by sort_order limit 1)
    );

    update products set stock = stock - v_qty where id = v_product.id;
  end loop;

  return v_order_number;
end;
$$;

grant execute on function place_order(jsonb, jsonb) to anon;

-- get_order_by_number: minimal guest-facing lookup. orders/order_items
-- have no anon SELECT policy (phone/address would be readable by anyone
-- who guesses an order id), so the confirmation page must go through
-- this RPC instead of a direct .from("orders").select().

create or replace function get_order_by_number(p_order_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_items jsonb;
begin
  select * into v_order from orders where order_number = p_order_number;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name_fr', oi.name_fr,
      'name_ar', oi.name_ar,
      'price', oi.price,
      'quantity', oi.quantity,
      'color', oi.color,
      'size', oi.size,
      'variants', oi.variants,
      'image_url', oi.image_url
    )
  ), '[]'::jsonb)
  into v_items
  from order_items oi
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'wilaya', v_order.wilaya,
    'city', v_order.city,
    'delivery_type', v_order.delivery_type,
    'subtotal', v_order.subtotal,
    'shipping', v_order.shipping,
    'discount', v_order.discount,
    'total', v_order.total,
    'status', v_order.status,
    'language', v_order.language,
    'created_at', v_order.created_at,
    'items', v_items
  );
end;
$$;

grant execute on function get_order_by_number(text) to anon;
