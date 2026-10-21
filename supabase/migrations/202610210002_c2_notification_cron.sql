-- Plan 15.2 C1 (revised 2026-10-21) — schedule the order-email sender from
-- pg_cron instead of Vercel Cron.
--
-- Why: the Vercel Hobby plan rejects a cron that fires more than once a day,
-- so the original `*/5 * * * *` entry in `vercel.json` blocked every deploy.
-- The sender itself is unchanged — `GET /api/cron/send-notifications` (Bearer
-- `CRON_SECRET`) still runs the outbox worker (`claim_pending_emails` +
-- Resend). Only the *trigger* moves: a pg_cron job (every 5 minutes) uses
-- pg_net to fire an HTTP GET at that route with the bearer header. This is the
-- same scheduler already trusted for `prune-rate-limits` (B1) and
-- `release-expired-pending-orders` (B8), so the frequent cadence survives on
-- the free tier without duplicating the worker into a second runtime.
--
-- Safe by default: the target URL and the shared secret live in a
-- `settings.notification_cron` row, seeded blank. A blank url or secret makes
-- the job a no-op, so local and CI (where no app is deployed and no Resend key
-- exists) never issue a bogus request — mirroring the "no key → skip" rule the
-- worker already follows. The owner fills both in on the live project (the url
-- is the deployed app's cron route; the secret must equal Vercel's
-- `CRON_SECRET`). The secret is low-privilege: it only triggers an idempotent,
-- capped mail worker and is stored in an admin-RLS-scoped settings row.

-- ------------------------------------------------------------------ config --
insert into public.settings (key, value)
values ('notification_cron', '{"url": "", "secret": ""}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- function --
-- Fire one outbox-drain request at the app. Returns 1 when a request was
-- enqueued, 0 when the job is unconfigured or pg_net is unavailable (skip).
--
-- pg_net's schema is not portable: hosted Supabase installs it in `net`, a
-- fresh local install picks the current schema (usually `public`). Rather than
-- hard-code the qualifier we resolve pg_net's own `http_get` at runtime.
create or replace function public.request_notification_delivery()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
  v_schema text;
begin
  select nullif(btrim(s.value ->> 'url'), ''),
         nullif(btrim(s.value ->> 'secret'), '')
    into v_url, v_secret
    from public.settings as s
   where s.key = 'notification_cron';

  -- Unconfigured (fresh local/CI) → nothing to do.
  if v_url is null or v_secret is null then
    return 0;
  end if;

  select n.nspname
    into v_schema
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid
   where e.extname = 'pg_net'
     and p.proname = 'http_get'
   limit 1;

  -- pg_net missing (plain Postgres) → the job stays scheduled but inert.
  if v_schema is null then
    return 0;
  end if;

  execute format(
    'select %I.http_get($1, ''{}''::jsonb, $2::jsonb)', v_schema
  ) using v_url, jsonb_build_object('Authorization', 'Bearer ' || v_secret);

  return 1;
end;
$$;

-- Machine plumbing, not an admin RPC: anon/authenticated are refused; the
-- pg_cron job runs the body as the migration owner (postgres), and
-- service_role may call it for a manual trigger.
revoke all on function public.request_notification_delivery()
  from public, anon, authenticated;
grant execute on function public.request_notification_delivery()
  to service_role;

-- ---------------------------------------------------------------- pg_cron --
-- Best effort, exactly like B1/B8: create the extensions only if the image
-- provides them, and never hard-fail where they are unavailable.
do $$
begin
  create extension if not exists pg_cron with schema cron;
exception when others then
  raise notice 'notification_cron: pg_cron unavailable (%); delivery must be triggered externally', sqlerrm;
end $$;

do $$
begin
  -- Let pg_net pick its own schema (hosted → `net`, fresh local → `public`);
  -- `with schema net` fails because the extension must own the schema it
  -- installs into. The request function resolves the qualifier at runtime.
  create extension if not exists pg_net;
exception when others then
  raise notice 'notification_cron: pg_net unavailable (%); the scheduled request is inert', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Re-runnable: drop a previous copy of the job before scheduling.
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'send-order-notification-emails';

    perform cron.schedule(
      'send-order-notification-emails',
      '*/5 * * * *',
      $job$select public.request_notification_delivery();$job$
    );
  end if;
exception when others then
  raise notice 'notification_cron: could not schedule pg_cron job (%)', sqlerrm;
end $$;
