-- Plan 15.2 F2 — pgTAP for production status + artwork approval.
--
-- Proves (a) the staff boundary and the retail/not-applicable guard, (b) the
-- server-side allowed-transition rules (adjacency forward/back only, null opens
-- at awaiting_artwork, re-applying is a no-op), (c) that the enum + bulk-only
-- CHECK are enforced in the schema, and (d) that every accepted move writes
-- exactly one audit_logs row and one admin-bell notification — with no phone.

create extension if not exists pgtap with schema extensions;

begin;

select plan(18);

-- ---------------------------------------------------------------- fixture --
insert into auth.users (id) values
  ('a2f20000-0000-4000-8000-000000000001'),  -- owner
  ('a2f20000-0000-4000-8000-000000000002'),  -- sales
  ('a2f20000-0000-4000-8000-000000000003');  -- customer

insert into public.profiles (id, full_name, role) values
  ('a2f20000-0000-4000-8000-000000000001', 'F2 Owner', 'owner'),
  ('a2f20000-0000-4000-8000-000000000002', 'F2 Sales', 'sales'),
  ('a2f20000-0000-4000-8000-000000000003', 'F2 Customer', 'customer');

-- one retail order (production not applicable), two bulk orders
insert into public.orders (id, order_no, type, status, customer_name, customer_phone, total) values
  ('a2f21000-0000-4000-8000-000000000001', 'PBF-F2-RETAIL', 'retail', 'confirmed', 'Retail Co', '01700000101', 500),
  ('a2f21000-0000-4000-8000-000000000002', 'PBF-F2-B1', 'bulk', 'confirmed', 'Bulk One', '01700000102', 5000),
  ('a2f21000-0000-4000-8000-000000000003', 'PBF-F2-B2', 'bulk', 'confirmed', 'Bulk Two', '01700000103', 8000);

-- ========================================================= staff boundary ==
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000002', 'awaiting_artwork')$$,
  '42501', null,
  'anon cannot execute admin_set_production_status'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2f20000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select throws_ok(
  $$select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000002', 'awaiting_artwork')$$,
  'P0001', 'not_allowed',
  'a customer session is refused'
);

-- ===================================================== retail not allowed ==
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2f20000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000001', 'awaiting_artwork')$$,
  'P0001', 'production_not_applicable',
  'a retail order carries no production status'
);

-- ================================================ adjacency on the bulk b1 ==
select is(
  public.admin_set_production_status('a2f21000-0000-4000-8000-000000000002', 'awaiting_artwork'),
  'PBF-F2-B1',
  'a null bulk order opens production at awaiting_artwork'
);

reset role;
select is(
  (select production_status::text from public.orders where id = 'a2f21000-0000-4000-8000-000000000002'),
  'awaiting_artwork',
  'the order now stores awaiting_artwork'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2f20000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000002', 'in_production')$$,
  'P0001', 'invalid_production_transition',
  'awaiting_artwork cannot skip straight to in_production'
);

select is(
  public.admin_set_production_status('a2f21000-0000-4000-8000-000000000002', 'artwork_approved'),
  'PBF-F2-B1',
  'awaiting_artwork -> artwork_approved is allowed'
);

reset role;
select is(
  (select production_status::text from public.orders where id = 'a2f21000-0000-4000-8000-000000000002'),
  'artwork_approved',
  'artwork approval is stored'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2f20000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  public.admin_set_production_status('a2f21000-0000-4000-8000-000000000002', 'awaiting_artwork'),
  'PBF-F2-B1',
  'a one-step rollback (artwork_approved -> awaiting_artwork) is allowed'
);

-- no-op: re-applying the current status changes nothing and enqueues nothing
select is(
  public.admin_set_production_status('a2f21000-0000-4000-8000-000000000002', 'awaiting_artwork'),
  'PBF-F2-B1',
  're-applying the current status returns the order number (no-op)'
);

reset role;
select is(
  (select count(*)::integer from public.notifications
     where template = 'production_status'
       and payload ->> 'order_id' = 'a2f21000-0000-4000-8000-000000000002'),
  3,
  'the no-op added no fourth notification (three accepted moves only)'
);

select is(
  (select count(*)::integer from public.audit_logs
     where action = 'order.production_status'
       and record_id = 'a2f21000-0000-4000-8000-000000000002'),
  3,
  'the no-op added no fourth audit row'
);

-- =========================================== full forward walk on bulk b2 ==
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2f20000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000003', 'awaiting_artwork');
select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000003', 'artwork_approved');
select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000003', 'in_production');
select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000003', 'qc');
select public.admin_set_production_status('a2f21000-0000-4000-8000-000000000003', 'ready');

reset role;
select is(
  (select production_status::text from public.orders where id = 'a2f21000-0000-4000-8000-000000000003'),
  'ready',
  'the full forward walk reaches ready'
);

select is(
  (select count(*)::integer from public.audit_logs
     where action = 'order.production_status'
       and record_id = 'a2f21000-0000-4000-8000-000000000003'),
  5,
  'every accepted move on b2 wrote one audit row'
);

select ok(
  exists (
    select 1 from public.notifications
      where template = 'production_status'
        and payload ->> 'order_id' = 'a2f21000-0000-4000-8000-000000000003'
  ),
  'a production_status admin-bell notification was enqueued'
);

select ok(
  not exists (
    select 1 from public.notifications
      where template = 'production_status'
        and payload ? 'customer_phone'
  ),
  'the notification payload never carries the customer phone'
);

-- ==================================================== schema bulk-only ====
select throws_ok(
  $$insert into public.orders (order_no, type, customer_name, customer_phone, production_status)
    values ('PBF-F2-CHK', 'retail', 'x', '01700000199', 'qc')$$,
  '23514', null,
  'the CHECK refuses a production status on a retail order'
);

-- sales is allowed (fulfilment role) and can open production
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a2f20000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is(
  public.admin_set_production_status('a2f21000-0000-4000-8000-000000000002', 'artwork_approved'),
  'PBF-F2-B1',
  'a sales user may move production forward'
);

select * from finish();
rollback;
