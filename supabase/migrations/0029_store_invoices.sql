-- Factures (real invoices), generated straight from a completed till sale.
--
-- A Facture proforma (0028) is explicitly a pre-sale QUOTE: "ne constitue pas
-- une preuve de paiement". This is the other half — a document generated from
-- an already-completed, already-paid `store_sales` row, on the same printed
-- layout, proving a real transaction happened. It is generated per sale
-- (`sale_id unique`) and idempotent: re-clicking "Générer" on an already
-- invoiced sale just hands back the existing document for reprint, rather than
-- erroring or minting a second number for the same sale.
--
-- REQUIRES 0020, 0021, 0027, 0028.

-- 1. documents ----------------------------------------------------------

create table if not exists store_invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null unique,
  sale_id          uuid not null unique references store_sales (id) on delete cascade,
  store_id         uuid not null references stores (id) on delete restrict,
  customer_name    text,
  customer_address text,
  customer_city    text,
  customer_phone   text,
  customer_email   text,
  payment_method   text,
  subtotal         numeric(12, 2) not null default 0,
  discount         numeric(12, 2) not null default 0,
  total            numeric(12, 2) not null default 0,
  amount_paid      numeric(12, 2) not null default 0,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists store_invoices_store_idx
  on store_invoices (store_id, created_at desc);

create table if not exists store_invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references store_invoices (id) on delete cascade,
  line_no     int not null default 1,
  name        text not null,
  material    text,
  quantity    numeric(12, 3) not null default 1 check (quantity > 0),
  unit_price  numeric(12, 2) not null default 0 check (unit_price >= 0),
  line_total  numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored
);

create index if not exists store_invoice_items_parent_idx
  on store_invoice_items (invoice_id);

alter table store_invoices      enable row level security;
alter table store_invoice_items enable row level security;

drop policy if exists store_invoices_all on store_invoices;
create policy store_invoices_all on store_invoices
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));
drop policy if exists store_invoices_finance_read on store_invoices;
create policy store_invoices_finance_read on store_invoices
  for select to authenticated using (has_section('finance'));

drop policy if exists store_invoice_items_all on store_invoice_items;
create policy store_invoice_items_all on store_invoice_items
  for all to authenticated
  using (
    exists (select 1 from store_invoices i
            where i.id = invoice_id and can_access_store(i.store_id))
  )
  with check (
    exists (select 1 from store_invoices i
            where i.id = invoice_id and can_access_store(i.store_id))
  );
drop policy if exists store_invoice_items_finance_read on store_invoice_items;
create policy store_invoice_items_finance_read on store_invoice_items
  for select to authenticated using (has_section('finance'));

-- 2. generate (or fetch) a sale's invoice --------------------------------
-- Idempotent on sale_id: the button that calls this is "Générer la facture",
-- but clicking it again on an already-invoiced sale must reprint the SAME
-- document, not raise a unique-violation or mint a second FA- number.

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
          v_sale.subtotal, v_sale.discount, v_sale.total,
          -- store_sales gains `amount_paid` in 0031 (versement); this function
          -- is redefined there to read it. Until then every sale is paid in full.
          v_sale.total,
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
