-- ECOTRACK delivery integration: store the parcel tracking number and last
-- known courier status on each order. Populated by the admin dashboard when
-- an order is shipped ("Expédier via ECOTRACK") and refreshed on demand.
-- Idempotent — safe to run more than once.

alter table orders add column if not exists ecotrack_tracking text;
alter table orders add column if not exists ecotrack_status text;
alter table orders add column if not exists ecotrack_synced_at timestamptz;

-- Fast lookup / dedupe by tracking number.
create unique index if not exists orders_ecotrack_tracking_key
  on orders (ecotrack_tracking)
  where ecotrack_tracking is not null;
