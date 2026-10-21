-- Plan 15.2 E2 — shipping zones RLS (pgTAP).
--
-- Proves the contract the checkout and the admin CRUD depend on:
--   * anonymous/public reads return ONLY active zones (an inactive zone is hidden
--     from the checkout dropdown);
--   * only owner/manager may create, update or delete a zone;
--   * a sales or inventory staff session, and a customer, cannot manage zones;
--   * a customer/anon cannot mutate at all (0 rows matched — no policy grants it).
-- The table, its "Public can read active shipping zones" (select) and
-- "Owner and manager can manage shipping zones" (for all) policies ship in Phase 1;
-- this test locks that behaviour in so the E2 admin page cannot regress it.
-- Runs inside one rolled-back transaction, so it leaves no rows behind.

create extension if not exists pgtap with schema extensions;

begin;

select plan(12);

-- ---------------------------------------------------------------- fixture --
insert into auth.users (id) values
  ('e2f00001-0000-4000-8000-000000000001'), -- owner
  ('e2f00002-0000-4000-8000-000000000002'), -- sales
  ('e2f00005-0000-4000-8000-000000000005'); -- customer

insert into public.profiles (id, full_name, role) values
  ('e2f00001-0000-4000-8000-000000000001', 'E2 Owner',    'owner'),
  ('e2f00002-0000-4000-8000-000000000002', 'E2 Sales',    'sales'),
  ('e2f00005-0000-4000-8000-000000000005', 'E2 Customer', 'customer');

-- One active and one inactive zone, inserted as the superuser (RLS bypassed here).
insert into public.shipping_zones (id, name_en, fee, free_over, is_active) values
  ('e2f000a1-0000-4000-8000-0000000000a1', 'E2 Active',   50.00, 1000.00, true),
  ('e2f000a2-0000-4000-8000-0000000000a2', 'E2 Inactive', 80.00, null,    false);

-- -------------------------------------------------------------- policies ----
select ok(
  exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shipping_zones'
      and policyname = 'Public can read active shipping zones' and cmd = 'SELECT'),
  'the public read-active policy exists for checkout'
);

select ok(
  exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shipping_zones'
      and policyname = 'Owner and manager can manage shipping zones' and cmd = 'ALL'),
  'the owner/manager manage policy exists'
);

-- ------------------------------------------------- anon sees only active ----
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from public.shipping_zones
    where id in ('e2f000a1-0000-4000-8000-0000000000a1',
                 'e2f000a2-0000-4000-8000-0000000000a2')),
  1::bigint,
  'anon can read the active zone but not the inactive one'
);

-- ----------------------------------------------------- customer cannot ----
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e2f00005-0000-4000-8000-000000000005","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.shipping_zones (name_en, fee) values ('Hijack', 10)$$,
  '42501',
  'new row violates row-level security policy for table "shipping_zones"',
  'a customer session cannot create a shipping zone'
);

select lives_ok(
  $$update public.shipping_zones set fee = 999
    where id = 'e2f000a1-0000-4000-8000-0000000000a1'$$,
  'a customer update runs without a hard error'
);

select is(
  (select fee from public.shipping_zones
    where id = 'e2f000a1-0000-4000-8000-0000000000a1'),
  50.00::numeric,
  'RLS: a customer cannot rewrite a zone fee (0 rows matched)'
);

-- ------------------------------------------------------ sales cannot ----
select set_config('request.jwt.claims',
  '{"sub":"e2f00002-0000-4000-8000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.shipping_zones (name_en, fee) values ('SalesZone', 10)$$,
  '42501',
  'new row violates row-level security policy for table "shipping_zones"',
  'a sales staff session cannot create a shipping zone (owner/manager only)'
);

-- ------------------------------------------------------ owner may CRUD ----
select set_config('request.jwt.claims',
  '{"sub":"e2f00001-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.shipping_zones (name_en, fee, free_over, is_active)
    values ('OwnerZone', 70, 1500, true)$$,
  'an owner can create a shipping zone'
);

select lives_ok(
  $$update public.shipping_zones set fee = 75
    where id = 'e2f000a1-0000-4000-8000-0000000000a1'$$,
  'an owner can update a shipping zone'
);

select is(
  (select fee from public.shipping_zones
    where id = 'e2f000a1-0000-4000-8000-0000000000a1'),
  75.00::numeric,
  'the owner update actually landed'
);

select lives_ok(
  $$delete from public.shipping_zones
    where id = 'e2f000a2-0000-4000-8000-0000000000a2'$$,
  'an owner can delete a shipping zone'
);

select ok(
  not exists (select 1 from public.shipping_zones
    where id = 'e2f000a2-0000-4000-8000-0000000000a2'),
  'the deleted zone is gone'
);

select * from finish();
rollback;
