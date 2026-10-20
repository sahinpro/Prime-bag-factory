-- Plan 15.2 E3 — admin-created orders (phone, WhatsApp, walk-in).
--
-- The order-creation core of `place_order` (tier/MOQ/stock/numbering, the
-- advisory lock and the idempotency replay) is extracted into an internal
-- `security definer` function `create_order_core(p_payload, p_admin)`. BOTH the
-- public `place_order` and the new staff `admin_create_order` call it, so a
-- walk-in order is priced and reserved by exactly the same rules as a web order
-- and cannot drift. F1 (quote -> bulk order) reuses the same core.
--
-- `create_order_core` runs as the function owner (postgres), so a client must
-- never reach it directly: EXECUTE is revoked from anon/authenticated/public and
-- it is not granted to any request role. The two entry points keep the checks
-- that belong to their audience:
--   * `place_order` — unchanged signature and behaviour (public rate limits,
--     honeypot and idempotency-key generation stay in the app layer; the RPC
--     still enforces idempotency and reprices from the DB).
--   * `admin_create_order` — re-checks `has_role(['owner','manager','sales'])`
--     inside (the definer bypasses RLS), requires a channel, allows an initial
--     status and an optional advance, and writes an `audit_logs` row. Discount
--     and per-line unit-price override are owner/manager only, each needing a
--     reason. No public rate limits or `blocked_contacts` here (a staff walk-in
--     must be creatable for any phone; the UI warns when the number is blocked).

-- --------------------------------------------------------------- enums --
do $$ begin
  if not exists (select 1 from pg_type where typname = 'order_source') then
    create type public.order_source as enum ('web', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_channel') then
    create type public.order_channel as enum ('phone', 'whatsapp', 'facebook', 'walk_in', 'other');
  end if;
end $$;

-- -------------------------------------------------------------- columns --
alter table public.orders
  add column if not exists source public.order_source not null default 'web';
alter table public.orders
  add column if not exists channel public.order_channel;

-- `web` rows keep a null channel; an admin row must say how it came in.
alter table public.orders
  drop constraint if exists orders_admin_channel_required;
alter table public.orders
  add constraint orders_admin_channel_required
  check (source <> 'admin' or channel is not null);

create index if not exists idx_orders_source on public.orders(source);

-- ------------------------------------------------------- create_order_core --
-- Returns the created (or replayed) order id. `p_admin = false` reproduces the
-- old `place_order` exactly: status 'pending', source 'web', no discount, no
-- override, no history row. `p_admin = true` reads the staff-only fields.
create or replace function public.create_order_core(
  p_payload jsonb,
  p_admin boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item                jsonb;
  item_count          integer := 0;
  variant_count       integer := 0;
  locked_count        integer := 0;
  product_quantity    integer;
  order_subtotal      numeric(12, 2) := 0;
  shipping_fee        numeric(12, 2);
  order_total         numeric(12, 2);
  v_discount          numeric(12, 2) := 0;
  order_id            uuid;
  variant_id          uuid;
  quantity            integer;
  base_unit_price     numeric(12, 2);
  v_override          numeric(12, 2);
  v_effective         numeric(12, 2);
  order_no            text;
  next_no             integer;
  shipping_zone_id    uuid;
  request_key         text;
  existing_id         uuid;
  v_status            public.order_status;
  v_source            public.order_source;
  v_channel           public.order_channel;
  variant_row         record;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid checkout payload';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array'
    or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'Order items are required';
  end if;

  if coalesce(nullif(btrim(p_payload->>'customer_name'), ''), '') = ''
    or coalesce(nullif(btrim(p_payload->>'customer_phone'), ''), '') = '' then
    raise exception 'Customer name and phone are required';
  end if;

  if coalesce(p_payload->>'type', 'retail') <> 'retail' then
    raise exception 'Checkout only supports retail orders';
  end if;

  if coalesce(p_payload->>'payment_method', 'cod') <> 'cod' then
    raise exception 'Checkout only supports cash on delivery';
  end if;

  request_key := nullif(btrim(p_payload->>'idempotency_key'), '');
  if request_key is null or length(request_key) > 128 then
    raise exception 'A valid idempotency key is required';
  end if;

  -- Audience-derived fields. Public orders are always pending/web/no discount.
  if p_admin then
    v_status := coalesce(nullif(p_payload->>'status', ''), 'confirmed')::public.order_status;
    if v_status not in ('pending', 'confirmed') then
      raise exception 'Admin orders start as pending or confirmed';
    end if;
    v_source := 'admin';
    v_channel := nullif(btrim(p_payload->>'channel'), '')::public.order_channel;
    if v_channel is null then
      raise exception 'channel_required';
    end if;
    v_discount := coalesce(nullif(p_payload->>'discount', '')::numeric, 0);
    if v_discount < 0 then
      raise exception 'Discount cannot be negative';
    end if;
  else
    v_status := 'pending';
    v_source := 'web';
    v_channel := null;
    v_discount := 0;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('order:' || request_key, 0)
  );

  select o.id into existing_id
    from public.orders as o
    where o.idempotency_key = request_key;

  if existing_id is not null then
    return existing_id;
  end if;

  shipping_zone_id := nullif(p_payload->>'shipping_zone_id', '')::uuid;
  if shipping_zone_id is null then
    raise exception 'A shipping zone is required';
  end if;

  for item in
    select value from jsonb_array_elements(p_payload->'items')
  loop
    item_count := item_count + 1;
    if jsonb_typeof(item) <> 'object'
      or nullif(item->>'variant_id', '') is null
      or coalesce((item->>'qty')::integer, 0) <= 0 then
      raise exception 'Each item requires a valid variant_id and positive quantity';
    end if;
    if p_admin and nullif(item->>'unit_price_override', '') is not null then
      v_override := (item->>'unit_price_override')::numeric;
      if v_override < 0 then
        raise exception 'Price override cannot be negative';
      end if;
    end if;
  end loop;

  select count(distinct (requested.value->>'variant_id')::uuid)
    into variant_count
    from jsonb_array_elements(p_payload->'items') as requested(value);

  for variant_row in
    select
      v.id, v.product_id, v.stock_qty, v.reserved_qty, v.price_delta,
      p.moq, p.type, p.status, p.stock_mode
    from (
      select
        (requested.value->>'variant_id')::uuid as variant_id,
        sum((requested.value->>'qty')::integer)::integer as requested_quantity
      from jsonb_array_elements(p_payload->'items') as requested(value)
      group by (requested.value->>'variant_id')::uuid
    ) as requested
    join public.product_variants as v on v.id = requested.variant_id
    join public.products as p on p.id = v.product_id
    order by v.id
    for update of v
  loop
    locked_count := locked_count + 1;

    if variant_row.status <> 'published' then
      raise exception 'Variant product is not published';
    end if;

    if variant_row.type <> 'buy_now' then
      raise exception 'Only buy-now products can be checked out';
    end if;

    if not exists (
      select 1 from public.product_variants as v
      where v.id = variant_row.id and v.is_active = true
    ) then
      raise exception 'Variant not found';
    end if;

    select sum((requested.value->>'qty')::integer)::integer
      into product_quantity
      from jsonb_array_elements(p_payload->'items') as requested(value)
      join public.product_variants as v on v.id = (requested.value->>'variant_id')::uuid
      where v.product_id = variant_row.product_id;

    if product_quantity < variant_row.moq then
      raise exception 'Quantity below MOQ';
    end if;

    select t.unit_price into base_unit_price
      from public.price_tiers as t
      where t.product_id = variant_row.product_id
        and t.min_qty <= product_quantity
        and (t.max_qty is null or t.max_qty >= product_quantity)
      order by t.min_qty desc
      limit 1;

    if not found then
      raise exception 'No valid price tier for quantity';
    end if;

    if variant_row.stock_mode = 'tracked'
      and variant_row.stock_qty - variant_row.reserved_qty < (
        select sum((requested.value->>'qty')::integer)
        from jsonb_array_elements(p_payload->'items') as requested(value)
        where (requested.value->>'variant_id')::uuid = variant_row.id
      ) then
      raise exception 'Insufficient stock';
    end if;

    -- Staff price override wins when present (owner/manager only; the caller
    -- has already checked the role). Otherwise the tier price + variant delta.
    v_effective := base_unit_price + variant_row.price_delta;
    if p_admin then
      select (i.value->>'unit_price_override')::numeric into v_override
        from jsonb_array_elements(p_payload->'items') as i(value)
        where (i.value->>'variant_id')::uuid = variant_row.id
          and nullif(i.value->>'unit_price_override', '') is not null
        limit 1;
      if v_override is not null then
        v_effective := v_override;
      end if;
    end if;

    order_subtotal := order_subtotal + v_effective * (
      select sum((requested.value->>'qty')::integer)
      from jsonb_array_elements(p_payload->'items') as requested(value)
      where (requested.value->>'variant_id')::uuid = variant_row.id
    );
  end loop;

  if locked_count <> variant_count then
    raise exception 'Variant not found';
  end if;

  select case
    when z.free_over is not null and order_subtotal >= z.free_over then 0
    else z.fee
  end into shipping_fee
    from public.shipping_zones as z
    where z.id = shipping_zone_id and z.is_active = true;

  if not found then
    raise exception 'Shipping zone not found or inactive';
  end if;

  if v_discount > order_subtotal then
    raise exception 'Discount exceeds subtotal';
  end if;

  order_total := order_subtotal - v_discount + shipping_fee;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('order-number:' || current_date::text, 0)
  );

  select coalesce(max(right(o.order_no, 4)::integer), 0) + 1
    into next_no
    from public.orders as o
    where o.order_no like 'PBF-' || to_char(current_date, 'YYMMDD') || '-%';

  if next_no > 9999 then
    raise exception 'Daily order number limit reached';
  end if;

  order_no := 'PBF-' || to_char(current_date, 'YYMMDD') || '-' || lpad(next_no::text, 4, '0');

  insert into public.orders (
    order_no, type, status, payment_method, payment_status,
    source, channel,
    customer_name, customer_phone, customer_email,
    division, district, area, address_line,
    shipping_zone_id, subtotal, shipping_fee, discount, total,
    customer_note, admin_note, idempotency_key
  )
  values (
    order_no, 'retail', v_status, 'cod', 'unpaid',
    v_source, v_channel,
    btrim(p_payload->>'customer_name'),
    btrim(p_payload->>'customer_phone'),
    nullif(btrim(p_payload->>'customer_email'), ''),
    nullif(btrim(p_payload->>'division'), ''),
    nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'area'), ''),
    nullif(btrim(p_payload->>'address_line'), ''),
    shipping_zone_id, order_subtotal, shipping_fee, v_discount, order_total,
    nullif(btrim(p_payload->>'customer_note'), ''),
    nullif(btrim(p_payload->>'admin_note'), ''),
    request_key
  )
  returning id into order_id;

  for item in
    select value from jsonb_array_elements(p_payload->'items')
  loop
    variant_id := (item->>'variant_id')::uuid;
    quantity := (item->>'qty')::integer;

    select v.product_id, v.sku, v.color_name, v.size, v.price_delta,
           p.stock_mode, p.title_en
      into variant_row
      from public.product_variants as v
      join public.products as p on p.id = v.product_id
      where v.id = variant_id;

    select t.unit_price into base_unit_price
      from public.price_tiers as t
      where t.product_id = variant_row.product_id
        and t.min_qty <= public.product_quantity_for(p_payload, variant_row.product_id)
        and (t.max_qty is null or t.max_qty >= public.product_quantity_for(p_payload, variant_row.product_id))
      order by t.min_qty desc
      limit 1;

    v_effective := base_unit_price + variant_row.price_delta;
    if p_admin and nullif(item->>'unit_price_override', '') is not null then
      v_override := (item->>'unit_price_override')::numeric;
      if v_override is not null then
        v_effective := v_override;
      end if;
    end if;

    insert into public.order_items (
      order_id, variant_id, title_snapshot, sku_snapshot, color_snapshot,
      size_snapshot, unit_price, qty, line_total, tier_min_qty, customization
    )
    values (
      order_id, variant_id, variant_row.title_en, variant_row.sku,
      variant_row.color_name, variant_row.size,
      v_effective, quantity, v_effective * quantity,
      public.product_quantity_for(p_payload, variant_row.product_id),
      item->'customization'
    );

    if variant_row.stock_mode = 'tracked' then
      update public.product_variants
        set reserved_qty = reserved_qty + quantity
        where id = variant_id;

      insert into public.inventory_movements (
        variant_id, delta, reason, ref_type, ref_id, note, created_by
      )
      values (
        variant_id, -quantity, 'sale', 'order', order_no,
        'Reserved stock for order', case when p_admin then auth.uid() else null end
      );
    end if;
  end loop;

  return order_id;
end;
$$;

-- Product-level total quantity (the tier basis), shared by the line loop.
create or replace function public.product_quantity_for(
  p_payload jsonb,
  p_product_id uuid
)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum((requested.value->>'qty')::integer)::integer, 0)
    from jsonb_array_elements(p_payload->'items') as requested(value)
    join public.product_variants as v on v.id = (requested.value->>'variant_id')::uuid
    where v.product_id = p_product_id;
$$;

-- ---------------------------------------------------------- place_order --
-- Thin wrapper: unchanged signature/behaviour. Generates nothing new; the core
-- re-prices, reserves and replays by idempotency key. The order number is read
-- back from the id so a replay returns the same number as before.
create or replace function public.place_order(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_order_no text;
begin
  v_id := public.create_order_core(payload, false);
  select o.order_no into v_order_no from public.orders as o where o.id = v_id;
  return v_order_no;
end;
$$;

-- ---------------------------------------------------- admin_create_order --
create or replace function public.admin_create_order(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id      uuid;
  v_order_no      text;
  v_total         numeric(12, 2);
  v_status        public.order_status;
  v_discount      numeric(12, 2);
  v_advance       numeric(12, 2);
  v_advance_method public.payment_method;
  v_advance_ref   text;
  v_reason        text;
  v_note          text;
  v_channel       text;
  v_override_count integer;
begin
  if not public.has_role(array['owner', 'manager', 'sales']) then
    raise exception 'not_allowed';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Invalid order payload';
  end if;

  -- Channel is required for an admin order and must be a known value.
  v_channel := nullif(btrim(payload->>'channel'), '');
  if v_channel is null then
    raise exception 'channel_required';
  end if;
  if v_channel not in ('phone', 'whatsapp', 'facebook', 'walk_in', 'other') then
    raise exception 'channel_invalid';
  end if;

  -- Discount / unit-price override are owner/manager only, each needing a reason.
  v_discount := coalesce(nullif(payload->>'discount', '')::numeric, 0);
  select count(*) into v_override_count
    from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as i(value)
    where nullif(i.value->>'unit_price_override', '') is not null;

  if (v_discount > 0 or v_override_count > 0) then
    if not public.has_role(array['owner', 'manager']) then
      raise exception 'override_not_allowed';
    end if;
    v_reason := nullif(btrim(coalesce(payload->>'reason', '')), '');
    if v_discount > 0 and v_reason is null then
      raise exception 'reason_required';
    end if;
    if v_override_count > 0 and nullif(btrim(coalesce(payload->>'override_reason', '')), '') is null then
      raise exception 'reason_required';
    end if;
  end if;

  v_advance := coalesce(nullif(payload->>'advance_amount', '')::numeric, 0);
  if v_advance < 0 then
    raise exception 'invalid_amount';
  end if;
  v_advance_method := coalesce(nullif(payload->>'advance_method', ''), 'cash')::public.payment_method;

  -- Create the order through the shared core (same pricing/reservation rules as
  -- a web order), then read back the money and the staff-chosen status.
  v_order_id := public.create_order_core(payload, true);

  select order_no, total, status into v_order_no, v_total, v_status
    from public.orders where id = v_order_id;

  -- Optional advance through the same ledger rules as admin_record_payment.
  if v_advance > 0 then
    if v_advance > v_total + 0.005 then
      raise exception 'advance_exceeds_total';
    end if;
    insert into public.payments (
      order_id, amount, method, reference, received_at, recorded_by, note
    )
    values (
      v_order_id, v_advance, v_advance_method,
      nullif(btrim(coalesce(payload->>'advance_reference', '')), ''),
      now(), auth.uid(), 'Advance at order creation'
    );
    update public.orders
      set payment_status = case
        when v_advance >= v_total - 0.005 then 'paid'::public.payment_status
        else 'partially_paid'::public.payment_status
      end,
      updated_at = now()
      where id = v_order_id;
  end if;

  -- Human-readable reason for any staff-only pricing change, stored in the
  -- status history and mirrored into the admin note.
  v_note := nullif(btrim(coalesce(payload->>'admin_note', '')), '');
  if v_discount > 0 or v_override_count > 0 then
    v_reason := concat_ws('; ',
      case when v_discount > 0
        then 'Discount BDT ' || trim(to_char(v_discount, '9999999990.99')) || ' — ' ||
             nullif(btrim(coalesce(payload->>'reason', '')), '') end,
      case when v_override_count > 0
        then 'Unit-price override — ' ||
             nullif(btrim(coalesce(payload->>'override_reason', '')), '') end
    );
    v_note := nullif(concat_ws(' | ', v_note, v_reason), '');

    insert into public.order_status_history (
      order_id, from_status, to_status, note, changed_by
    )
    values (
      v_order_id, null, v_status,
      nullif(btrim(coalesce(v_reason, '')), ''), auth.uid()
    );

    update public.orders set admin_note = v_note where id = v_order_id;
  end if;

  -- Audit trail: actor, action and the order id (no PII beyond ids in `diff`).
  insert into public.audit_logs (actor_id, action, table_name, record_id, diff)
  values (
    auth.uid(),
    'admin_create_order',
    'orders',
    v_order_id,
    jsonb_build_object(
      'order_no', v_order_no,
      'channel', v_channel,
      'status', v_status,
      'discount', v_discount,
      'override_lines', v_override_count,
      'advance', v_advance,
      'total', v_total
    )
  );

  return v_order_no;
end;
$$;

-- -------------------------------------------------------------- grants --
-- The core is internal only: no request role may call it directly.
revoke all on function public.create_order_core(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.product_quantity_for(jsonb, uuid) from public, anon, authenticated;

-- place_order keeps its public grant (anon checkout still works).
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- admin_create_order is staff-only: authenticated (has_role re-checked inside).
revoke all on function public.admin_create_order(jsonb) from public, anon;
grant execute on function public.admin_create_order(jsonb) to authenticated;
