-- Email notification on a new website order (Resend).
--
-- Self-serve and per account: every admin/staff member turns on their own
-- email and types their own address. The owner never configures it for someone
-- else, which is why the RLS policy below is `user_id = auth.uid()` only and
-- there is no owner-manages-everyone escape hatch — this is personal contact
-- information, not a section grant.
--
-- Email only by request. If WhatsApp is ever added, it belongs as extra
-- columns on this same table and an extra branch in the edge function, not a
-- second table.

-- 1. per-account preferences -------------------------------------------------

create table if not exists admin_notification_prefs (
  -- FK to admin_profiles (not auth.users) so the edge function can embed
  -- `admin_profiles!inner(active)` and skip deactivated staff in ONE query.
  user_id       uuid primary key references admin_profiles (user_id) on delete cascade,
  email_enabled boolean not null default false,
  notify_email  text,
  updated_at    timestamptz not null default now()
);

alter table admin_notification_prefs enable row level security;

drop policy if exists "admin manages own notification prefs" on admin_notification_prefs;
create policy "admin manages own notification prefs" on admin_notification_prefs
  for all to authenticated
  using (user_id = auth.uid() and is_admin())
  with check (user_id = auth.uid() and is_admin());

-- 2. the at-most-once guard --------------------------------------------------

alter table orders add column if not exists notified_at timestamptz;

-- 3. atomic claim ------------------------------------------------------------
--
-- The edge function is reachable by an anonymous shopper's browser, so it can
-- be replayed or probed. `update ... where notified_at is null returning ...`
-- makes every claim succeed AT MOST ONCE, ever: a retry, a duplicate invoke or
-- a stranger guessing order numbers all get the same empty result. The guard
-- IS the security boundary here.

create or replace function claim_order_notification(p_order_number text)
returns table (
  order_number  text,
  customer_name text,
  customer_phone text,
  wilaya        text,
  city          text,
  total         numeric,
  item_count    integer,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    update orders o set notified_at = now()
     where o.order_number = p_order_number and o.notified_at is null
    returning o.order_number, o.customer_name, o.customer_phone, o.wilaya,
              o.city, o.total,
              (select count(*)::int from order_items oi where oi.order_id = o.id),
              o.created_at;
end;
$$;

-- ⚠ Deliberately NOT granted to anon/authenticated, unlike place_order.
-- place_order needs an anon grant because the shopper's browser calls it.
-- This one is only ever called BY the edge function with the service-role key,
-- which bypasses function grants entirely — so a grant would buy nothing and
-- cost plenty: anyone holding the public anon key could POST to it, which
-- (a) leaks the customer's phone number, and (b) permanently suppresses the
-- real notification for that order, since each row claims at most once.
revoke execute on function public.claim_order_notification(text) from public, anon, authenticated;
