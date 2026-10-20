-- Plan 15.2 B8 — reservation expiry for stale pending orders.
--
-- Checkout reserves `reserved_qty` (phase 1 `place_order`); if the customer
-- never pays and staff never touch the order, that stock is held forever.
-- This adds the missing release valve:
--
--   * setting `pending_order_hold_hours` (jsonb `{"hours": 48}`), and
--   * `release_expired_pending_orders()`: cancels still-pending, still-unpaid
--     orders older than the hold, releasing stock with the exact same effects
--     as `admin_set_order_status(..., 'cancelled')` — `cancel_release`
--     movement per tracked line, one history row — with the actor set to
--     NULL, the system actor (a cron run has no `auth.uid()`).
--
-- Exactly-once: the pending → cancelled flip happens in the same transaction
-- as the movements, so the next run cannot select the order again; the scan
-- uses `for update ... skip locked` so a manual cancel racing the job is
-- simply left for that transaction to finish.
--
-- Grants replace any role check here: this is machine plumbing, not an admin
-- RPC. `authenticated`/`anon` are refused outright; `service_role` may call it
-- (e.g. a CRON_SECRET route fallback), and pg_cron runs the body as the
-- migration owner (`postgres`).

-- ------------------------------------------------------------------ setting --
insert into public.settings (key, value)
values ('pending_order_hold_hours', '{"hours": 48}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- function --
create or replace function public.release_expired_pending_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours integer;
  v_order record;
  v_item  record;
  v_mode  public.product_stock_mode;
  v_count integer := 0;
begin
  -- Tunable without a deploy; a missing or malformed row falls back to 48.
  select (s.value ->> 'hours')::integer into v_hours
  from public.settings as s
  where s.key = 'pending_order_hold_hours';
  if v_hours is null or v_hours < 1 then
    v_hours := 48;
  end if;

  for v_order in
    select o.id, o.order_no
    from public.orders as o
    where o.status = 'pending'
      and o.payment_status = 'unpaid'
      and o.created_at < now() - make_interval(hours => v_hours)
    for update of o skip locked
  loop
    for v_item in
      select oi.variant_id, oi.qty
      from public.order_items as oi
      where oi.order_id = v_order.id
        and oi.variant_id is not null
    loop
      select p.stock_mode into v_mode
      from public.product_variants as v
      join public.products as p on p.id = v.product_id
      where v.id = v_item.variant_id;

      -- Same rule as admin_set_order_status: only tracked lines move stock.
      if v_mode is distinct from 'tracked' then
        continue;
      end if;

      update public.product_variants
        set reserved_qty = greatest(0, reserved_qty - v_item.qty)
        where id = v_item.variant_id;

      insert into public.inventory_movements (
        variant_id, delta, reason, ref_type, ref_id, note, created_by
      )
      values (
        v_item.variant_id,
        v_item.qty,
        'cancel_release',
        'order',
        v_order.order_no,
        'Auto-released reservation: unpaid past hold',
        null -- system actor
      );
    end loop;

    update public.orders
      set status = 'cancelled',
          updated_at = now()
      where id = v_order.id;

    insert into public.order_status_history (
      order_id, from_status, to_status, note, changed_by
    )
    values (
      v_order.id,
      'pending',
      'cancelled',
      format('Auto-cancelled by system after %s h unpaid', v_hours),
      null -- system actor
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.release_expired_pending_orders() from public, anon, authenticated;
grant execute on function public.release_expired_pending_orders() to service_role;

-- ---------------------------------------------------------------- pg_cron --
-- Scheduled every 15 minutes. Best effort: if the image does not provide
-- pg_cron (plain Postgres in CI), the function above still ships and can be
-- run by a CRON_SECRET route; the job is created the moment it can be.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable (%); reservation expiry must be triggered externally', sqlerrm;
  return;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Re-runnable: drop a previous copy of the job before scheduling.
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'release-expired-pending-orders';

    perform cron.schedule(
      'release-expired-pending-orders',
      '*/15 * * * *',
      'select public.release_expired_pending_orders();'
    );
  end if;
end;
$$;
