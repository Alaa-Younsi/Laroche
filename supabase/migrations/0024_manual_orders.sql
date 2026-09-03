-- Orders taken off the website (Facebook DMs, phone calls) that the owner still
-- wants tracked, delivered and counted in revenue like any other order.
--
--   * orders.source  — 'website' (place_order) vs 'manual' (this RPC).
--   * create_manual_order — admin-only, no rate-limit, server-priced. Applies
--     the same category promo as the storefront, snapshots line cost via the
--     existing 0019 trigger, decrements stock. Shipping and discount are passed
--     in because the owner negotiates them on Messenger.
--
-- REQUIRES 0015 (place_order/order shape), 0019 (cost snapshot), 0023 (promo).

alter table orders
  add column if not exists source text not null default 'website'
  check (source in ('website', 'manual'));

create or replace function public.create_manual_order(p_order jsonb, p_items jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name    text := btrim(coalesce(p_order ->> 'customer_name', ''));
  v_phone   text := btrim(coalesce(p_order ->> 'customer_phone', ''));
  v_wilaya  text := btrim(coalesce(p_order ->> 'wilaya', ''));
  v_city    text := btrim(coalesce(p_order ->> 'city', ''));
  v_address text := nullif(btrim(coalesce(p_order ->> 'address', '')), '');
  v_notes   text := nullif(btrim(coalesce(p_order ->> 'notes', '')), '');
  v_delivery_type text := coalesce(p_order ->> 'delivery_type', 'home');
  v_language text := coalesce(p_order ->> 'language', 'fr');
  v_pay     text := coalesce(p_order ->> 'payment_method', 'cod');
  v_status  text := coalesce(p_order ->> 'status', 'confirmed');

  v_item      jsonb;
  v_product   products%rowtype;
  v_qty       int;
  v_promo_pct numeric;
  v_unit      numeric;
  v_subtotal  numeric := 0;
  v_discount  numeric := greatest(coalesce(nullif(p_order ->> 'discount', '')::numeric, 0), 0);
  v_shipping  numeric := greatest(coalesce(nullif(p_order ->> 'shipping', '')::numeric, 0), 0);
  v_delivery  delivery_prices%rowtype;
  v_order_id  uuid;
  v_order_number text;
begin
  if not (is_owner() or has_section('orders')) then
    raise exception 'ERR_FORBIDDEN';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'ERR_INVALID_INPUT: name';
  end if;
  if char_length(v_phone) < 5 or char_length(v_phone) > 20 then
    raise exception 'ERR_INVALID_INPUT: phone';
  end if;
  if char_length(v_wilaya) < 1 or char_length(v_city) < 1 then
    raise exception 'ERR_INVALID_INPUT: address';
  end if;
  if v_delivery_type not in ('home', 'office') then v_delivery_type := 'home'; end if;
  if v_language not in ('fr', 'ar') then v_language := 'fr'; end if;
  if v_pay not in ('cod', 'online') then v_pay := 'cod'; end if;
  if v_status not in ('pending', 'confirmed', 'shipped', 'delivered') then
    v_status := 'confirmed';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'ERR_CART_EMPTY';
  end if;

  -- shipping: an explicit value wins; otherwise fall back to the wilaya grid.
  if (p_order ? 'shipping') is not true or nullif(p_order ->> 'shipping', '') is null then
    select * into v_delivery from delivery_prices where wilaya = v_wilaya;
    if found then
      v_shipping := case when v_delivery_type = 'home'
                         then v_delivery.home_price else v_delivery.office_price end;
    else
      v_shipping := 0;
    end if;
  end if;

  v_order_number := 'LB-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  insert into orders (
    order_number, customer_name, customer_phone, wilaya, city, address, notes,
    subtotal, shipping, discount, total, status, language, delivery_type,
    payment_method, payment_status, source
  ) values (
    v_order_number, v_name, v_phone, v_wilaya, v_city, v_address, v_notes,
    0, v_shipping, 0, 0, v_status, v_language, v_delivery_type,
    v_pay, 'unpaid', 'manual'
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::int, 0);
    if v_qty <= 0 or v_qty > 100 then raise exception 'ERR_PRODUCT_UNAVAILABLE: quantity'; end if;

    select * into v_product from products
    where id = (v_item ->> 'product_id')::uuid
    for update;
    if not found then raise exception 'ERR_PRODUCT_UNAVAILABLE: product not found'; end if;
    if v_product.stock < v_qty then
      raise exception 'ERR_STOCK: insufficient stock for %', v_product.slug;
    end if;

    v_promo_pct := active_category_promo(v_product.category_id);
    -- An explicit unit_price (Messenger haggling) wins; else promo-adjusted list.
    v_unit := greatest(coalesce(
      nullif(v_item ->> 'unit_price', '')::numeric,
      round(v_product.price * (1 - v_promo_pct / 100.0), 2)
    ), 0);

    insert into order_items (
      order_id, product_id, name_fr, name_ar, price, quantity, variants, image_url
    ) values (
      v_order_id, v_product.id, v_product.name_fr, v_product.name_ar,
      v_unit, v_qty, '[]'::jsonb,
      (select url from product_images where product_id = v_product.id order by sort_order limit 1)
    );

    update products set stock = stock - v_qty where id = v_product.id;
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  v_discount := least(v_discount, v_subtotal);

  update orders set
    subtotal = v_subtotal,
    discount = v_discount,
    total = v_subtotal - v_discount + v_shipping
  where id = v_order_id;

  return v_order_number;
end;
$$;

revoke execute on function public.create_manual_order(jsonb, jsonb) from public;
revoke execute on function public.create_manual_order(jsonb, jsonb) from anon;
grant execute on function public.create_manual_order(jsonb, jsonb) to authenticated;
