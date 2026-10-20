-- Plan 15.2 B8 — pgTAP for reservation expiry.
--
-- Proves the release valve end to end: function shape and grants, the
-- settings default, "exactly once" (a re-run releases nothing), the same
-- stock effects as admin_set_order_status (cancel_release movement + history
-- row, system actor = NULL), the pending+unpaid+age filters, made_to_order
-- lines skipping the ledger, the pg_cron job being scheduled, and the hold
-- being tunable without a deploy. Runs inside one rolled-back transaction,
-- so the backdated orders never leak into the database.

create extension if not exists pgtap with schema extensions;

begin;

select plan(29);

-- ------------------------------------------------------------- function shape --
select has_function('public', 'release_expired_pending_orders', array[]::text[],
  'the B8 release function exists');

select ok(
  (select prosecdef from pg_proc
    where oid = 'public.release_expired_pending_orders()'::regprocedure),
  'release_expired_pending_orders is security definer'
);

select is(
  (select array_to_string(proconfig, '|') from pg_proc
    where oid = 'public.release_expired_pending_orders()'::regprocedure),
  'search_path=""',
  'release_expired_pending_orders pins search_path to empty'
);

select is(
  (select value ->> 'hours' from public.settings where key = 'pending_order_hold_hours'),
  '48',
  'the hold defaults to 48 hours'
);

-- ------------------------------------------------------------------- grants --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.release_expired_pending_orders()$$,
  '42501',
  'permission denied for function release_expired_pending_orders',
  'anon cannot execute the expiry function'
);

select set_config('request.jwt.claims',
  '{"sub":"b8300001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.release_expired_pending_orders()$$,
  '42501',
  'permission denied for function release_expired_pending_orders',
  'a signed-in staff session still cannot execute it — only cron/service_role may'
);

reset role;

select is(
  (select count(*)::integer from cron.job where jobname = 'release-expired-pending-orders'),
  1,
  'the migration scheduled the pg_cron job exactly once'
);

-- ------------------------------------------------------------------ fixture --
insert into public.products (id, slug, type, title_en, moq, stock_mode, status) values
  ('b8000001-0000-4000-8000-000000000001', 'b8-tracked', 'buy_now', 'B8 tracked bag', 5, 'tracked', 'published'),
  ('b8000002-0000-4000-8000-000000000001', 'b8-mto', 'buy_now', 'B8 made-to-order bag', 5, 'made_to_order', 'published');

insert into public.product_variants (id, product_id, sku, color_name, price_delta, stock_qty, reserved_qty, is_active) values
  ('b8100001-0000-4000-8000-000000000001', 'b8000001-0000-4000-8000-000000000001', 'B8-EXPIRED', 'Black', 0, 20, 0, true),
  ('b8100002-0000-4000-8000-000000000001', 'b8000001-0000-4000-8000-000000000001', 'B8-FRESH', 'Black', 0, 20, 0, true),
  ('b8100003-0000-4000-8000-000000000001', 'b8000001-0000-4000-8000-000000000001', 'B8-PAID', 'Black', 0, 20, 0, true),
  ('b8100004-0000-4000-8000-000000000001', 'b8000001-0000-4000-8000-000000000001', 'B8-CONFIRMED', 'Black', 0, 20, 0, true),
  ('b8100005-0000-4000-8000-000000000001', 'b8000001-0000-4000-8000-000000000001', 'B8-CUSTOM', 'Black', 0, 20, 0, true),
  ('b8100006-0000-4000-8000-000000000001', 'b8000002-0000-4000-8000-000000000001', 'B8-MTO', 'Black', 0, 20, 0, true);

insert into public.price_tiers (product_id, min_qty, max_qty, unit_price) values
  ('b8000001-0000-4000-8000-000000000001', 5, null, 100),
  ('b8000002-0000-4000-8000-000000000001', 5, null, 100);

insert into public.shipping_zones (id, name_en, fee, free_over, is_active) values
  ('b8200000-0000-4000-8000-000000000001', 'B8 test zone', 50, 500, true);

-- Five orders placed through the production path (tracked lines reserve 5;
-- made_to_order lines reserve nothing, per the 202610150002 place_order).
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select ok(public.place_order('{"customer_name":"B8 tester","customer_phone":"01700000081","shipping_zone_id":"b8200000-0000-4000-8000-000000000001","idempotency_key":"b8-expired","items":[{"variant_id":"b8100001-0000-4000-8000-000000000001","qty":5}]}'::jsonb) like 'PBF-%', 'the expired-order reservation is real (place_order)');
select ok(public.place_order('{"customer_name":"B8 tester","customer_phone":"01700000081","shipping_zone_id":"b8200000-0000-4000-8000-000000000001","idempotency_key":"b8-fresh","items":[{"variant_id":"b8100002-0000-4000-8000-000000000001","qty":5}]}'::jsonb) like 'PBF-%', 'the fresh order is placed for the age filter');
select ok(public.place_order('{"customer_name":"B8 tester","customer_phone":"01700000081","shipping_zone_id":"b8200000-0000-4000-8000-000000000001","idempotency_key":"b8-paid","items":[{"variant_id":"b8100003-0000-4000-8000-000000000001","qty":5}]}'::jsonb) like 'PBF-%', 'the paid order is placed for the payment filter');
select ok(public.place_order('{"customer_name":"B8 tester","customer_phone":"01700000081","shipping_zone_id":"b8200000-0000-4000-8000-000000000001","idempotency_key":"b8-confirmed","items":[{"variant_id":"b8100004-0000-4000-8000-000000000001","qty":5}]}'::jsonb) like 'PBF-%', 'the confirmed order is placed for the status filter');
select ok(public.place_order('{"customer_name":"B8 tester","customer_phone":"01700000081","shipping_zone_id":"b8200000-0000-4000-8000-000000000001","idempotency_key":"b8-mto","items":[{"variant_id":"b8100006-0000-4000-8000-000000000001","qty":5}]}'::jsonb) like 'PBF-%', 'the made-to-order reservation is placed');

-- Backdate as the table owner (postgres) — RLS never applies to the owner and
-- pg_cron runs as postgres too, so this matches the job's real privileges.
reset role;

update public.orders
  set created_at = now() - interval '49 hours'
  where idempotency_key in ('b8-expired', 'b8-paid', 'b8-confirmed', 'b8-mto');
update public.orders set payment_status = 'paid' where idempotency_key = 'b8-paid';
update public.orders set status = 'confirmed' where idempotency_key = 'b8-confirmed';

-- ---------------------------------------------------------------- the run --
select is(public.release_expired_pending_orders(), 2,
  'one run releases exactly the expired pending unpaid orders (tracked + made-to-order)');

select is(
  (select status::text from public.orders where idempotency_key = 'b8-expired'),
  'cancelled',
  'the expired order is cancelled'
);

select is(
  (select reserved_qty from public.product_variants
    where id = 'b8100001-0000-4000-8000-000000000001'),
  0,
  'the tracked reservation is given back'
);

select is(
  (select count(*)::integer from public.inventory_movements
    where ref_id = (select order_no from public.orders where idempotency_key = 'b8-expired')
      and reason = 'cancel_release' and delta = 5 and created_by is null),
  1,
  'exactly one cancel_release movement of +5 by the system actor (NULL)'
);

select is(
  (select count(*)::integer from public.order_status_history
    where order_id = (select id from public.orders where idempotency_key = 'b8-expired')
      and from_status = 'pending'::public.order_status
      and to_status = 'cancelled'::public.order_status
      and changed_by is null
      and note like '%48 h unpaid%'),
  1,
  'the history row records pending to cancelled by the system with the hold in the note'
);

-- ------------------------------------------------------------- exactly once --
select is(public.release_expired_pending_orders(), 0,
  'a second run releases nothing (the status flip is the exactly-once guard)');

select is(
  (select count(*)::integer from public.inventory_movements
    where ref_id = (select order_no from public.orders where idempotency_key = 'b8-expired')
      and reason = 'cancel_release'),
  1,
  'the ledger still carries exactly one release for that order'
);

-- -------------------------------------------------------------- untouched --
select is(
  (select status::text from public.orders where idempotency_key = 'b8-fresh'),
  'pending',
  'a pending order inside the hold is not touched'
);

select is(
  (select reserved_qty from public.product_variants
    where id = 'b8100002-0000-4000-8000-000000000001'),
  5,
  'the fresh order still holds its stock'
);

select is(
  (select status::text from public.orders where idempotency_key = 'b8-paid'),
  'pending',
  'a stale but paid order is never auto-cancelled'
);

select is(
  (select status::text from public.orders where idempotency_key = 'b8-confirmed'),
  'confirmed',
  'staff-confirmed orders are beyond the release valve'
);

select is(
  (select status::text from public.orders where idempotency_key = 'b8-mto'),
  'cancelled',
  'the expired made-to-order order is cancelled too'
);

select is(
  (select count(*)::integer from public.inventory_movements
    where ref_id = (select order_no from public.orders where idempotency_key = 'b8-mto')
      and reason = 'cancel_release'),
  0,
  'made_to_order lines write no release movement (same rule as admin_set_order_status)'
);

select is(
  (select reserved_qty from public.product_variants
    where id = 'b8100006-0000-4000-8000-000000000001'),
  0,
  'a made_to_order line never held a reservation (place_order reserves tracked only)'
);

-- ------------------------------------------------- the hold is tunable --
update public.settings
  set value = '{"hours": 1}'::jsonb
  where key = 'pending_order_hold_hours';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select ok(public.place_order('{"customer_name":"B8 tester","customer_phone":"01700000081","shipping_zone_id":"b8200000-0000-4000-8000-000000000001","idempotency_key":"b8-custom","items":[{"variant_id":"b8100005-0000-4000-8000-000000000001","qty":5}]}'::jsonb) like 'PBF-%', 'a second-hour order is placed for the lowered hold');

reset role;
update public.orders set created_at = now() - interval '2 hours' where idempotency_key = 'b8-custom';

select is(public.release_expired_pending_orders(), 1,
  'with the hold lowered to 1 h only the new expired order is released (no deploy needed)');

select is(
  (select status::text from public.orders where idempotency_key = 'b8-custom'),
  'cancelled',
  'the custom-hold order is cancelled by the tuned setting'
);

select * from finish();
rollback;
