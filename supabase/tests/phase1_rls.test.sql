create extension if not exists pgtap with schema extensions;

begin;

select plan(19);

insert into public.products (id, slug, title_en, status, moq, type)
values
  ('10000000-0000-4000-8000-000000000001', 'phase1-test-draft', 'Test draft', 'draft', 1, 'buy_now'),
  ('10000000-0000-4000-8000-000000000002', 'phase1-test-published', 'Test published bag', 'published', 5, 'buy_now'),
  ('10000000-0000-4000-8000-000000000003', 'phase1-test-quote-only', 'Test quote-only bag', 'published', 1, 'quote_only');

insert into public.categories (id, slug, name_en, is_active)
values ('40000000-0000-4000-8000-000000000001', 'phase1-test-category', 'Test category', true);

insert into public.collections (id, slug, name_en, is_active)
values ('50000000-0000-4000-8000-000000000001', 'phase1-test-collection', 'Test collection', true);

insert into public.swatch_groups (id, key, name_en, sort_order)
values ('60000000-0000-4000-8000-000000000001', 'phase1-test-group', 'Test group', 1);

insert into public.swatches (id, group_id, name_en, is_active)
values ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'Test swatch', true);

insert into public.product_categories (product_id, category_id)
values ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001');

insert into public.product_collections (product_id, collection_id)
values ('10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001');

insert into public.product_images (product_id, path)
values ('10000000-0000-4000-8000-000000000001', 'phase1/draft.webp');

insert into public.product_custom_parts (
  id, product_id, key, label_en, input_type
)
values (
  '80000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'draft-part',
  'Draft part',
  'swatch'
);

insert into public.product_part_swatches (part_id, swatch_id)
values (
  '80000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001'
);

insert into public.product_variants (
  id, product_id, sku, color_name, price_delta, stock_qty, reserved_qty, is_active
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'PHASE1-TEST-A', 'Black', 0, 4, 0, true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'PHASE1-TEST-B', 'Ivory', 10, 10, 0, true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'PHASE1-DRAFT-VARIANT', 'Draft', 0, 10, 0, true),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'PHASE1-QUOTE-ONLY', 'Quote only', 0, 10, 0, true);

insert into public.price_tiers (product_id, min_qty, max_qty, unit_price)
values
  ('10000000-0000-4000-8000-000000000002', 5, 10, 100),
  ('10000000-0000-4000-8000-000000000002', 11, null, 80),
  ('10000000-0000-4000-8000-000000000001', 1, null, 1);

insert into public.shipping_zones (id, name_en, fee, free_over, is_active)
values ('30000000-0000-4000-8000-000000000001', 'Phase 1 test zone', 50, 500, true);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::integer from public.products where slug = 'phase1-test-draft'),
  0,
  'anonymous users cannot read draft products'
);

select is(
  (select count(*)::integer from public.product_categories where product_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'anonymous users cannot read category links for draft products'
);

select is(
  (select count(*)::integer from public.product_collections where product_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'anonymous users cannot read collection links for draft products'
);

select is(
  (select count(*)::integer from public.product_images where product_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'anonymous users cannot read images for draft products'
);

select is(
  (select count(*)::integer from public.product_variants where sku = 'PHASE1-DRAFT-VARIANT'),
  0,
  'anonymous users cannot read variants for draft products'
);

select is(
  (select count(*)::integer from public.price_tiers where product_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'anonymous users cannot read price tiers for draft products'
);

select is(
  (select count(*)::integer from public.product_custom_parts where product_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'anonymous users cannot read customization parts for draft products'
);

select is(
  (select count(*)::integer from public.product_part_swatches where part_id = '80000000-0000-4000-8000-000000000001'),
  0,
  'anonymous users cannot read swatch assignments for draft products'
);

select is(
  (select count(*)::integer from public.swatch_groups where id = '60000000-0000-4000-8000-000000000001'),
  1,
  'anonymous users can read the public swatch group library'
);

select is(
  public.has_role(array['owner']::text[]),
  false,
  'has_role returns false for anonymous users without recursively failing RLS'
);

select throws_ok(
  $$select public.place_order(
    '{"customer_name":"Test customer","customer_phone":"01700000000",
      "shipping_zone_id":"30000000-0000-4000-8000-000000000001",
      "idempotency_key":"phase1-quote-only",
      "items":[{"variant_id":"20000000-0000-4000-8000-000000000004","qty":1}]}'
    ::jsonb
  )$$,
  'P0001',
  'Only buy-now products can be checked out',
  'quote-only products cannot be purchased through retail checkout'
);

select throws_ok(
  $$insert into public.orders (order_no, customer_name, customer_phone)
    values ('PBF-TEST-DIRECT', 'Test customer', '01700000000')$$,
  '42501',
  'new row violates row-level security policy for table "orders"',
  'anonymous users cannot insert orders directly'
);

select throws_ok(
  $$select public.place_order(
    '{"customer_name":"Test customer","customer_phone":"01700000000",
      "shipping_zone_id":"30000000-0000-4000-8000-000000000001",
      "idempotency_key":"phase1-oversell",
      "items":[{"variant_id":"20000000-0000-4000-8000-000000000001","qty":5}]}'
    ::jsonb
  )$$,
  'P0001',
  'Insufficient stock',
  'tracked variants cannot be oversold'
);

select ok(
  public.place_order(
    '{
      "customer_name":"Test customer",
      "customer_phone":"01700000000",
      "shipping_zone_id":"30000000-0000-4000-8000-000000000001",
      "shipping_fee":9999,
      "idempotency_key":"phase1-valid-order",
      "items":[
        {"variant_id":"20000000-0000-4000-8000-000000000001","qty":3,"unit_price":1},
        {"variant_id":"20000000-0000-4000-8000-000000000002","qty":2,"unit_price":1}
      ]
    }'::jsonb
  ) like 'PBF-%',
  'place_order accepts an order from anonymous checkout'
);

reset role;

select is(
  (select count(*)::integer from public.orders where idempotency_key = 'phase1-valid-order'),
  1,
  'place_order creates one order'
);

select is(
  public.place_order(
    '{
      "customer_name":"Test customer",
      "customer_phone":"01700000000",
      "shipping_zone_id":"30000000-0000-4000-8000-000000000001",
      "idempotency_key":"phase1-valid-order",
      "items":[
        {"variant_id":"20000000-0000-4000-8000-000000000001","qty":3},
        {"variant_id":"20000000-0000-4000-8000-000000000002","qty":2}
      ]
    }'::jsonb
  ),
  (select order_no from public.orders where idempotency_key = 'phase1-valid-order'),
  'retries with the same idempotency key return the original order'
);

select is(
  (select subtotal from public.orders where idempotency_key = 'phase1-valid-order'),
  520::numeric,
  'server recalculates quantity-tier and variant pricing'
);

select is(
  (select shipping_fee from public.orders where idempotency_key = 'phase1-valid-order'),
  0::numeric,
  'server calculates free shipping from the database threshold'
);

select is(
  (select sum(reserved_qty)::integer from public.product_variants where product_id = '10000000-0000-4000-8000-000000000002'),
  5,
  'tracked stock is reserved for the total order quantity'
);

select * from finish();
rollback;
