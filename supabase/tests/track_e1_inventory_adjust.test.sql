-- Plan 15.2 E1 — admin_adjust_stock pgTAP tests.
--
-- Proves the one write path for stock_qty end to end: function shape and
-- grants, the role gate (owner/manager/inventory yes, sales/customer/anon no),
-- the manual-only reason rule (sale / cancel_release belong to the order
-- RPCs), the zero-delta and blank-note guards, oversell protection that
-- leaves the ledger untouched, and a successful adjustment writing exactly
-- one movement row with the actor stamped from auth.uid(). Runs inside one
-- rolled-back transaction.

create extension if not exists pgtap with schema extensions;

begin;

select plan(29);

-- ---------------------------------------------------------------- fixture --
-- Every actor needs an auth.users row (movements.created_by FKs point at
-- profiles, which point at auth.users) and a profile with the right role.
insert into auth.users (id) values
  ('e1300001-0000-4000-8000-000000000001'),
  ('e1300002-0000-4000-8000-000000000002'),
  ('e1300003-0000-4000-8000-000000000003'),
  ('e1300004-0000-4000-8000-000000000004'),
  ('e1300005-0000-4000-8000-000000000005');

insert into public.profiles (id, full_name, role) values
  ('e1300001-0000-4000-8000-000000000001', 'E1 Owner',    'owner'),
  ('e1300002-0000-4000-8000-000000000002', 'E1 Manager',  'manager'),
  ('e1300003-0000-4000-8000-000000000003', 'E1 Stock',    'inventory'),
  ('e1300004-0000-4000-8000-000000000004', 'E1 Sales',    'sales'),
  ('e1300005-0000-4000-8000-000000000005', 'E1 Customer', 'customer');

insert into public.products (id, slug, type, title_en, moq, stock_mode, status) values
  ('e1000001-0000-4000-8000-000000000001', 'e1-adjusted', 'buy_now', 'E1 adjusted bag', 5, 'tracked', 'published');

insert into public.product_variants (id, product_id, sku, color_name, price_delta, stock_qty, reserved_qty, is_active) values
  ('e1100001-0000-4000-8000-000000000001', 'e1000001-0000-4000-8000-000000000001', 'E1-ADJ-V1', 'Black', 0, 200, 0, true),
  ('e1100002-0000-4000-8000-000000000002', 'e1000001-0000-4000-8000-000000000001', 'E1-ADJ-V2', 'Red',   0,  10, 0, true);

-- ------------------------------------------------------------ function shape --
select has_function(
  'public', 'admin_adjust_stock',
  array['uuid', 'integer', 'public.movement_reason', 'text'],
  'admin_adjust_stock exists with the (variant, delta, reason, note) shape'
);

select ok(
  (select prosecdef from pg_proc
    where oid = 'public.admin_adjust_stock(uuid, integer, public.movement_reason, text)'::regprocedure),
  'admin_adjust_stock is security definer — it writes stock past RLS on purpose'
);

select is(
  (select array_to_string(proconfig, '|') from pg_proc
    where oid = 'public.admin_adjust_stock(uuid, integer, public.movement_reason, text)'::regprocedure),
  'search_path=""',
  'admin_adjust_stock pins search_path to empty'
);

-- ------------------------------------------------------------------- grants --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', 10, 'adjustment', 'anon probe')$$,
  '42501',
  'permission denied for function admin_adjust_stock',
  'anon cannot execute admin_adjust_stock at all'
);

select set_config('request.jwt.claims',
  '{"sub":"e1300005-0000-4000-8000-000000000005","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', 10, 'adjustment', 'customer probe')$$,
  'P0001', 'not_allowed',
  'a plain customer session is refused by the in-function role check'
);

-- ------------------------------------------------- validation (as the owner) --
select set_config('request.jwt.claims',
  '{"sub":"e1300001-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', -5, 'sale', 'trying to fake a sale')$$,
  'P0001', 'invalid_reason',
  'manual adjustments may not impersonate the order-driven sale reason'
);

select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', 5, 'cancel_release', 'trying to fake a release')$$,
  'P0001', 'invalid_reason',
  'cancel_release belongs to admin_set_order_status, not the adjust form'
);

select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', 0, 'adjustment', 'zero delta')$$,
  'P0001', 'invalid_delta',
  'a zero delta writes a pointless ledger row and is rejected'
);

select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', 5, 'adjustment', '')$$,
  'P0001', 'note_required',
  'an empty note is refused — every movement needs a human why'
);

select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', 5, 'adjustment', '   ')$$,
  'P0001', 'note_required',
  'a whitespace-only note is refused too'
);

select throws_ok(
  $$select public.admin_adjust_stock(
    gen_random_uuid(), 5, 'adjustment', 'ghost variant')$$,
  'P0001', 'variant_not_found',
  'adjusting a variant that does not exist is refused'
);

-- ------------------------------------------------------------- happy path --
select is(
  public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', 40, 'purchase', ' restock from supplier '),
  240,
  'a +40 purchase on 200 stock returns the new quantity'
);

select is(
  (select stock_qty from public.product_variants
    where id = 'e1100001-0000-4000-8000-000000000001'),
  240,
  'the delta landed on stock_qty'
);

select is(
  (select count(*)::integer from public.inventory_movements
    where variant_id = 'e1100001-0000-4000-8000-000000000001'),
  1,
  'the adjustment wrote exactly one movement row'
);

select is(
  (select reason::text from public.inventory_movements
    where variant_id = 'e1100001-0000-4000-8000-000000000001'),
  'purchase',
  'the movement carries the chosen reason'
);

select is(
  (select delta from public.inventory_movements
    where variant_id = 'e1100001-0000-4000-8000-000000000001'),
  40,
  'the movement delta is the raw adjustment'
);

select is(
  (select ref_type from public.inventory_movements
    where variant_id = 'e1100001-0000-4000-8000-000000000001'),
  'manual',
  'manual adjustments are tagged ref_type = manual'
);

select ok(
  (select ref_id is null from public.inventory_movements
    where variant_id = 'e1100001-0000-4000-8000-000000000001'),
  'a manual movement has no order reference'
);

select is(
  (select note from public.inventory_movements
    where variant_id = 'e1100001-0000-4000-8000-000000000001'),
  'restock from supplier',
  'the note is stored trimmed'
);

select is(
  (select created_by from public.inventory_movements
    where variant_id = 'e1100001-0000-4000-8000-000000000001'),
  'e1300001-0000-4000-8000-000000000001'::uuid,
  'the actor is stamped from auth.uid(), not a client-supplied value'
);

-- ----------------------------------------------------------- oversell guard --
select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100001-0000-4000-8000-000000000001', -241, 'damage', 'push below zero')$$,
  'P0001', 'insufficient_stock',
  'an adjustment that would make stock negative is refused'
);

select is(
  (select stock_qty from public.product_variants
    where id = 'e1100001-0000-4000-8000-000000000001'),
  240,
  'the refused adjustment left stock untouched'
);

select is(
  (select count(*)::integer from public.inventory_movements
    where variant_id = 'e1100001-0000-4000-8000-000000000001'),
  1,
  'the refused adjustment wrote no ledger row'
);

-- ------------------------------------- the other manual reasons and staff --
select is(
  public.admin_adjust_stock(
    'e1100002-0000-4000-8000-000000000002', -5, 'damage', 'water damage batch'),
  5,
  'damage (negative) on the second variant succeeds'
);

select set_config('request.jwt.claims',
  '{"sub":"e1300003-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is(
  public.admin_adjust_stock(
    'e1100002-0000-4000-8000-000000000002', 3, 'opening', 'counted shelf'),
  8,
  'the inventory-role staff user can adjust with the opening reason'
);

select is(
  public.admin_adjust_stock(
    'e1100002-0000-4000-8000-000000000002', 1, 'return', 'customer handed one back'),
  9,
  'the return reason is allowed for manual adjustments'
);

select is(
  (select count(*)::integer from public.inventory_movements
    where variant_id = 'e1100002-0000-4000-8000-000000000002'),
  3,
  'each accepted adjustment on variant 2 left its own movement'
);

select set_config('request.jwt.claims',
  '{"sub":"e1300004-0000-4000-8000-000000000004","role":"authenticated"}', true);

select throws_ok(
  $$select public.admin_adjust_stock(
    'e1100002-0000-4000-8000-000000000002', 1, 'adjustment', 'sales probe')$$,
  'P0001', 'not_allowed',
  'the sales role is outside the owner/manager/inventory gate'
);

select set_config('request.jwt.claims',
  '{"sub":"e1300002-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is(
  public.admin_adjust_stock(
    'e1100002-0000-4000-8000-000000000002', -9, 'adjustment', 'write the sample shelf down'),
  0,
  'the manager role can adjust and stock may be taken exactly to zero'
);

select * from finish();
rollback;
