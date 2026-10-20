-- Plan 15.2 E3 — pgTAP for the shared order core and admin_create_order.
--
-- Proves the security boundary (anon/customer denied, sales limited, owner
-- allowed), that admin pricing is IDENTICAL to place_order at the 50/51 tier
-- boundary, the MOQ / oversell / made-to-order rules, idempotency replay,
-- the audit row, the advance ledger and the channel requirement. place_order's
-- own behaviour is unchanged (it delegates to create_order_core); the existing
-- suites (phase1_rls, phase5_fulfilment, track_b8) still assert the same
-- messages and numbers with no changes.

create extension if not exists pgtap with schema extensions;

begin;

select plan(34);

-- ---------------------------------------------------------------- fixture --
insert into auth.users (id) values
  ('b5e33000-0000-4000-8000-000000000001'),  -- owner
  ('b5e33000-0000-4000-8000-000000000002'),  -- sales
  ('b5e33000-0000-4000-8000-000000000003');  -- customer

insert into public.profiles (id, full_name, role) values
  ('b5e33000-0000-4000-8000-000000000001', 'E3 Owner', 'owner'),
  ('b5e33000-0000-4000-8000-000000000002', 'E3 Sales', 'sales'),
  ('b5e33000-0000-4000-8000-000000000003', 'E3 Customer', 'customer');

insert into public.products (id, slug, type, title_en, moq, stock_mode, status) values
  ('b5e30000-0000-4000-8000-000000000001', 'e3-tracked', 'buy_now', 'E3 tracked bag', 5, 'tracked', 'published'),
  ('b5e30000-0000-4000-8000-000000000002', 'e3-mto', 'buy_now', 'E3 made to order bag', 5, 'made_to_order', 'published'),
  ('b5e30000-0000-4000-8000-000000000003', 'e3-low', 'buy_now', 'E3 low stock bag', 5, 'tracked', 'published');

insert into public.product_variants (id, product_id, sku, color_name, price_delta, stock_qty, reserved_qty, is_active) values
  ('b5e31000-0000-4000-8000-000000000001', 'b5e30000-0000-4000-8000-000000000001', 'E3-TRK', 'Black', 0, 1000, 0, true),
  ('b5e31000-0000-4000-8000-000000000002', 'b5e30000-0000-4000-8000-000000000002', 'E3-MTO', 'Black', 0, 0, 0, true),
  ('b5e31000-0000-4000-8000-000000000003', 'b5e30000-0000-4000-8000-000000000003', 'E3-LOW', 'Black', 0, 3, 0, true);

insert into public.price_tiers (product_id, min_qty, max_qty, unit_price) values
  ('b5e30000-0000-4000-8000-000000000001', 5, 50, 100),
  ('b5e30000-0000-4000-8000-000000000001', 51, null, 80),
  ('b5e30000-0000-4000-8000-000000000002', 5, null, 100),
  ('b5e30000-0000-4000-8000-000000000003', 5, null, 100);

insert into public.shipping_zones (id, name_en, fee, free_over, is_active) values
  ('b5e32000-0000-4000-8000-000000000001', 'E3 test zone', 50, 500, true);

-- --------------------------------------------------- access control: anon --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.admin_create_order('{
      "customer_name":"x","customer_phone":"01700000001","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-anon",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)$$,
  '42501', 'permission denied for function admin_create_order',
  'anon cannot execute admin_create_order'
);

-- ------------------------------------------------ access control: customer --
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.admin_create_order('{
      "customer_name":"x","customer_phone":"01700000001","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-customer",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)$$,
  'P0001', 'not_allowed',
  'a plain customer session is refused by admin_create_order'
);

-- ---------------------------------------------------------- sales: allowed --
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select ok(
  (select public.admin_create_order('{
      "customer_name":"Walk-in","customer_phone":"01700000002","channel":"walk_in",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-sales-ok",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)) like 'PBF-%',
  'sales can create a plain admin order'
);

select throws_ok(
  $$select public.admin_create_order('{
      "customer_name":"Walk-in","customer_phone":"01700000002","channel":"walk_in",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-sales-disc","discount":"50",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)$$,
  'P0001', 'override_not_allowed',
  'sales cannot apply a discount'
);

select throws_ok(
  $$select public.admin_create_order('{
      "customer_name":"Walk-in","customer_phone":"01700000002","channel":"walk_in",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-sales-ovr",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5,"unit_price_override":"90"}]
    }'::jsonb)$$,
  'P0001', 'override_not_allowed',
  'sales cannot override a unit price'
);

-- -------------------------------------------------- owner: create + columns --
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  (select public.admin_create_order('{
      "customer_name":"Phone order","customer_phone":"01700000009","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-owner-basic",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)) like 'PBF-%',
  'owner can create an admin order'
);

reset role;

select is(
  (select source::text from public.orders where idempotency_key = 'e3-owner-basic'),
  'admin',
  'an admin-created order carries source = admin'
);

select is(
  (select channel::text from public.orders where idempotency_key = 'e3-owner-basic'),
  'phone',
  'the chosen channel is stored on the order'
);

-- channel is required for an admin order
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.admin_create_order('{
      "customer_name":"No channel","customer_phone":"01700000009",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-no-channel",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)$$,
  'P0001', 'channel_required',
  'admin_create_order requires a channel'
);

-- ------------------------------------------- tier parity vs place_order (anon) --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select ok(
  public.place_order('{
    "customer_name":"Web","customer_phone":"01700000010",
    "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
    "idempotency_key":"e3-web-50",
    "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":50}]
  }'::jsonb) like 'PBF-%',
  'web order at quantity 50 is placed'
);

select ok(
  public.place_order('{
    "customer_name":"Web","customer_phone":"01700000010",
    "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
    "idempotency_key":"e3-web-51",
    "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":51}]
  }'::jsonb) like 'PBF-%',
  'web order at quantity 51 is placed'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  (select public.admin_create_order('{
      "customer_name":"Admin50","customer_phone":"01700000011","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-admin-50",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":50}]
    }'::jsonb)) like 'PBF-%',
  'admin order at quantity 50 is created'
);

select ok(
  (select public.admin_create_order('{
      "customer_name":"Admin51","customer_phone":"01700000011","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-admin-51",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":51}]
    }'::jsonb)) like 'PBF-%',
  'admin order at quantity 51 is created'
);

reset role;

select is(
  (select subtotal from public.orders where idempotency_key = 'e3-admin-50'),
  5000::numeric,
  'admin qty 50 prices at the 5-50 tier (5000)'
);

select is(
  (select subtotal from public.orders where idempotency_key = 'e3-admin-50'),
  (select subtotal from public.orders where idempotency_key = 'e3-web-50'),
  'admin and web pricing are identical at the 50 boundary'
);

select is(
  (select subtotal from public.orders where idempotency_key = 'e3-admin-51'),
  4080::numeric,
  'admin qty 51 crosses the tier boundary and prices at 80/unit (4080)'
);

select is(
  (select subtotal from public.orders where idempotency_key = 'e3-admin-51'),
  (select subtotal from public.orders where idempotency_key = 'e3-web-51'),
  'admin and web pricing are identical at the 51 boundary'
);

-- ------------------------------------------------------- MOQ + oversell --
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.admin_create_order('{
      "customer_name":"Low qty","customer_phone":"01700000011","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-moq",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":4}]
    }'::jsonb)$$,
  'P0001', 'Quantity below MOQ',
  'admin_create_order enforces the product MOQ'
);

select throws_ok(
  $$select public.admin_create_order('{
      "customer_name":"Over","customer_phone":"01700000011","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-oversell",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000003","qty":5}]
    }'::jsonb)$$,
  'P0001', 'Insufficient stock',
  'admin_create_order cannot oversell a tracked variant'
);

-- made_to_order is created without touching stock
select ok(
  (select public.admin_create_order('{
      "customer_name":"MTO","customer_phone":"01700000011","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-mto",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000002","qty":5}]
    }'::jsonb)) like 'PBF-%',
  'a made-to-order admin order is created'
);

reset role;

select is(
  (select reserved_qty from public.product_variants
    where id = 'b5e31000-0000-4000-8000-000000000002'),
  0,
  'made_to_order does not reserve stock'
);

select is(
  (select count(*)::integer from public.inventory_movements
    where variant_id = 'b5e31000-0000-4000-8000-000000000002'),
  0,
  'made_to_order writes no movement row'
);

-- -------------------------------------------- idempotency replay + audit --
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  (select public.admin_create_order('{
      "customer_name":"Twice","customer_phone":"01700000012","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-replay",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)),
  (select public.admin_create_order('{
      "customer_name":"Twice","customer_phone":"01700000012","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-replay",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)),
  'a replayed idempotency key returns the same order number'
);

reset role;

select is(
  (select count(*)::integer from public.orders where idempotency_key = 'e3-replay'),
  1,
  'a double submit yields exactly one order'
);

select is(
  (select count(*)::integer from public.audit_logs
    where action = 'admin_create_order'
      and record_id = (select id from public.orders where idempotency_key = 'e3-replay')),
  1,
  'the order writes exactly one audit_logs row (replay adds none)'
);

-- -------------------------------------------------------------- advance --
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  (select public.admin_create_order('{
      "customer_name":"Advance","customer_phone":"01700000013","channel":"whatsapp",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-advance",
      "advance_amount":"200","advance_method":"bkash_manual",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)) like 'PBF-%',
  'an admin order with an advance is created'
);

reset role;

select is(
  (select payment_status::text from public.orders where idempotency_key = 'e3-advance'),
  'partially_paid',
  'the advance flips the order to partially_paid'
);

select is(
  (select coalesce(sum(amount), 0) from public.payments
    where order_id = (select id from public.orders where idempotency_key = 'e3-advance')),
  200::numeric,
  'the advance lands in the payments ledger'
);

-- ------------------------------------------------- owner discount + override --
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b5e33000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  (select public.admin_create_order('{
      "customer_name":"Discount","customer_phone":"01700000014","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-discount","discount":"100","reason":"Loyal customer",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":10}]
    }'::jsonb)) like 'PBF-%',
  'owner can create a discounted admin order with a reason'
);

select ok(
  (select public.admin_create_order('{
      "customer_name":"Override","customer_phone":"01700000015","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-override","override_reason":"Damaged batch",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5,"unit_price_override":"90"}]
    }'::jsonb)) like 'PBF-%',
  'owner can create an order with a priced-overridden line'
);

select throws_ok(
  $$select public.admin_create_order('{
      "customer_name":"No reason","customer_phone":"01700000016","channel":"phone",
      "shipping_zone_id":"b5e32000-0000-4000-8000-000000000001",
      "idempotency_key":"e3-disc-noreason","discount":"100",
      "items":[{"variant_id":"b5e31000-0000-4000-8000-000000000001","qty":5}]
    }'::jsonb)$$,
  'P0001', 'reason_required',
  'a discount without a reason is rejected'
);

reset role;

select is(
  (select total from public.orders where idempotency_key = 'e3-discount'),
  900::numeric,
  'the discount is applied server-side (1000 subtotal - 100, free shipping)'
);

select is(
  (select count(*)::integer from public.order_status_history
    where order_id = (select id from public.orders where idempotency_key = 'e3-discount')),
  1,
  'a pricing change leaves one status-history reason row'
);

select is(
  (select unit_price from public.order_items
    where order_id = (select id from public.orders where idempotency_key = 'e3-override')),
  90::numeric,
  'the owner unit-price override is snapshotted on the line'
);

select * from finish();
rollback;
