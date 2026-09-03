-- Anti-abuse hardening.
--
--   * Newsletter sign-up moves from a raw anon INSERT to a SECURITY DEFINER RPC
--     that enforces the same timing/flood checks the client-side honeypot did
--     — a bot hitting PostgREST directly skipped those entirely.
--   * place_order / create_manual_order picked up a global order-volume circuit
--     breaker and longer order numbers in 0023 / 0024.
--
-- REQUIRES 0009 (newsletter_subscribers), 0016 (admin policies).

create or replace function public.subscribe_newsletter(p jsonb)
returns text  -- 'ok' | 'already' | 'invalid'
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email   text := lower(btrim(coalesce(p ->> 'email', '')));
  v_elapsed int  := coalesce(nullif(p ->> 'elapsed_ms', '')::int, 0);
  v_recent  int;
begin
  if char_length(v_email) > 200
     or v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    return 'invalid';
  end if;

  -- A real person spends more than 1.5 s reading the form and typing; a bot
  -- posts instantly. The client sends how long the form was mounted.
  if v_elapsed < 1500 then
    return 'invalid';
  end if;

  -- Global flood cap: no legitimate burst of 10 sign-ups in a minute.
  select count(*) into v_recent
  from newsletter_subscribers
  where created_at > now() - interval '1 minute';
  if v_recent >= 10 then
    return 'invalid';
  end if;

  insert into newsletter_subscribers (email)
  values (v_email)
  on conflict (lower(email)) do nothing;

  if not found then
    return 'already';
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.subscribe_newsletter(jsonb) from public;
grant execute on function public.subscribe_newsletter(jsonb) to anon, authenticated;

-- The storefront no longer inserts directly — only the RPC (which runs as
-- definer) may write. Admin read/delete keeps its 0016 policy.
drop policy if exists newsletter_subscribers_anon_insert on newsletter_subscribers;

-- Dashboard KPI cards computed in SQL instead of pulling every order row to the
-- browser to sum client-side. Section-gated the same way the table's RLS is.
create or replace function public.get_admin_order_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not (is_owner() or has_section('orders')) then '{}'::jsonb
    else jsonb_build_object(
      'orders_today',   (select count(*) from orders where created_at >= date_trunc('day', now())),
      'pending',        (select count(*) from orders where status = 'pending'),
      'revenue_total',  (select coalesce(sum(total), 0) from orders where status <> 'cancelled'),
      'revenue_30d',    (select coalesce(sum(total), 0) from orders
                          where status <> 'cancelled' and created_at >= now() - interval '30 days')
    )
  end;
$$;

revoke execute on function public.get_admin_order_stats() from public, anon;
grant execute on function public.get_admin_order_stats() to authenticated;
