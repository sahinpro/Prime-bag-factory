-- Plan 15.2 A4 — pgTAP for the Phase 5 fulfilment RPCs plus the RLS sweep.
--
-- Runs via `supabase test db` (pg_prove as postgres, one transaction, rolled
-- back). place_order basics (anon oversell rejection, idempotency replay,
-- direct anon INSERT rejection, server-side repricing) are already proven in
-- phase1_rls.test.sql; this file adds the tier boundaries, MOQ, the two admin
-- RPCs end to end, and "every table has RLS enabled".

create extension if not exists pgtap with schema extensions;

begin;

select plan(42);

-- ---------------------------------------------------------------- fixture --
-- Staff uuid has an auth.users row (history/movement created_by FKs point at
-- auth.users); profiles carry the roles has_role() checks.
insert into auth.users (id) values
  ('b5300001-0000-4000-8000-000000000001'),
  ('b5300002-0000-4000-8000-000000000001');

insert into public.profiles (id, full_name, role) values
  ('b5300001-0000-4000-8000-000000000001', 'A4 Owner', 'owner'),
  ('b5300002-0000-4000-8000-000000000001', 'A4 Customer', 'customer');

insert into public.products (id, slug, type, title_en, moq, stock_mode, status) values
  ('b5000001-0000-4000-8000-000000000001', 'a4-tier-product', 'buy_now', 'A4 tier bag', 5, 'tracked', 'published'),
  ('b5000002-0000-4000-8000-000000000001', 'a4-status-product', 'buy_now', 'A4 status bag', 5, 'tracked', 'published'),
  ('b5000003-0000-4000-8000-000000000001', 'a4-payment-product', 'buy_now', 'A4 payment bag', 5, 'tracked', 'published');

insert into public.product_variants (id, product_id, sku, color_name, price_delta, stock_qty, reserved_qty, is_active) values
  ('b5100001-0000-4000-8000-000000000001', 'b5000001-0000-4000-8000-000000000001', 'A4-TIER-V1', 'Black', 0, 200, 0, true),
  ('b5100002-0000-4000-8000-000000000001', 'b5000002-0000-4000-8000-000000000001', 'A4-STATUS-V1', 'Black', 0, 20, 0, true),
  ('b5100003-0000-4000-8000-000000000001', 'b5000003-0000-4000-8000-000000000001', 'A4-PAYMENT-V1', 'Black', 0, 20, 0, true);

-- The 50/51 boundary straight from plan §7's sample tiering.
insert into public.price_tiers (product_id, min_qty, max_qty, unit_price) values
  ('b5000001-0000-4000-8000-000000000001', 5, 50, 100),
  ('b5000001-0000-4000-8000-000000000001', 51, null, 80),
  ('b5000002-0000-4000-8000-000000000001', 5, null, 100),
  ('b5000003-0000-4000-8000-000000000001', 5, null, 100);

insert into public.shipping_zones (id, name_en, fee, free_over, is_active) values
  ('b5200000-0000-4000-8000-000000000001', 'A4 test zone', 50, 500, true);

-- ------------------------------------------------------ place_order (anon) --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.place_order('{
      "customer_name":"A4 customer","customer_phone":"01700000009",
      "shipping_zone_id":"b5200000-0000-4000-8000-000000000001",
      "idempotency_key":"a4-moq",
      "items":[{"variant_id":"b5100002-0000-4000-8000-000000000001","qty":4}]
    }'::jsonb)$$,
  'P0001', 'Quantity below MOQ',
  'place_order rejects a quantity under the product MOQ'
);

select ok(
  public.place_order('{
    "customer_name":"A4 customer","customer_phone":"01700000009",
    "shipping_zone_id":"b5200000-0000-4000-8000-000000000001",
    "idempotency_key":"a4-tiers-50",
    "items":[{"variant_id":"b5100001-0000-4000-8000-000000000001","qty":50}]
  }'::jsonb) like 'PBF-%',
  'place_order accepts exactly 50 (upper tier boundary)'
);

select ok(
  public.place_order('{
    "customer_name":"A4 customer","customer_phone":"01700000009",
    "shipping_zone_id":"b5200000-0000-4000-8000-000000000001",
    "idempotency_key":"a4-tiers-51",
    "items":[{"variant_id":"b5100001-0000-4000-8000-000000000001","qty":51}]
  }'::jsonb) like 'PBF-%',
  'place_order accepts exactly 51 (lower edge of the next tier)'
);

-- Read the money back as the table owner (postgres): anon RLS cannot see
-- order rows, which is itself correct — phase1 already asserts anon direct
-- INSERT is refused.
reset role;

select is(
  (select subtotal from public.orders where idempotency_key = 'a4-tiers-50'),
  5000::numeric,
  'qty 50 prices at the 5-50 tier (100/unit)'
);

select is(
  (select unit_price from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.idempotency_key = 'a4-tiers-50'),
  100::numeric,
  'the order line snapshots the tier unit price'
);

select is(
  (select subtotal from public.orders where idempotency_key = 'a4-tiers-51'),
  4080::numeric,
  'qty 51 crosses the tier boundary and prices at 80/unit'
);

select is(
  (select shipping_fee from public.orders where idempotency_key = 'a4-tiers-51'),
  0::numeric,
  'free shipping triggers from the zone threshold, not the client'
);

select is(
  (select reserved_qty from public.product_variants
    where id = 'b5100001-0000-4000-8000-000000000001'),
  101,
  'both tier orders reserve their full quantity'
);

-- ------------------------------------------------ admin RPC access control --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.admin_set_order_status(
    (select id from public.orders where idempotency_key = 'a4-status'),
    'confirmed'::public.order_status
  )$$,
  '42501',
  'permission denied for function admin_set_order_status',
  'anon cannot execute admin_set_order_status'
);

select set_config('request.jwt.claims',
  '{"sub":"b5300002-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.admin_set_order_status(
    (select id from public.orders where idempotency_key = 'a4-status'),
    'confirmed'::public.order_status
  )$$,
  'P0001', 'not_allowed',
  'a plain customer session is refused by admin_set_order_status'
);

-- ------------------------------------------------- admin_set_order_status --
-- Create the lifecycle order as anon, then drive it as the owner staff user.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select ok(
  public.place_order('{
    "customer_name":"A4 customer","customer_phone":"01700000009",
    "shipping_zone_id":"b5200000-0000-4000-8000-000000000001",
    "idempotency_key":"a4-status",
    "items":[{"variant_id":"b5100002-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb) like 'PBF-%',
  'the lifecycle order is placed (5 x 100 = 500, free shipping)'
);

select set_config('request.jwt.claims',
  '{"sub":"b5300001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.admin_set_order_status(id, 'confirmed')
    from public.orders where idempotency_key = 'a4-status'),
  (select order_no from public.orders where idempotency_key = 'a4-status'),
  'pending to confirmed returns the order number'
);

select is(
  (select status::text from public.orders where idempotency_key = 'a4-status'),
  'confirmed',
  'the status lands as confirmed'
);

select is(
  (select count(*)::integer from public.order_status_history
    where order_id = (select id from public.orders where idempotency_key = 'a4-status')),
  1,
  'the move writes exactly one history row'
);

select is(
  (select stock_qty from public.product_variants
    where id = 'b5100002-0000-4000-8000-000000000001'),
  20,
  'confirming does not touch physical stock'
);

select is(
  (select public.admin_set_order_status(id, 'shipped', 'via courier')
    from public.orders where idempotency_key = 'a4-status'),
  (select order_no from public.orders where idempotency_key = 'a4-status'),
  'confirmed to shipped is accepted'
);

select is(
  (select stock_qty from public.product_variants
    where id = 'b5100002-0000-4000-8000-000000000001'),
  15,
  'shipping decrements physical stock by the line quantity'
);

select is(
  (select reserved_qty from public.product_variants
    where id = 'b5100002-0000-4000-8000-000000000001'),
  0,
  'shipping releases the reservation'
);

select is(
  (select sum(delta)::integer from public.inventory_movements
    where ref_id = (select order_no from public.orders where idempotency_key = 'a4-status')
      and reason = 'sale' and note = 'Shipped stock for order'),
  -5,
  'shipping writes its own sale movement of minus the quantity'
);

select is(
  (select shipped_at is not null from public.orders where idempotency_key = 'a4-status'),
  true,
  'shipping stamps shipped_at'
);

select is(
  (select public.admin_set_order_status(id, 'shipped')
    from public.orders where idempotency_key = 'a4-status'),
  (select order_no from public.orders where idempotency_key = 'a4-status'),
  're-sending the current status returns early'
);

select is(
  (select count(*)::integer from public.inventory_movements
    where ref_id = (select order_no from public.orders where idempotency_key = 'a4-status')
      and reason = 'sale' and note = 'Shipped stock for order'),
  1,
  'a double ship never moves stock twice'
);

select is(
  (select count(*)::integer from public.order_status_history
    where order_id = (select id from public.orders where idempotency_key = 'a4-status')),
  2,
  'a double ship never writes a second history row'
);

select is(
  (select public.admin_set_order_status(id, 'delivered')
    from public.orders where idempotency_key = 'a4-status'),
  (select order_no from public.orders where idempotency_key = 'a4-status'),
  'shipped to delivered is accepted'
);

select is(
  (select delivered_at is not null from public.orders where idempotency_key = 'a4-status'),
  true,
  'delivery stamps delivered_at'
);

select is(
  (select public.admin_set_order_status(id, 'returned')
    from public.orders where idempotency_key = 'a4-status'),
  (select order_no from public.orders where idempotency_key = 'a4-status'),
  'delivered to returned is accepted'
);

select is(
  (select stock_qty from public.product_variants
    where id = 'b5100002-0000-4000-8000-000000000001'),
  20,
  'returning puts the units back on the shelf'
);

select is(
  (select sum(delta)::integer from public.inventory_movements
    where ref_id = (select order_no from public.orders where idempotency_key = 'a4-status')
      and reason = 'return'),
  5,
  'the return writes a plus-quantity movement'
);

select throws_ok(
  $$select public.admin_set_order_status(
    (select id from public.orders where idempotency_key = 'a4-status'),
    'cancelled'::public.order_status
  )$$,
  'P0001', 'cannot_cancel_after_shipment',
  'a shipped order cannot be cancelled'
);

select is(
  (select count(*)::integer from public.order_status_history
    where order_id = (select id from public.orders where idempotency_key = 'a4-status')),
  4,
  'the full walk left exactly four history rows'
);

-- --------------------------------------------------- admin_record_payment --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select ok(
  public.place_order('{
    "customer_name":"A4 customer","customer_phone":"01700000009",
    "shipping_zone_id":"b5200000-0000-4000-8000-000000000001",
    "idempotency_key":"a4-payment",
    "items":[{"variant_id":"b5100003-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb) like 'PBF-%',
  'the payment order is placed (total 500)'
);

select set_config('request.jwt.claims',
  '{"sub":"b5300001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.admin_record_payment(
    (select id from public.orders where idempotency_key = 'a4-payment'),
    0, 'bkash_manual'::public.payment_method
  )$$,
  'P0001', 'invalid_amount',
  'a zero payment is rejected'
);

select throws_ok(
  $$select public.admin_record_payment(
    (select id from public.orders where idempotency_key = 'a4-payment'),
    501, 'bkash_manual'::public.payment_method
  )$$,
  'P0001', 'payment_exceeds_balance',
  'overpaying beyond the order total is rejected'
);

select ok(
  (select public.admin_record_payment(
    (select id from public.orders where idempotency_key = 'a4-payment'),
    200, 'bkash_manual'::public.payment_method
  )) is not null,
  'a 200 advance on a 500 order is recorded'
);

select is(
  (select payment_status::text from public.orders where idempotency_key = 'a4-payment'),
  'partially_paid',
  'the order flips to partially_paid'
);

select is(
  (select coalesce(sum(amount), 0) from public.payments
    where order_id = (select id from public.orders where idempotency_key = 'a4-payment')),
  200::numeric,
  'the ledger carries exactly the advance'
);

select ok(
  (select public.admin_record_payment(
    (select id from public.orders where idempotency_key = 'a4-payment'),
    300, 'cash'::public.payment_method
  )) is not null,
  'paying the remaining balance is recorded'
);

select is(
  (select payment_status::text from public.orders where idempotency_key = 'a4-payment'),
  'paid',
  'a full ledger flips the order to paid'
);

select throws_ok(
  $$select public.admin_record_payment(
    (select id from public.orders where idempotency_key = 'a4-payment'),
    1, 'cash'::public.payment_method
  )$$,
  'P0001', 'payment_exceeds_balance',
  'a paid order refuses even 1 more'
);

select set_config('request.jwt.claims',
  '{"sub":"b5300002-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.admin_record_payment(
    (select id from public.orders where idempotency_key = 'a4-payment'),
    1, 'cash'::public.payment_method
  )$$,
  'P0001', 'not_allowed',
  'a plain customer session is refused by admin_record_payment'
);

-- ------------------------------------------------------------- RLS sweep --
reset role;

select is(
  (select count(*)::integer
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::integer,
  'every table in the public schema has row level security enabled'
);

select ok(
  (select count(*) >= 33
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'),
  'the RLS sweep covers at least the 33 shipped tables (not vacuously true)'
);

select * from finish();
rollback;
