-- Per-status totals for the orders desk board rail.
--
-- The orders list is capped (300 most recent), so counting statuses from the
-- rows the browser happens to hold would quietly under-report every tile the
-- moment the shop passes that many orders. This aggregates in SQL over the
-- whole table instead.
--
-- Section-gated and revoked exactly like get_admin_order_stats (0025): an
-- unauthorised caller gets '{}' rather than an error, so the UI degrades to
-- empty tiles instead of throwing.

create or replace function public.get_order_status_board()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not (is_owner() or has_section('orders')) then '{}'::jsonb
    else coalesce(
      (
        select jsonb_object_agg(
                 s.status,
                 jsonb_build_object('count', s.n, 'total', s.amount)
               )
        from (
          select o.status, count(*) as n, coalesce(sum(o.total), 0) as amount
          from orders o
          group by o.status
        ) s
      ),
      '{}'::jsonb
    )
  end;
$$;

revoke execute on function public.get_order_status_board() from public, anon;
grant execute on function public.get_order_status_board() to authenticated;
