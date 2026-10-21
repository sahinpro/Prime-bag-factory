-- Plan 15.2 F2 — production status + artwork approval for bulk/custom orders.
--
-- `production_status` was a free-text column since Phase 1. Plan §7 (schema
-- line for `orders`) wants a strict, nullable enum that only applies to
-- bulk/custom work: awaiting_artwork | artwork_approved | in_production | qc |
-- ready. This migration
--   1. introduces the enum and converts the column,
--   2. keeps the "bulk only" rule in the database (a retail order can never
--      carry a production status), and
--   3. adds `admin_set_production_status` — a staff-only, `security definer`
--      function that enforces the allowed transitions server-side, writes the
--      audit row and enqueues the admin-bell notification in the same
--      transaction (mirrors `admin_set_order_status` + the C1 outbox).
--
-- The function is the ONLY write path for the column: adjacency forward or
-- back one step, `null -> awaiting_artwork` to open production. Because it
-- writes its own `audit_logs` row, the app action must NOT also call
-- `logAudit` (see server/audit.ts).

-- 1. Enum -------------------------------------------------------------------
create type public.production_status as enum (
  'awaiting_artwork',
  'artwork_approved',
  'in_production',
  'qc',
  'ready'
);

-- 2. Convert the column text -> enum. Any legacy value that is not one of the
--    five labels (or null) collapses to null so the cast can never fail a
--    reset on a database that already carries free-text.
alter table public.orders
  alter column production_status set default null;

update public.orders
  set production_status = null
  where production_status is not null
    and production_status not in (
      'awaiting_artwork', 'artwork_approved', 'in_production', 'qc', 'ready'
    );

alter table public.orders
  alter column production_status type public.production_status
  using production_status::public.production_status;

-- 3. Production status is a bulk/custom-only concern (plan §7).
alter table public.orders
  drop constraint if exists orders_production_status_bulk_only;

alter table public.orders
  add constraint orders_production_status_bulk_only
  check (production_status is null or type = 'bulk');

-- 4. Staff-only transition function ----------------------------------------
create or replace function public.admin_set_production_status(
  p_order_id uuid,
  p_to_status public.production_status,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.orders%rowtype;
  v_from    public.production_status;
  v_steps   public.production_status[] :=
    array['awaiting_artwork', 'artwork_approved', 'in_production', 'qc', 'ready'];
  v_from_pos integer;
  v_to_pos   integer;
begin
  if not public.has_role(array['owner', 'manager', 'sales']) then
    raise exception 'not_allowed';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- Production tracking belongs to bulk/custom work only.
  if v_order.type <> 'bulk' then
    raise exception 'production_not_applicable';
  end if;

  v_from := v_order.production_status;

  -- Re-applying the current status is a no-op, not a second history/notification.
  if v_from = p_to_status then
    return v_order.order_no;
  end if;

  v_to_pos := array_position(v_steps, p_to_status);

  if v_from is null then
    -- Opening production is always the first stage.
    if v_to_pos <> 1 then
      raise exception 'invalid_production_transition';
    end if;
  else
    v_from_pos := array_position(v_steps, v_from);
    -- Move one stage forward or back only; never skip.
    if abs(v_to_pos - v_from_pos) <> 1 then
      raise exception 'invalid_production_transition';
    end if;
  end if;

  update public.orders
    set production_status = p_to_status,
        updated_at = now()
    where id = p_order_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, diff)
  values (
    auth.uid(),
    'order.production_status',
    'orders',
    p_order_id,
    jsonb_build_object(
      'from_status', v_from,
      'to_status', p_to_status,
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );

  -- Admin bell (plan 15.2 C1 outbox). Never carries a phone or address.
  insert into public.notifications (channel, recipient, template, payload, status, attempts)
  values (
    'admin_alert',
    'admin',
    'production_status',
    jsonb_build_object(
      'order_id', v_order.id,
      'order_no', v_order.order_no,
      'customer_name', v_order.customer_name,
      'production_status', p_to_status
    ),
    'pending',
    0
  );

  return v_order.order_no;
end;
$$;

revoke all on function public.admin_set_production_status(uuid, public.production_status, text) from public, anon;
grant execute on function public.admin_set_production_status(uuid, public.production_status, text) to authenticated;
