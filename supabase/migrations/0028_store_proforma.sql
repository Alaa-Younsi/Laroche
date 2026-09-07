-- Per-store legal identity + POS proforma invoices ("Factures proforma").
--
-- The client hands customers a printed FACTURE PROFORMA from the counter — a
-- quote on headed paper with the shop's legal identifiers (NIF, RC, n°
-- d'activité), the client's details, the line items and a TOTAL À PAYER. It is
-- explicitly NOT a receipt: "ne constitue pas une preuve de paiement".
--
-- So a proforma:
--   * never touches store_stock, store_silver_pool or store_cash_movements;
--   * only reserves a document number (PF-YYYYMMDD-NNNNN, shared sequence) and
--     stores its lines so the exact sheet can be reprinted later.
--
-- The legal identifiers differ per registered shop, so they live on `stores`
-- rather than as one hard-coded block.
--
-- REQUIRES 0020, 0021, 0027.

-- 1. legal identity on each shop -----------------------------------------

alter table stores
  add column if not exists nif             text,
  add column if not exists rc              text,
  add column if not exists activity_number text,
  add column if not exists email           text,
  add column if not exists website         text;

-- 2. proforma documents -------------------------------------------------

create table if not exists store_proformas (
  id               uuid primary key default gen_random_uuid(),
  proforma_number  text not null unique,
  store_id         uuid not null references stores (id) on delete restrict,
  customer_name    text,
  customer_address text,
  customer_city    text,
  customer_phone   text,
  customer_email   text,
  payment_method   text,
  subtotal         numeric(12, 2) not null default 0,
  discount         numeric(12, 2) not null default 0,
  shipping         numeric(12, 2) not null default 0,
  total            numeric(12, 2) not null default 0,
  notes            text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists store_proformas_store_idx
  on store_proformas (store_id, created_at desc);

create table if not exists store_proforma_items (
  id          uuid primary key default gen_random_uuid(),
  proforma_id uuid not null references store_proformas (id) on delete cascade,
  line_no     int not null default 1,
  name        text not null,
  material    text,
  quantity    numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price  numeric(12, 2) not null default 0 check (unit_price >= 0),
  line_total  numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored
);

create index if not exists store_proforma_items_parent_idx
  on store_proforma_items (proforma_id);

alter table store_proformas      enable row level security;
alter table store_proforma_items enable row level security;

drop policy if exists store_proformas_all on store_proformas;
create policy store_proformas_all on store_proformas
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));
drop policy if exists store_proformas_finance_read on store_proformas;
create policy store_proformas_finance_read on store_proformas
  for select to authenticated using (has_section('finance'));

drop policy if exists store_proforma_items_all on store_proforma_items;
create policy store_proforma_items_all on store_proforma_items
  for all to authenticated
  using (
    exists (select 1 from store_proformas p
            where p.id = proforma_id and can_access_store(p.store_id))
  )
  with check (
    exists (select 1 from store_proformas p
            where p.id = proforma_id and can_access_store(p.store_id))
  );
drop policy if exists store_proforma_items_finance_read on store_proforma_items;
create policy store_proforma_items_finance_read on store_proforma_items
  for select to authenticated using (has_section('finance'));

-- 3. create a proforma ------------------------------------------------
-- Totals are computed here from the stored lines; the client never sends a
-- price the server trusts blindly.

create or replace function public.create_store_proforma(doc jsonb, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store    uuid := nullif(doc ->> 'store_id', '')::uuid;
  v_id       uuid;
  v_number   text;
  v_item     jsonb;
  v_pos      int := 0;
  v_subtotal numeric := 0;
  v_discount numeric;
  v_shipping numeric;
  v_total    numeric;
begin
  if not has_section('store') then raise exception 'ERR_FORBIDDEN'; end if;
  if v_store is null or not can_access_store(v_store) then raise exception 'ERR_NO_STORE'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'ERR_EMPTY_SALE';
  end if;

  v_number := next_document_number('PF');

  insert into store_proformas (proforma_number, store_id, customer_name, customer_address,
                               customer_city, customer_phone, customer_email, payment_method,
                               notes, created_by)
  values (v_number, v_store,
          nullif(doc ->> 'customer_name', ''), nullif(doc ->> 'customer_address', ''),
          nullif(doc ->> 'customer_city', ''), nullif(doc ->> 'customer_phone', ''),
          nullif(doc ->> 'customer_email', ''), nullif(doc ->> 'payment_method', ''),
          nullif(doc ->> 'notes', ''), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(items) loop
    v_pos := v_pos + 1;
    insert into store_proforma_items (proforma_id, line_no, name, material, quantity, unit_price)
    values (v_id, v_pos,
            coalesce(nullif(v_item ->> 'name', ''), '—'),
            nullif(v_item ->> 'material', ''),
            greatest(coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1), 0.001),
            greatest(coalesce(nullif(v_item ->> 'unit_price', '')::numeric, 0), 0));
  end loop;

  select coalesce(sum(line_total), 0) into v_subtotal
  from store_proforma_items where proforma_id = v_id;

  v_discount := least(greatest(coalesce(nullif(doc ->> 'discount', '')::numeric, 0), 0), v_subtotal);
  v_shipping := greatest(coalesce(nullif(doc ->> 'shipping', '')::numeric, 0), 0);
  v_total := v_subtotal - v_discount + v_shipping;

  update store_proformas
  set subtotal = v_subtotal, discount = v_discount, shipping = v_shipping, total = v_total
  where id = v_id;

  return jsonb_build_object('id', v_id, 'proforma_number', v_number);
end;
$$;

revoke execute on function public.create_store_proforma(jsonb, jsonb) from public;
revoke execute on function public.create_store_proforma(jsonb, jsonb) from anon;
grant execute on function public.create_store_proforma(jsonb, jsonb) to authenticated;
