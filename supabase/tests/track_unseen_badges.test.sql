-- Unseen badges — mark_seen RPC + admin-created-seen trigger (pgTAP).
--
-- Proves the contract the sidebar badges rely on:
--   * `mark_seen` is staff-only: a customer session is refused inside the
--     definer (`not_allowed`), anon has no EXECUTE at all (42501);
--   * it stamps `first_viewed_at` for a quote and an order, is idempotent
--     (a second call keeps the original timestamp) and only ever writes when
--     the column is NULL — a row that already carries a value is untouched;
--   * an unknown kind is rejected and stamps nothing;
--   * the BEFORE INSERT trigger marks `source = 'admin'` orders seen at
--     creation (E3/F1 must never raise a badge) while `web` rows stay unseen.
-- Runs inside one rolled-back transaction, so it leaves no rows behind.

create extension if not exists pgtap with schema extensions;

begin;

select plan(11);

-- ---------------------------------------------------------------- fixture --
-- mark_seen → has_role → profiles → auth.users.
insert into auth.users (id) values
  ('eb000001-0000-4000-8000-000000000001'),
  ('eb000002-0000-4000-8000-000000000002');

insert into public.profiles (id, full_name, role) values
  ('eb000001-0000-4000-8000-000000000001', 'UB Sales',    'sales'),
  ('eb000002-0000-4000-8000-000000000002', 'UB Customer', 'customer');

-- Rows are inserted as the superuser (tests bypass RLS); the column default
-- keeps them unseen, exactly like a fresh storefront row.
insert into public.quote_requests (id, contact_name, phone, status)
values ('eb000100-0000-4000-8000-000000000100', 'UB Quote', '01700000100', 'new');

insert into public.orders (id, order_no, status, customer_name, customer_phone)
values ('eb000200-0000-4000-8000-000000000200', 'PBF-UB-0001', 'pending', 'UB Buyer', '01700000200');

-- ------------------------------------------------------- staff session ----
-- mark_seen is a definer but still demands a staff auth.uid(), so every call
-- below runs as a real sales session.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"eb000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select public.mark_seen('quote', 'eb000100-0000-4000-8000-000000000100'::uuid)$$,
  'a sales session may mark a quote seen'
);

select is(
  (select first_viewed_at is not null from public.quote_requests
    where id = 'eb000100-0000-4000-8000-000000000100'),
  true,
  'mark_seen(quote) stamps first_viewed_at'
);

select lives_ok(
  $$select public.mark_seen('order', 'eb000200-0000-4000-8000-000000000200'::uuid)$$,
  'a sales session may mark an order seen'
);

select is(
  (select first_viewed_at is not null from public.orders
    where id = 'eb000200-0000-4000-8000-000000000200'),
  true,
  'mark_seen(order) stamps first_viewed_at through the definer'
);

-- ----------------------------------------------------- idempotent, >= NULL ----
create temporary table ub_seen_before (ts timestamptz) on commit drop;
insert into ub_seen_before
  select first_viewed_at from public.quote_requests
  where id = 'eb000100-0000-4000-8000-000000000100';

select lives_ok(
  $$select public.mark_seen('quote', 'eb000100-0000-4000-8000-000000000100'::uuid)$$,
  'calling mark_seen again does not error (idempotent)'
);

select is(
  (select q.first_viewed_at from public.quote_requests q
    where q.id = 'eb000100-0000-4000-8000-000000000100'),
  (select ts from ub_seen_before),
  'the second call keeps the original timestamp (only sets when NULL)'
);

-- ------------------------------------------------------------ unknown kind ----
select throws_ok(
  $$select public.mark_seen('invoice', 'eb000100-0000-4000-8000-000000000100'::uuid)$$,
  null, 'unknown_kind',
  'an unknown kind is refused'
);

-- ------------------------------------------------------------ customer ----
select set_config('request.jwt.claims',
  '{"sub":"eb000002-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$select public.mark_seen('quote', 'eb000100-0000-4000-8000-000000000100'::uuid)$$,
  null, 'not_allowed',
  'a customer session cannot call mark_seen'
);

-- --------------------------------------------------------------- anon ----
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.mark_seen('quote', 'eb000100-0000-4000-8000-000000000100'::uuid)$$,
  '42501',
  'permission denied for function mark_seen',
  'anon has no EXECUTE on mark_seen'
);

-- ------------------------------------------------- admin-created: seen ----
reset role;
insert into public.orders (order_no, status, customer_name, customer_phone, source, channel)
values ('PBF-UB-0002', 'pending', 'UB Walk-in', '01700000300', 'admin', 'walk_in');

insert into public.orders (order_no, status, customer_name, customer_phone)
values ('PBF-UB-0003', 'pending', 'UB Web', '01700000400');

select is(
  (select first_viewed_at is not null from public.orders
    where order_no = 'PBF-UB-0002'),
  true,
  'an admin-created (E3/F1) order is born seen and never raises the badge'
);

select is(
  (select first_viewed_at is null from public.orders
    where order_no = 'PBF-UB-0003'),
  true,
  'a storefront (web) order stays unseen'
);

select * from finish();
rollback;
