-- Dettes (debts) — informal, manual debts NOT tied to a POS sale (money the
-- shop is owed for goods taken without full payment outside the structured
-- Versement flow, 0031). The Versement half of "who owes what" already lives
-- on `store_sales.balance_due`; this table is the other half.
--
-- No RPC needed for the manual side: direct table writes under RLS, exactly
-- like `store_cash_movements` already works (useAddCashMovement). Only the
-- running-total trigger needs SECURITY DEFINER, to also touch
-- store_cash_movements when a repayment is taken from the till.
--
-- REQUIRES 0020 (can_access_store, store_cash_movements).

create table if not exists store_debts (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores (id) on delete restrict,
  person_name  text not null,
  phone        text,
  description  text,
  amount       numeric(12, 2) not null check (amount > 0),
  amount_paid  numeric(12, 2) not null default 0,
  balance_due  numeric(12, 2) generated always as (round(amount - amount_paid, 2)) stored,
  due_date     date,
  settled      boolean not null default false,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists store_debts_store_idx on store_debts (store_id, created_at desc);

create table if not exists store_debt_payments (
  id             uuid primary key default gen_random_uuid(),
  debt_id        uuid not null references store_debts (id) on delete cascade,
  amount         numeric(12, 2) not null check (amount > 0),
  paid_from_till boolean not null default false,
  occurred_at    date not null default current_date,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists store_debt_payments_debt_idx on store_debt_payments (debt_id);

alter table store_debts         enable row level security;
alter table store_debt_payments enable row level security;

drop policy if exists store_debts_all on store_debts;
create policy store_debts_all on store_debts
  for all to authenticated
  using (can_access_store(store_id)) with check (can_access_store(store_id));
drop policy if exists store_debts_finance_read on store_debts;
create policy store_debts_finance_read on store_debts
  for select to authenticated using (has_section('finance'));

drop policy if exists store_debt_payments_all on store_debt_payments;
create policy store_debt_payments_all on store_debt_payments
  for all to authenticated
  using (exists (select 1 from store_debts d where d.id = debt_id and can_access_store(d.store_id)))
  with check (exists (select 1 from store_debts d where d.id = debt_id and can_access_store(d.store_id)));
drop policy if exists store_debt_payments_finance_read on store_debt_payments;
create policy store_debt_payments_finance_read on store_debt_payments
  for select to authenticated using (has_section('finance'));

-- A repayment optionally posts to the till (like an expense's
-- `paid_from_till`, 0020) — a signed cash-in for a debt someone just settled.
alter table store_cash_movements drop constraint if exists store_cash_movements_kind_check;
alter table store_cash_movements add constraint store_cash_movements_kind_check
  check (kind in ('sale', 'return', 'expense', 'deposit', 'withdrawal', 'adjustment', 'debt_payment'));

alter table store_cash_movements add column if not exists debt_payment_id uuid
  references store_debt_payments (id) on delete cascade;

create or replace function sync_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- NEW is unassigned on DELETE and OLD is unassigned on INSERT — referencing
-- either outside its valid branch raises "record is not assigned yet", so
-- every field read below goes through TG_OP-gated IF/ELSE branches, never a
-- coalesce() across both records.
declare
  v_debt    store_debts%rowtype;
  v_sum     numeric;
  v_payment_id uuid;
  v_debt_id uuid;
begin
  if tg_op = 'DELETE' then
    v_payment_id := old.id;
    v_debt_id := old.debt_id;
  else
    v_payment_id := new.id;
    v_debt_id := new.debt_id;
  end if;

  select * into v_debt from store_debts where id = v_debt_id for update;

  select coalesce(sum(amount), 0) into v_sum
  from store_debt_payments where debt_id = v_debt.id;

  update store_debts
  set amount_paid = least(v_sum, amount),
      settled = (least(v_sum, amount) >= amount)
  where id = v_debt.id;

  delete from store_cash_movements where debt_payment_id = v_payment_id;
  if tg_op in ('INSERT', 'UPDATE') and new.paid_from_till then
    insert into store_cash_movements (store_id, kind, amount, label, debt_payment_id, occurred_at, created_by)
    values (v_debt.store_id, 'debt_payment', new.amount, v_debt.person_name, new.id, new.occurred_at, auth.uid());
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists store_debt_payments_sync on store_debt_payments;
create trigger store_debt_payments_sync
after insert or update or delete on store_debt_payments
for each row execute function sync_debt_payment();
