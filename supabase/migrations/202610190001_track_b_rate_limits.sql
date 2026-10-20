-- Plan 15.2 B1 — the rate-limit primitive for the abuse-protection track.
--
-- `rate_limits` has existed, unused, since Phase 1 (finding R3). This migration
-- reshapes it for fixed-window counters — one row per (key, window_start)
-- instead of one permanent row per key — and adds `check_rate_limit()`, a
-- SECURITY DEFINER function that only the service role may execute: limits are
-- enforced by server actions and route handlers (which use the admin client),
-- never by the browser.
--
-- Keys are defined by the caller (see B2: `checkout:phone:<normalized>`,
-- `lookup:ip:<hash>`, …). The window is a fixed bucket: now() rounded down to a
-- multiple of p_window_seconds, so counters reset on wall-clock boundaries and
-- a rotating window prunes that key's expired rows in passing. A pg_cron job
-- additionally sweeps the whole table every 15 minutes so abandoned keys cannot
-- accumulate; if pg_cron is unavailable the lazy rotation prune still bounds
-- active keys (decision logged).

-- 1) One row per key *per window*, not one row per key forever.
alter table public.rate_limits
  drop constraint if exists rate_limits_key_key;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rate_limits'::regclass
      and conname = 'rate_limits_key_window_start_key'
  ) then
    alter table public.rate_limits
      add constraint rate_limits_key_window_start_key unique (key, window_start);
  end if;
end $$;

-- 2) The counter itself. Every call consumes one unit of the current window and
--    reports whether the caller is still within p_limit.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if coalesce(p_key, '') = ''
    or coalesce(p_limit, 0) < 1
    or coalesce(p_window_seconds, 0) < 1 then
    raise exception 'invalid_rate_limit_args';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (key, window_start, count, updated_at)
  values (p_key, v_window, 1, now())
  on conflict on constraint rate_limits_key_window_start_key
  do update
    set count = public.rate_limits.count + 1,
        updated_at = now()
  returning count into v_count;

  -- Rotating into a fresh window drops this key's expired windows, so an
  -- actively used key never leaves more than one row behind.
  if v_count = 1 then
    delete from public.rate_limits
    where key = p_key
      and window_start < v_window;
  end if;

  return v_count <= p_limit;
end;
$$;

-- 3) Global sweep for stale windows, run by pg_cron every 15 minutes.
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits
  where window_start < now() - interval '1 day';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- 4) Lock the surface down: anon and authenticated must not see these at all;
--    only the server-side service role may call check_rate_limit. The prune is
--    called only by the cron job (which runs as the owner, postgres).
revoke all on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;

revoke all on function public.prune_rate_limits()
  from public, anon, authenticated, service_role;

do $$ begin
  -- Same layout as the Supabase dashboard toggle (schema `cron`, which CREATE
  -- EXTENSION ... WITH SCHEMA creates itself — pre-creating it is an error with
  -- pg_cron's script). Tolerate an environment where pg_cron cannot be enabled:
  -- the rotation prune above already bounds active keys, the sweep only
  -- reclaims abandoned ones.
  create extension if not exists pg_cron with schema cron;
exception when others then
  raise notice 'check_rate_limit: pg_cron unavailable (%), relying on rotation prune only', sqlerrm;
end $$;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Named schedule: re-running this migration updates the job, never duplicates it.
    perform cron.schedule(
      'prune-rate-limits',
      '*/15 * * * *',
      $job$select public.prune_rate_limits()$job$
    );
  end if;
exception when others then
  raise notice 'check_rate_limit: could not schedule pg_cron job (%), relying on rotation prune only', sqlerrm;
end $$;
