-- Plan 15.2 D1 — audit_logs is append-only for staff (pgTAP).
--
-- Proves the RLS contract the whole audit trail depends on:
--   * the owner/manager "manage all" policy from Phase 1 is gone;
--   * staff (owner/manager/sales/inventory) may INSERT a row whose actor is
--     themselves, and may NOT forge another actor;
--   * staff can neither UPDATE nor DELETE an audit row (0 rows affected — the
--     row survives), so history is tamper-evident;
--   * a customer or anon session cannot append to the log at all.
-- Runs inside one rolled-back transaction, so it leaves no rows behind.

create extension if not exists pgtap with schema extensions;

begin;

select plan(13);

-- ---------------------------------------------------------------- fixture --
-- actor_id references profiles(id), which references auth.users(id).
insert into auth.users (id) values
  ('d1300001-0000-4000-8000-000000000001'),
  ('d1300002-0000-4000-8000-000000000002'),
  ('d1300005-0000-4000-8000-000000000005');

insert into public.profiles (id, full_name, role) values
  ('d1300001-0000-4000-8000-000000000001', 'D1 Owner',    'owner'),
  ('d1300002-0000-4000-8000-000000000002', 'D1 Stock',    'inventory'),
  ('d1300005-0000-4000-8000-000000000005', 'D1 Customer', 'customer');

-- -------------------------------------------------------------- policies ----
-- Query pg_policies directly: the has_policy(cmd, comment) overload is ambiguous
-- with plain string literals, and the catalog is the ground truth anyway.
select ok(
  exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_logs'
      and policyname = 'Staff can append audit logs' and cmd = 'INSERT'),
  'the append-only staff insert policy exists'
);

select ok(
  exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_logs'
      and policyname = 'Management can read audit logs' and cmd = 'SELECT'),
  'the management read policy exists for the dashboard feed'
);

select ok(
  not exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_logs'
      and policyname = 'Management can manage audit logs'),
  'the old owner/manager manage-all policy (which allowed edits) is gone'
);

-- ------------------------------------------------- owner appends their own ----
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d1300001-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.audit_logs (actor_id, action, table_name, record_id, diff)
    values ('d1300001-0000-4000-8000-000000000001', 'd1.test', 'products',
            null, '{"ok":true}'::jsonb)$$,
  'an owner can append an audit row for themselves'
);

select is(
  (select count(*) from public.audit_logs
    where actor_id = 'd1300001-0000-4000-8000-000000000001' and action = 'd1.test'),
  1::bigint,
  'the audit row is actually written'
);

select throws_ok(
  $$insert into public.audit_logs (actor_id, action, table_name)
    values ('d1300002-0000-4000-8000-000000000002', 'd1.forge', 'products')$$,
  '42501',
  'new row violates row-level security policy for table "audit_logs"',
  'staff cannot forge an audit row attributed to a different actor'
);

-- ------------------------------------------------------- cannot rewrite it ----
select lives_ok(
  $$update public.audit_logs set action = 'rewritten'
    where actor_id = 'd1300001-0000-4000-8000-000000000001' and action = 'd1.test'$$,
  'an update statement runs without a hard error'
);

select is(
  (select count(*) from public.audit_logs
    where actor_id = 'd1300001-0000-4000-8000-000000000001' and action = 'rewritten'),
  0::bigint,
  'RLS: staff cannot rewrite an audit row (0 rows matched the update)'
);

-- --------------------------------------------------------- cannot delete ----
select lives_ok(
  $$delete from public.audit_logs
    where actor_id = 'd1300001-0000-4000-8000-000000000001' and action = 'd1.test'$$,
  'a delete statement runs without a hard error'
);

select is(
  (select count(*) from public.audit_logs
    where actor_id = 'd1300001-0000-4000-8000-000000000001' and action = 'd1.test'),
  1::bigint,
  'RLS: staff cannot delete an audit row (the row survives)'
);

-- ------------------------------------------------ inventory staff may add ----
select set_config('request.jwt.claims',
  '{"sub":"d1300002-0000-4000-8000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.audit_logs (actor_id, action, table_name)
    values ('d1300002-0000-4000-8000-000000000002', 'inventory.adjust', 'product_variants')$$,
  'an inventory-role staff member can append their own audit row'
);

-- ------------------------------------------------------ customer cannot ----
select set_config('request.jwt.claims',
  '{"sub":"d1300005-0000-4000-8000-000000000005","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.audit_logs (actor_id, action, table_name)
    values ('d1300005-0000-4000-8000-000000000005', 'x', 'products')$$,
  '42501',
  'new row violates row-level security policy for table "audit_logs"',
  'a customer session cannot append to the audit log'
);

-- ----------------------------------------------------------- anon cannot ----
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$insert into public.audit_logs (action, table_name) values ('x', 'products')$$,
  '42501',
  'new row violates row-level security policy for table "audit_logs"',
  'an anon request cannot append to the audit log'
);

select * from finish();
rollback;
