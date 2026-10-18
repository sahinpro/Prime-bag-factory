-- Phase 5 task 3 — admin order fulfilment.
--
-- Two staff-only, `security definer` functions so a status change and the stock
-- effects it implies (plan §7 "Stock lifecycle") land in one transaction, and so a
-- `sales` user (who has no RLS right to write `product_variants`) can still ship
-- and cancel. Both re-check the role through `has_role()` because RLS is bypassed
-- by the definer; the app layer additionally gates with `requireRole()`.
--
-- Money is never taken from the client: `admin_record_payment` reads `total` from
-- the row and derives `payment_status` from the ledger sum.

create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item  record;
  v_mode  public.product_stock_mode;
  v_from  public.order_status;
begin
  if not public.has_role(array['owner', 'manager', 'sales']) then
    raise exception 'not_allowed';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order_not_found';
  end if;

  v_from := v_order.status;

  -- Re-applying the current status is a no-op, not a second stock movement.
  if v_from = p_to_status then
    return v_order.order_no;
  end if;

  if p_to_status = 'cancelled'
    and v_order.status in ('shipped', 'delivered', 'returned') then
    raise exception 'cannot_cancel_after_shipment';
  end if;

  if p_to_status = 'returned' and v_order.status <> 'delivered' then
    raise exception 'cannot_return_before_delivery';
  end if;

  for v_item in
    select oi.variant_id, oi.qty
    from public.order_items as oi
    where oi.order_id = p_order_id
      and oi.variant_id is not null
  loop
    select p.stock_mode into v_mode
    from public.product_variants as v
    join public.products as p on p.id = v.product_id
    where v.id = v_item.variant_id;

    if v_mode is distinct from 'tracked' then
      continue;
    end if;

    if p_to_status = 'shipped' then
      -- The reservation becomes a real sale.
      update public.product_variants
        set stock_qty = greatest(0, stock_qty - v_item.qty),
            reserved_qty = greatest(0, reserved_qty - v_item.qty)
        where id = v_item.variant_id;

      insert into public.inventory_movements (
        variant_id, delta, reason, ref_type, ref_id, note, created_by
      )
      values (
        v_item.variant_id,
        -v_item.qty,
        'sale',
        'order',
        v_order.order_no,
        'Shipped stock for order',
        auth.uid()
      );
    elsif p_to_status = 'cancelled' then
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
        'Released stock for cancelled order',
        auth.uid()
      );
    elsif p_to_status = 'returned' then
      update public.product_variants
        set stock_qty = stock_qty + v_item.qty
        where id = v_item.variant_id;

      insert into public.inventory_movements (
        variant_id, delta, reason, ref_type, ref_id, note, created_by
      )
      values (
        v_item.variant_id,
        v_item.qty,
        'return',
        'order',
        v_order.order_no,
        'Returned stock to inventory',
        auth.uid()
      );
    end if;
  end loop;

  update public.orders
    set status = p_to_status,
        shipped_at = case
          when p_to_status = 'shipped' and shipped_at is null then now()
          else shipped_at
        end,
        delivered_at = case
          when p_to_status = 'delivered' and delivered_at is null then now()
          else delivered_at
        end,
        updated_at = now()
    where id = p_order_id;

  insert into public.order_status_history (
    order_id, from_status, to_status, note, changed_by
  )
  values (
    p_order_id,
    v_from,
    p_to_status,
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  );

  return v_order.order_no;
end;
$$;

create or replace function public.admin_record_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_reference text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.orders%rowtype;
  v_paid    numeric;
  v_new     numeric;
  v_status  public.payment_status;
  v_payment public.payments%rowtype;
begin
  if not public.has_role(array['owner', 'manager', 'sales']) then
    raise exception 'not_allowed';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'order_not_found';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where order_id = p_order_id;

  if v_paid + p_amount > v_order.total + 0.005 then
    raise exception 'payment_exceeds_balance';
  end if;

  insert into public.payments (
    order_id, amount, method, reference, received_at, recorded_by, note
  )
  values (
    p_order_id,
    p_amount,
    p_method,
    nullif(trim(coalesce(p_reference, '')), ''),
    now(),
    auth.uid(),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning * into v_payment;

  v_new := v_paid + p_amount;
  v_status := case
    when v_new >= v_order.total - 0.005 then 'paid'::public.payment_status
    else 'partially_paid'::public.payment_status
  end;

  update public.orders
    set payment_status = v_status,
        updated_at = now()
    where id = p_order_id;

  return v_payment.id;
end;
$$;

revoke all on function public.admin_set_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.admin_record_payment(uuid, numeric, public.payment_method, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.admin_record_payment(uuid, numeric, public.payment_method, text, text) to authenticated;
