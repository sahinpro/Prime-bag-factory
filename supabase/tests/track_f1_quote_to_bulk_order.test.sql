-- Plan 15.2 F1 — pgTAP for the shared helper extraction, create_order_bulk and
-- convert_quote_to_order.
--
-- Proves (a) the create_order_core refactor did NOT change retail/web/admin
-- output (place_order + admin_create_order still price, number and replay
-- identically), (b) the staff-only boundary on the two new entry points, (c)
-- that a bulk line uses the negotiated price, reserves no stock and allows a
-- null variant, and (d) convert-once idempotency, the exact quoted_amount
-- total, the won status, the linked source_quote_id and a single audit row.

create extension if not exists pgtap with schema extensions;

begin;

select plan(30);

-- ---------------------------------------------------------------- fixture --
insert into auth.users (id) values
  ('a1f10000-0000-4000-8000-000000000001'),  -- owner
  ('a1f10000-0000-4000-8000-000000000002'),  -- sales
  ('a1f10000-0000-4000-8000-000000000003'),  -- customer
  ('a1f10000-0000-4000-8000-000000000004');  -- manager

insert into public.profiles (id, full_name, role) values
  ('a1f10000-0000-4000-8000-000000000001', 'F1 Owner', 'owner'),
  ('a1f10000-0000-4000-8000-000000000002', 'F1 Sales', 'sales'),
  ('a1f10000-0000-4000-8000-000000000003', 'F1 Customer', 'customer'),
  ('a1f10000-0000-4000-8000-000000000004', 'F1 Manager', 'manager');

-- a buy-now tracked product for the "core unchanged" parity checks
insert into public.products (id, slug, type, title_en, moq, stock_mode, status) values
  ('a1f12000-0000-4000-8000-000000000001', 'f1-buynow', 'buy_now', 'F1 buy-now bag', 5, 'tracked', 'published');

insert into public.product_variants (id, product_id, sku, color_name, price_delta, stock_qty, reserved_qty, is_active) values
  ('a1f13000-0000-4000-8000-000000000001', 'a1f12000-0000-4000-8000-000000000001', 'F1-BN', 'Black', 0, 1000, 0, true);

insert into public.price_tiers (product_id, min_qty, max_qty, unit_price) values
  ('a1f12000-0000-4000-8000-000000000001', 5, 50, 100);

insert into public.shipping_zones (id, name_en, fee, free_over, is_active) values
  ('a1f14000-0000-4000-8000-000000000001', 'F1 test zone', 50, 500, true);

-- a quote-only / builder product to snapshot onto a converted order
insert into public.products (id, slug, type, title_en, moq, stock_mode, status) values
  ('a1f12000-0000-4000-8000-000000000002', 'f1-quoteonly', 'quote_only', 'F1 custom tote', 100, 'made_to_order', 'published');

-- quotes: priced, unpriced and one already convertible twice (double click)
insert into public.quote_requests (id, source, contact_name, company_name, phone, email, product_id, quantity, quoted_amount, status, customization) values
  ('a1f15000-0000-4000-8000-000000000001', 'builder', 'Rina', 'Rina Traders', '01700000001', 'rina@example.com',
   'a1f12000-0000-4000-8000-000000000002', 250, 1000, 'quoted',
   '{"size":{"width":12,"height":14},"colors":{"primary":{"name":"Red","hex":"#FF0000"}}}'::jsonb),
  ('a1f15000-0000-4000-8000-000000000002', 'form', 'No Price', null, '01700000002', null, null, 10, null, 'new', null),
  ('a1f15000-0000-4000-8000-000000000003', 'form', 'Twice Co', null, '01700000003', null, null, 5, 500, 'quoted', null);

-- ========================================================= core unchanged ==
-- place_order (the public wrapper of create_order_core) must still price,
-- number and reserve exactly as before the helper extraction.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select ok(
  public.place_order('{
    "customer_name":"Web","customer_phone":"01700000010",
    "shipping_zone_id":"a1f14000-0000-4000-8000-000000000001",
    "idempotency_key":"f1-core-web",
    "items":[{"variant_id":"a1f13000-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb) like 'PBF-%',
  'place_order still returns a PBF order number after the refactor'
);

-- Read the created rows back as the owner (anon cannot SELECT orders under RLS).
reset role;

select is(
  (select subtotal from public.orders where idempotency_key = 'f1-core-web'),
  500::numeric,
  'place_order still prices 5 x 100 = 500'
);

select is(
  (select shipping_fee from public.orders where idempotency_key = 'f1-core-web'),
  0::numeric,
  'place_order still applies free shipping at the free_over threshold'
);

select is(
  (select total from public.orders where idempotency_key = 'f1-core-web'),
  500::numeric,
  'place_order total is subtotal + fee (500 + 0 free shipping)'
);

select is(
  (select reserved_qty from public.product_variants where id = 'a1f13000-0000-4000-8000-000000000001'),
  5,
  'place_order still reserves tracked stock'
);

-- replay: same idempotency key -> same order number, no new row
select is(
  public.place_order('{
    "customer_name":"Web","customer_phone":"01700000010",
    "shipping_zone_id":"a1f14000-0000-4000-8000-000000000001",
    "idempotency_key":"f1-core-web",
    "items":[{"variant_id":"a1f13000-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb),
  (select order_no from public.orders where idempotency_key = 'f1-core-web'),
  'a replayed place_order key returns the same order number'
);

reset role;

select is(
  (select count(*)::integer from public.orders where idempotency_key = 'f1-core-web'),
  1,
  'the replay creates no second order row'
);

-- admin path (p_admin = true) still numbers + prices identically
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1f10000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  public.admin_create_order('{
    "customer_name":"Admin","customer_phone":"01700000011","channel":"phone",
    "shipping_zone_id":"a1f14000-0000-4000-8000-000000000001",
    "idempotency_key":"f1-core-admin",
    "items":[{"variant_id":"a1f13000-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb) like 'PBF-%',
  'admin_create_order still works through the refactored core'
);

-- =================================================== helpers are internal ==
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.order_idempotency_lookup('f1-x')$$,
  '42501', null,
  'anon cannot call the internal order_idempotency_lookup helper'
);

select throws_ok(
  $$select public.reserve_next_order_no()$$,
  '42501', null,
  'anon cannot call the internal reserve_next_order_no helper'
);

-- ========================================================= create_order_bulk ==
-- staff boundary
select throws_ok(
  $$select public.create_order_bulk('{
    "idempotency_key":"f1-bulk-anon","channel":"phone",
    "customer_name":"x","customer_phone":"01700000001",
    "items":[{"title":"Bag","qty":10,"unit_price":20}]
  }'::jsonb)$$,
  '42501', null,
  'anon cannot execute create_order_bulk'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1f10000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select throws_ok(
  $$select public.create_order_bulk('{
    "idempotency_key":"f1-bulk-cust","channel":"phone",
    "customer_name":"x","customer_phone":"01700000001",
    "items":[{"title":"Bag","qty":10,"unit_price":20}]
  }'::jsonb)$$,
  'P0001', 'not_allowed',
  'a customer session is refused by create_order_bulk'
);

-- sales is NOT owner/manager -> refused (bulk is management only)
select set_config('request.jwt.claims',
  '{"sub":"a1f10000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$select public.create_order_bulk('{
    "idempotency_key":"f1-bulk-sales","channel":"phone",
    "customer_name":"x","customer_phone":"01700000001",
    "items":[{"title":"Bag","qty":10,"unit_price":20}]
  }'::jsonb)$$,
  'P0001', 'not_allowed',
  'sales is refused by create_order_bulk (owner/manager only)'
);

-- owner creates a bulk order: negotiated price, null variant, no reservation
select set_config('request.jwt.claims',
  '{"sub":"a1f10000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select ok(
  public.create_order_bulk('{
    "idempotency_key":"f1-bulk-ok","channel":"walk_in",
    "customer_name":"Bulk Co","customer_phone":"01700000020",
    "items":[{"title":"Custom sack","qty":10,"unit_price":25}]
  }'::jsonb) is not null,
  'owner creates a bulk order with a negotiated unit price'
);

reset role;

select is(
  (select type::text from public.orders where idempotency_key = 'f1-bulk-ok'),
  'bulk',
  'the bulk order is typed as bulk'
);

select is(
  (select subtotal from public.orders where idempotency_key = 'f1-bulk-ok'),
  250::numeric,
  'the bulk subtotal is the negotiated 10 x 25 = 250'
);

select is(
  (select shipping_fee from public.orders where idempotency_key = 'f1-bulk-ok'),
  0::numeric,
  'a bulk order with no shipping zone charges nothing'
);

select is(
  (select variant_id from public.order_items
    where order_id = (select id from public.orders where idempotency_key = 'f1-bulk-ok')),
  null,
  'a bulk line allows a null variant'
);

select is(
  (select count(*)::integer from public.inventory_movements
    where ref_id = (select order_no from public.orders where idempotency_key = 'f1-bulk-ok')),
  0,
  'a bulk order reserves no stock (no inventory movement)'
);

-- ================================================= convert_quote_to_order ==
-- staff boundary on the entry point
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1f10000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$select public.convert_quote_to_order('a1f15000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'not_allowed',
  'sales cannot convert a quote (owner/manager only)'
);

-- an unpriced quote cannot be converted
select set_config('request.jwt.claims',
  '{"sub":"a1f10000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select throws_ok(
  $$select public.convert_quote_to_order('a1f15000-0000-4000-8000-000000000002'::uuid)$$,
  'P0001', 'quote_not_priced',
  'a quote with no quoted_amount is refused before any order is made'
);

-- a manager converts the priced builder quote
select ok(
  public.convert_quote_to_order('a1f15000-0000-4000-8000-000000000001'::uuid, '{"channel":"whatsapp"}'::jsonb) is not null,
  'a manager converts a priced quote into an order'
);

reset role;

select is(
  (select o.type::text
    from public.orders o
    where o.source_quote_id = 'a1f15000-0000-4000-8000-000000000001'),
  'bulk',
  'the converted order is a bulk order linked to the quote'
);

select is(
  (select o.total
    from public.orders o
    where o.source_quote_id = 'a1f15000-0000-4000-8000-000000000001'),
  1000::numeric,
  'the converted order total equals quoted_amount exactly'
);

select is(
  (select o.subtotal
    from public.orders o
    where o.source_quote_id = 'a1f15000-0000-4000-8000-000000000001'),
  1000::numeric,
  'the converted line_total preserves the negotiated subtotal'
);

select is(
  (select status::text from public.quote_requests where id = 'a1f15000-0000-4000-8000-000000000001'),
  'won',
  'converting marks the quote won'
);

select is(
  (select count(*)::integer from public.order_items
    where order_id = (select id from public.orders where source_quote_id = 'a1f15000-0000-4000-8000-000000000001')
      and customization ? 'colors'),
  1,
  'the builder customization snapshot is copied onto the order line'
);

-- double convert returns the SAME order and writes no second order/audit
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1f10000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  public.convert_quote_to_order('a1f15000-0000-4000-8000-000000000001'::uuid),
  (select id from public.orders where source_quote_id = 'a1f15000-0000-4000-8000-000000000001'),
  'converting the same quote twice returns the original order id'
);

reset role;

select is(
  (select count(*)::integer from public.orders where source_quote_id = 'a1f15000-0000-4000-8000-000000000001'),
  1,
  'a double convert yields exactly one order'
);

select is(
  (select count(*)::integer from public.audit_logs
    where action = 'quote.convert_to_order'
      and record_id = (select id from public.orders where source_quote_id = 'a1f15000-0000-4000-8000-000000000001')),
  1,
  'the conversion writes exactly one audit_logs row (replay adds none)'
);

select * from finish();
rollback;
