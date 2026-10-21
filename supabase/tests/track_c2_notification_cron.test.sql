-- Plan 15.2 C1 (revised) — pgTAP for the pg_cron-driven notification sender.
--
-- Proves the trigger moved off Vercel Cron onto a scheduled pg_net request
-- without touching the worker: function shape and grants, the blank-by-default
-- config (so local/CI never fire a bogus request), the anon/authenticated
-- refusals, the pg_cron job being scheduled exactly once at */5, and that a
-- configured target enqueues a request (or skips cleanly where pg_net is
-- absent). Runs inside one rolled-back transaction, so the backdated settings
-- and the enqueued request never leak.

create extension if not exists pgtap with schema extensions;

begin;

select plan(10);

-- ------------------------------------------------------------- function shape --
select has_function('public', 'request_notification_delivery', array[]::text[],
  'the notification-cron request function exists');

select ok(
  (select prosecdef from pg_proc
    where oid = 'public.request_notification_delivery()'::regprocedure),
  'request_notification_delivery is security definer'
);

select is(
  (select array_to_string(proconfig, '|') from pg_proc
    where oid = 'public.request_notification_delivery()'::regprocedure),
  'search_path=""',
  'request_notification_delivery pins search_path to empty'
);

-- ---------------------------------------------------------------- config --
select is(
  (select value ->> 'url' from public.settings where key = 'notification_cron'),
  '',
  'notification_cron ships with a blank url (disabled by default)'
);

select is(public.request_notification_delivery(), 0,
  'an unconfigured target is a clean no-op (returns 0, fires no request)');

-- ------------------------------------------------------------------ grants --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.request_notification_delivery()$$,
  '42501',
  'permission denied for function request_notification_delivery',
  'anon cannot execute the request function'
);

select set_config('request.jwt.claims',
  '{"sub":"c2000001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.request_notification_delivery()$$,
  '42501',
  'permission denied for function request_notification_delivery',
  'a signed-in staff session still cannot execute it — only cron/service_role may'
);

reset role;

-- ---------------------------------------------------------------- pg_cron --
select is(
  (select count(*)::integer from cron.job where jobname = 'send-order-notification-emails'),
  1,
  'the migration scheduled the pg_cron job exactly once'
);

select is(
  (select schedule from cron.job where jobname = 'send-order-notification-emails'),
  '*/5 * * * *',
  'the sender runs every 5 minutes (cadence preserved without Vercel Pro)'
);

-- ------------------------------------------------------- configured fires --
update public.settings
  set value = '{"url": "https://app.test/api/cron/send-notifications", "secret": "s3cr3t"}'::jsonb
  where key = 'notification_cron';

select is(
  public.request_notification_delivery(),
  (case when exists(
     select 1
       from pg_proc p
       join pg_depend d on d.objid = p.oid and d.deptype = 'e'
       join pg_extension e on e.oid = d.refobjid
      where e.extname = 'pg_net' and p.proname = 'http_get'
  ) then 1 else 0 end)::integer,
  'a configured target enqueues one request when pg_net is present (else skips cleanly)'
);

select * from finish();
rollback;
