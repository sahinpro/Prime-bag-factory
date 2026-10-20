-- Plan 15.2 E1 — inventory stock adjustment.
--
-- `stock_qty` is only ever changed through a movement (plan §7: "stock_qty is
-- only changed through movements, never by direct edit"), so an adjustment is
-- one security-definer function that writes the ledger row AND applies the
-- delta in the same transaction — the same rationale as the Phase 5 fulfilment
-- RPCs. `has_role()` is re-checked inside because the definer bypasses RLS; the
-- app layer additionally gates with `requireRole()`.
--
-- Manual adjustments may not impersonate the order-driven reasons (`sale`,
-- `cancel_release`) — those belong to `admin_set_order_status` / `place_order`.
-- A note is required so every movement carries a human "why".

create or replace function public.admin_adjust_stock(
  p_variant_id uuid,
  p_delta integer,
  p_reason public.movement_reason,
  p_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.product_variants%rowtype;
  v_new     integer;
begin
  if not public.has_role(array['owner', 'manager', 'inventory']) then
    raise exception 'not_allowed';
  end if;

  -- Only the manual reasons; sale / cancel_release are order-driven.
  if p_reason not in ('opening', 'purchase', 'return', 'adjustment', 'damage') then
    raise exception 'invalid_reason';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_delta';
  end if;

  if p_note is null or trim(p_note) = '' then
    raise exception 'note_required';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id;
  if not found then
    raise exception 'variant_not_found';
  end if;

  v_new := v_variant.stock_qty + p_delta;
  if v_new < 0 then
    raise exception 'insufficient_stock';
  end if;

  update public.product_variants
    set stock_qty = v_new
    where id = p_variant_id;

  insert into public.inventory_movements (
    variant_id, delta, reason, ref_type, ref_id, note, created_by
  )
  values (
    p_variant_id,
    p_delta,
    p_reason,
    'manual',
    null,
    trim(p_note),
    auth.uid()
  );

  return v_new;
end;
$$;

revoke all on function public.admin_adjust_stock(uuid, integer, public.movement_reason, text) from public, anon;
grant execute on function public.admin_adjust_stock(uuid, integer, public.movement_reason, text) to authenticated;
