-- Plan 15.2 B1 — pgTAP for the rate-limit primitive (`check_rate_limit`).
--
-- Runs via `supabase test db` (pg_prove as postgres, one transaction, rolled
-- back). Covers: the (key, window_start) reshape, the fixed-window counter
-- itself (allowed up to the limit, rejected past it, isolated per key, one row
-- per window), expired-window pruning on rotation and by `prune_rate_limits`,
-- argument validation, SECURITY DEFINER + locked search_path, and the grants
-- (anon/authenticated get 42501 — only service_role may execute).

create extension if not exists pgtap with schema extensions;

begin;

select plan(19);

-- ------------------------------------------------------------ table shape --
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.rate_limits'::regclass
      and conname = 'rate_limits_key_window_start_key'
  ),
  'rate_limits has a unique (key, window_start) constraint'
);

select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rate_limits'::regclass
      and conname = 'rate_limits_key_key'
  ),
  'the old key-only unique constraint was dropped (windows need multiple rows)'
);

-- -------------------------------------------------------------- hardening --
select ok(
  (select prosecdef from pg_proc
    where oid = 'public.check_rate_limit(text, integer, integer)'::regprocedure),
  'check_rate_limit is security definer'
);

select is(
  (select array_to_string(proconfig, '|') from pg_proc
    where oid = 'public.check_rate_limit(text, integer, integer)'::regprocedure),
  'search_path=""',
  'check_rate_limit pins search_path to empty'
);

-- ------------------------------------------------------------- the counter --
-- limit 3 per window: calls 1-3 pass, call 4 is rejected (plan 15.2 "4th order
-- from one phone in an hour is rejected" with the B2 rule feeding these args).
select is(public.check_rate_limit('pgtap:counter', 3, 3600), true,  'call 1 of 3 is allowed');
select is(public.check_rate_limit('pgtap:counter', 3, 3600), true,  'call 2 of 3 is allowed');
select is(public.check_rate_limit('pgtap:counter', 3, 3600), true,  'call 3 of 3 is allowed');
select is(public.check_rate_limit('pgtap:counter', 3, 3600), false, 'call 4 past the limit is rejected');

select is(
  public.check_rate_limit('pgtap:other-key', 3, 3600),
  true,
  'a different key has its own counter'
);

select is(
  (select count(*)::integer from public.rate_limits where key = 'pgtap:counter'),
  1,
  'one window keeps exactly one counter row'
);

-- ---------------------------------------------------------------- pruning --
-- An expired window for the same key must neither block the new window nor
-- linger after rotation.
insert into public.rate_limits (key, window_start, count)
values (
  'pgtap:stale',
  to_timestamp(floor(extract(epoch from now()) / 3600) * 3600 - 7200),
  99
);

select is(public.check_rate_limit('pgtap:stale', 2, 3600), true, 'an expired window does not block the current one');

select is(
  (select count(*)::integer from public.rate_limits where key = 'pgtap:stale'),
  1,
  'rotating into a fresh window drops the expired row'
);

-- prune_rate_limits() drops abandoned keys that never rotate again.
insert into public.rate_limits (key, window_start, count)
values ('pgtap:abandoned', now() - interval '2 days', 1);

select ok(public.prune_rate_limits() >= 1, 'prune_rate_limits reports deleting the stale row');

select is(
  (select count(*)::integer from public.rate_limits where key = 'pgtap:abandoned'),
  0,
  'prune_rate_limits removed a window older than a day'
);

-- ------------------------------------------------------------- arg checks --
select throws_ok(
  $$select public.check_rate_limit('', 3, 3600)$$,
  'P0001', 'invalid_rate_limit_args',
  'an empty key is rejected'
);

select throws_ok(
  $$select public.check_rate_limit('pgtap:args', 0, 3600)$$,
  'P0001', 'invalid_rate_limit_args',
  'a limit below 1 is rejected'
);

select throws_ok(
  $$select public.check_rate_limit('pgtap:args', 3, 0)$$,
  'P0001', 'invalid_rate_limit_args',
  'a window below 1 second is rejected'
);

-- ---------------------------------------------------------------- grants ---
set local role anon;
select throws_ok(
  $$select public.check_rate_limit('pgtap:anon', 1, 60)$$,
  '42501',
  'permission denied for function check_rate_limit',
  'anon cannot execute check_rate_limit'
);

set local role authenticated;
select throws_ok(
  $$select public.check_rate_limit('pgtap:auth', 1, 60)$$,
  '42501',
  'permission denied for function check_rate_limit',
  'authenticated cannot execute check_rate_limit'
);

reset role;

select * from finish();
rollback;
