-- 0018 — close a hole in 0015: the payment-status RPCs were still callable by
-- the public (anon) role.
--
-- 0015 did `revoke execute on function mark_order_paid(...) from anon`, which
-- looks right but does nothing: Postgres grants EXECUTE on every new function
-- to PUBLIC by default, and anon inherits that PUBLIC grant. Revoking the role
-- named `anon` leaves the PUBLIC grant intact, so anyone holding the anon key
-- (it ships in the browser bundle) could POST
--   /rest/v1/rpc/mark_order_paid  {"p_order_number":"...","p_checkout_id":null}
-- and flip their own unpaid online order to payment_status='paid' AND
-- status='confirmed' — i.e. get goods shipped without paying.
--
-- The fix is to revoke from PUBLIC, then re-grant to service_role only. The
-- webhook (api/_lib/chargily.ts handleWebhook) is the sole caller and uses the
-- service-role key, so its behaviour is unchanged.

revoke execute on function mark_order_paid(text, text) from public;
revoke execute on function mark_order_paid(text, text) from anon;
revoke execute on function mark_order_paid(text, text) from authenticated;

revoke execute on function mark_order_failed(text) from public;
revoke execute on function mark_order_failed(text) from anon;
revoke execute on function mark_order_failed(text) from authenticated;

grant execute on function mark_order_paid(text, text) to service_role;
grant execute on function mark_order_failed(text) to service_role;

-- Same default-PUBLIC-grant reasoning applied deliberately to the two RPCs that
-- SHOULD stay open: they are re-granted explicitly so the intent is recorded in
-- the schema rather than inherited by accident.
revoke execute on function attach_checkout(text, text) from public;
grant execute on function attach_checkout(text, text) to anon;
grant execute on function attach_checkout(text, text) to service_role;

-- Repair any order that was already tampered with: an online order can only be
-- 'paid' if a verified webhook attached a checkout id and stamped paid_at.
-- (No-op on a clean database.)
update orders
set payment_status = 'unpaid',
    paid_at = null
where payment_method = 'online'
  and payment_status = 'paid'
  and (paid_at is null or chargily_checkout_id is null);
