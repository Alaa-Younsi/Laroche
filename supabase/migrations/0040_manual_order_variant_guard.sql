-- CRITICAL FIX — create_manual_order silently corrupted stock for any
-- product that has variants (0030).
--
-- create_manual_order (0024) predates product_variants (0030) and was never
-- updated for it. It decrements products.stock directly and unconditionally:
--   update products set stock = stock - v_qty where id = v_product.id;
-- For a variant-carrying product, products.stock is NOT the source of truth
-- once any product_variants row exists for it — 0030's
-- sync_product_stock_from_variants trigger overwrites products.stock with
-- sum(product_variants.stock) on every insert/update/delete to that
-- product's variants. So a manual order's stock effect is transient: it
-- looks right until staff next touches ANY variant of that product (a price
-- edit, a restock, an unrelated size/color), at which point the trigger
-- silently erases it and available stock reverts upward as if the manual
-- order never happened. There is also no per-variant stock check, so a
-- manual order can oversell a specific sold-out size/color while the
-- aggregate count still shows stock.
--
-- ManualOrderModal (src/components/admin/ManualOrderModal.tsx) has no
-- variant picker at all — building that UI (and the matching p_variant_id
-- plumbing this function would need to mirror place_order's variant
-- handling, 0030) is a real feature decision, not something to bolt on
-- silently here. Until that exists, this migration makes create_manual_order
-- FAIL LOUD instead of silently corrupting stock: it now rejects any line
-- for a product that has variant rows, with the same ERR_VARIANT_REQUIRED
-- code place_order already uses (already mapped to a translated error in
-- src/lib/orderErrors.ts, so the existing toast.error(...) in
-- ManualOrderModal already surfaces it sensibly with no frontend change).

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
  v_has_variants boolean;
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

    -- products.stock is a DERIVED total once a product has variant rows
    -- (0030's sync trigger owns it from then on) — decrementing it directly
    -- here would be silently overwritten on the next variant touch, and there
    -- is no variant picker in this flow to know which SKU to decrement
    -- instead. Reject rather than corrupt; add variant support here properly
    -- (mirroring place_order's p_variant_id handling) before lifting this.
    select exists(select 1 from product_variants where product_id = v_product.id)
    into v_has_variants;
    if v_has_variants then
      raise exception 'ERR_VARIANT_REQUIRED: %', v_product.slug;
    end if;

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
