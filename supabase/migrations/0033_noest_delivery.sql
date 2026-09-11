-- The client switched delivery couriers from ECOTRACK to NOEST Express.
-- Renaming rather than adding new columns keeps every already-shipped
-- order's tracking history intact — a plain `alter table ... rename column`
-- is metadata-only, no data is touched or lost.
--
-- Named generically (delivery_*, not noest_*) so the NEXT courier swap is a
-- code change only, never another migration + another rename across every
-- admin screen that reads these columns.
-- Idempotent — safe to run more than once.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'orders' and column_name = 'ecotrack_tracking'
  ) then
    alter table orders rename column ecotrack_tracking to delivery_tracking;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'orders' and column_name = 'ecotrack_status'
  ) then
    alter table orders rename column ecotrack_status to delivery_status;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'orders' and column_name = 'ecotrack_synced_at'
  ) then
    alter table orders rename column ecotrack_synced_at to delivery_synced_at;
  end if;
end $$;

-- Columns may not exist yet on a fresh database that skipped straight to
-- this migration (e.g. a restored backup) — add them if 0013 never ran.
alter table orders add column if not exists delivery_tracking text;
alter table orders add column if not exists delivery_status text;
alter table orders add column if not exists delivery_synced_at timestamptz;

drop index if exists orders_ecotrack_tracking_key;
create unique index if not exists orders_delivery_tracking_key
  on orders (delivery_tracking)
  where delivery_tracking is not null;
