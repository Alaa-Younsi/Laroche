-- Real per-variant stock for WEBSITE products (the POS's own store_stock is
-- untouched — that is a deliberately separate ledger, see 0020).
--
-- `products.colors` (swatches) and `products.sizes` (chips) and
-- `products.variants` (fully custom name/value groups, CustomVariantsEditor)
-- stay exactly as they are — cosmetic, display-only axes. This migration adds
-- the layer that was missing: one row per SELLABLE COMBINATION of whichever
-- of those axes a product actually uses, each with its OWN stock. A product
-- that defines none of them keeps working exactly as today — a single manual
-- `products.stock` counter, untouched by anything below.
--
-- `products.stock` becomes a generated total the moment a product has ANY
-- variant rows: a trigger keeps it as sum(product_variants.stock). Remove
-- every variant row and the admin regains manual control of the counter.
--
-- REQUIRES 0001, 0012.

-- 1. the combinations table ----------------------------------------------

-- A generated column's expression can't contain a subquery (Postgres:
-- "cannot use subquery in column generation expression"), so the
-- string_agg-over-jsonb_array_elements logic has to live in its own
-- IMMUTABLE function — the generated column below just calls it.
create or replace function product_variant_options_key(options jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    string_agg(v ->> 'name_fr' || ':' || (v ->> 'value'), '|' order by v ->> 'name_fr'),
    ''
  )
  from jsonb_array_elements(options) v
$$;

create table if not exists product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products (id) on delete cascade,
  -- Matches a products.colors[].label_fr / products.sizes[] entry, or null
  -- when the product doesn't use that axis.
  color        text,
  size         text,
  -- VariantPick[]-shaped: [{ name_fr, name_ar, value }, …] from whichever
  -- custom groups (products.variants) the product defines, or [] for none.
  options      jsonb not null default '[]',
  -- Canonical key so the SAME combination can never be inserted twice,
  -- regardless of custom-group ordering (sorted by name_fr below).
  options_key  text generated always as (
    coalesce(color, '') || '||' || coalesce(size, '') || '||' ||
    product_variant_options_key(options)
  ) stored,
  sku            text,
  barcode        text,
  stock          int not null default 0 check (stock >= 0),
  -- null = use the parent product's price / gallery.
  price_override numeric(10, 2) check (price_override is null or price_override >= 0),
  image_url      text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id, options_key)
);

create index if not exists product_variants_product_idx on product_variants (product_id);

drop trigger if exists product_variants_updated_at on product_variants;
create trigger product_variants_updated_at
before update on product_variants
for each row execute function update_updated_at();

-- 2. keep products.stock in sync -----------------------------------------
-- Only touches products.stock while the product actually HAS variant rows —
-- a product with none is entirely unaffected (manual stock, as today).

create or replace function sync_product_stock_from_variants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- NEW is unassigned on DELETE and OLD is unassigned on INSERT — referencing
-- either outside its valid branch raises "record is not assigned yet", so
-- TG_OP picks which one to read rather than coalescing across both.
declare
  v_product uuid;
  v_count   int;
  v_sum     int;
begin
  if tg_op = 'DELETE' then
    v_product := old.product_id;
  else
    v_product := new.product_id;
  end if;

  select count(*), coalesce(sum(stock), 0) into v_count, v_sum
  from product_variants where product_id = v_product;

  if v_count > 0 then
    update products set stock = v_sum where id = v_product;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists product_variants_sync_stock on product_variants;
create trigger product_variants_sync_stock
after insert or update of stock or delete on product_variants
for each row execute function sync_product_stock_from_variants();

-- 3. RLS -------------------------------------------------------------------
-- Same three-policy shape as `products`/`product_images` (0002/0016): anon
-- sees an active product's variants, any admin can read, and only the
-- `products` section can write.

alter table product_variants enable row level security;

drop policy if exists product_variants_anon_select on product_variants;
create policy product_variants_anon_select on product_variants
  for select to anon using (
    exists (select 1 from products p where p.id = product_id and p.status = 'active')
  );

drop policy if exists product_variants_admin_read on product_variants;
create policy product_variants_admin_read on product_variants
  for select to authenticated using (is_admin());

drop policy if exists product_variants_admin_write on product_variants;
create policy product_variants_admin_write on product_variants
  for all to authenticated
  using (has_section('products'))
  with check (has_section('products'));

-- 4. checkout: decrement the RIGHT stock ------------------------------------
-- order_items gets a nullable variant_id so a cancellation restocks the
-- variant it actually came from (or products.stock directly, when the item
-- had none — unchanged behaviour).

alter table order_items add column if not exists variant_id uuid
  references product_variants (id) on delete set null;

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
  v_variant_id uuid;
  v_variant_row product_variants%rowtype;
  v_has_variants boolean;
  v_line_price numeric;

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

    select exists(select 1 from product_variants where product_id = v_product.id)
    into v_has_variants;

    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_line_price := v_product.price;

    if v_has_variants then
      if v_variant_id is null then
        raise exception 'ERR_VARIANT_REQUIRED: %', v_product.slug;
      end if;
      select * into v_variant_row from product_variants
      where id = v_variant_id and product_id = v_product.id and active
      for update;
      if not found then
        raise exception 'ERR_PRODUCT_UNAVAILABLE: variant not found';
      end if;
      if v_variant_row.stock < v_qty then
        raise exception 'ERR_STOCK: insufficient stock for %', v_product.slug;
      end if;
      if v_variant_row.price_override is not null then
        v_line_price := v_variant_row.price_override;
      end if;
    else
      if v_product.stock < v_qty then
        raise exception 'ERR_STOCK: insufficient stock for %', v_product.slug;
      end if;
    end if;

    v_line_base := v_line_price * v_qty;
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
            v_candidate := v_paid * v_line_price;
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
            v_candidate := v_bundles * v_bundle_price + v_remainder * v_line_price;
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
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;

    select * into v_product
    from products where id = (v_item->>'product_id')::uuid;

    v_line_price := v_product.price;
    if v_variant_id is not null then
      select * into v_variant_row from product_variants where id = v_variant_id;
      if v_variant_row.price_override is not null then
        v_line_price := v_variant_row.price_override;
      end if;
    end if;

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
      color, size, variants, image_url, variant_id
    ) values (
      v_order_id, v_product.id, v_product.name_fr, v_product.name_ar,
      v_line_price, v_qty, v_color, v_size, v_clean_variants,
      (select url from product_images where product_id = v_product.id order by sort_order limit 1),
      v_variant_id
    );

    if v_variant_id is not null then
      update product_variants set stock = stock - v_qty where id = v_variant_id;
      -- products.stock follows via product_variants_sync_stock.
    else
      update products set stock = stock - v_qty where id = v_product.id;
    end if;
  end loop;

  return v_order_number;
end;
$$;

grant execute on function place_order(jsonb, jsonb) to anon;

-- 5. restock on cancellation, variant-aware ---------------------------------

create or replace function restock_on_cancel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update product_variants pv
    set stock = pv.stock + oi.quantity
    from order_items oi
    where oi.order_id = new.id
      and oi.variant_id = pv.id;

    update products p
    set stock = p.stock + oi.quantity
    from order_items oi
    where oi.order_id = new.id
      and oi.product_id = p.id
      and oi.variant_id is null;
    -- variant-linked lines restock products.stock via product_variants_sync_stock.
  end if;
  return new;
end;
$$;
