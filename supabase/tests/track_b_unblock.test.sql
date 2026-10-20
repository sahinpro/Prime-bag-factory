-- Plan 15.2 B4b — pgTAP for `admin_unblock_contact`.
--
-- Proves the contract the /admin/blocked-contacts page relies on: the delete
-- and its audit trail commit together, only owner/manager can run it (sales
-- may READ the list but must not unblock), a missing or already-removed row
-- raises `block_not_found`, and a rejected call leaves no audit row behind.

create extension if not exists pgtap with schema extensions;

begin;

select plan(15);

-- ------------------------------------------------------------ fixtures ----
insert into auth.users (id) values
  ('b6400001-0000-4000-8000-000000000001'), -- owner
  ('b6400002-0000-4000-8000-000000000001'), -- sales
  ('b6400003-0000-4000-8000-000000000001'); -- customer

insert into public.profiles (id, full_name, role) values
  ('b6400001-0000-4000-8000-000000000001', 'B4b Owner', 'owner'),
  ('b6400002-0000-4000-8000-000000000001', 'B4b Sales', 'sales'),
  ('b6400003-0000-4000-8000-000000000001', 'B4b Customer', 'customer');

insert into public.blocked_contacts (id, type, value, reason, created_by)
values (
  'b6400009-0000-4000-8000-000000000001',
  'phone',
  '01700000099',
  'Blocked from order PBF-TEST-0001',
  'b6400001-0000-4000-8000-000000000001'
);

-- ------------------------------------------------------------- shape ------
select has_function('public', 'admin_unblock_contact', 'the audited unblock RPC exists');

select ok(
  (select prosecdef from pg_proc
    where oid = 'public.admin_unblock_contact(uuid)'::regprocedure),
  'admin_unblock_contact is security definer'
);

select is(
  (select array_to_string(proconfig, '|') from pg_proc
    where oid = 'public.admin_unblock_contact(uuid)'::regprocedure),
  'search_path=""',
  'admin_unblock_contact pins search_path to empty'
);

-- ------------------------------------------------------------- grants -----
set local role anon;
select throws_ok(
  $$select public.admin_unblock_contact('b6400009-0000-4000-8000-000000000001')$$,
  '42501',
  'permission denied for function admin_unblock_contact',
  'anon cannot execute the unblock RPC'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"b6400003-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.admin_unblock_contact('b6400009-0000-4000-8000-000000000001')$$,
  'P0001', 'not_allowed',
  'a customer session is refused by the in-function role check'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"b6400002-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.admin_unblock_contact('b6400009-0000-4000-8000-000000000001')$$,
  'P0001', 'not_allowed',
  'sales may read the blocklist but cannot unblock (owner/manager only)'
);

-- ------------------------------------------------- owner: delete + audit --
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b6400001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.admin_unblock_contact('b6400009-0000-4000-8000-000000000001')$$,
  'owner unblocks an existing entry'
);

reset role;

select is(
  (select count(*)::integer from public.blocked_contacts
    where id = 'b6400009-0000-4000-8000-000000000001'),
  0,
  'the blocked_contacts row is gone'
);

select is(
  (select count(*)::integer from public.audit_logs
    where action = 'unblock' and record_id = 'b6400009-0000-4000-8000-000000000001'),
  1,
  'exactly one audit trail row was written'
);

select is(
  (select table_name from public.audit_logs
    where action = 'unblock' and record_id = 'b6400009-0000-4000-8000-000000000001'),
  'blocked_contacts',
  'the audit row names the table'
);

select is(
  (select actor_id::text from public.audit_logs
    where action = 'unblock' and record_id = 'b6400009-0000-4000-8000-000000000001'),
  'b6400001-0000-4000-8000-000000000001',
  'the audit row records WHO unblocked'
);

select is(
  (select diff ->> 'value' from public.audit_logs
    where action = 'unblock' and record_id = 'b6400009-0000-4000-8000-000000000001'),
  '01700000099',
  'the audit diff carries the removed phone value'
);

select is(
  (select diff ->> 'type' from public.audit_logs
    where action = 'unblock' and record_id = 'b6400009-0000-4000-8000-000000000001'),
  'phone',
  'the audit diff carries the entry type'
);

-- --------------------------------------------- gone rows leave no trail ---
select set_config('request.jwt.claims',
  '{"sub":"b6400001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.admin_unblock_contact('b6400009-0000-4000-8000-000000000001')$$,
  'P0001', 'block_not_found',
  'double-unblock the same id answers block_not_found'
);

reset role;

select is(
  (select count(*)::integer from public.audit_logs
    where action = 'unblock' and record_id = 'b6400009-0000-4000-8000-000000000001'),
  1,
  'the refused second call wrote no extra audit row'
);

select * from finish();
rollback;
