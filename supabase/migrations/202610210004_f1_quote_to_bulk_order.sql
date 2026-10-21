-- Plan 15.2 F1 — convert a quote into a `bulk` order without duplicating the
-- order-creation logic (E3's `create_order_core` stays the single retail path).
--
-- 1. The two bits of shared machinery `create_order_core` owns — the per-request
--    idempotency advisory lock and the daily order-number allocator — are pulled
--    into internal `security definer` helpers. `create_order_core` is then
--    rewritten to call them, byte-for-byte preserving the retail/web/admin
--    behaviour (the E3/phase1/phase5 suites still pass unchanged).
-- 2. `create_order_bulk(p_payload)` is a NEW staff-only creator for negotiated,
--    made-to-order bulk lines: a per-line unit_price the admin agreed, an
--    optional explicit line_total, a nullable variant, and NO stock reservation
--    or inventory movement. It reuses the same idempotency + order-number
--    helpers so numbering and replays behave exactly like a retail order.
-- 3. `convert_quote_to_order(p_quote_id, p_payload)` is the F1 entry point: it
--    reads the quote server-side, is convert-once idempotent (a quote that
--    already spawned an order returns it), requires a quoted amount, builds one
--    bulk line whose subtotal equals `quoted_amount` exactly, links the order via
--    `source_quote_id`, flips the quote to `won` and writes ONE audit_logs row.
--    New-order notifications fire automatically through the C1 orders trigger.

-- ------------------------------------------------ internal: idempotency --
-- Take the same per-request advisory lock `create_order_core` used inline and
-- return the id of the order that already carries this idempotency key (null on
-- a first attempt). Byte-identical to the block it replaces.
create or replace function public.order_idempotency_lookup(p_request_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('order:' || p_request_key, 0)
  );

  select o.id into existing_id
    from public.orders as o
    where o.idempotency_key = p_request_key;

  return existing_id;
end;
$$;

-- ------------------------------------------------- internal: order number --
-- Take the daily order-number advisory lock and allocate the next
-- PBF-YYMMDD-NNNN. Byte-identical to the block it replaces in the core.
create or replace function public.reserve_next_order_no()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_no integer;
begin
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

  return 'PBF-' || to_char(current_date, 'YYMMDD') || '-' || lpad(next_no::text, 4, '0');
end;
$$;

-- ------------------------------------------- create_order_core (refactored) --
-- Returns the created (or replayed) order id. `p_admin = false` reproduces the
-- old `place_order` exactly; `p_admin = true` reads the staff-only fields. Only
-- the idempotency + numbering blocks changed (now delegated to the helpers).
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

  existing_id := public.order_idempotency_lookup(request_key);
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

  order_no := public.reserve_next_order_no();

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

-- ------------------------------------------------------- create_order_bulk --
-- Staff-only (owner/manager) creator for negotiated bulk / made-to-order lines.
-- A bulk line carries an agreed unit_price and (optionally) an explicit
-- line_total so a quote's per-order `quoted_amount` is preserved to the cent;
-- the variant is optional; stock is never checked, reserved or moved. Reuses the
-- shared idempotency + order-number helpers so numbering/replays match retail.
create or replace function public.create_order_bulk(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item             jsonb;
  order_subtotal   numeric(12, 2) := 0;
  shipping_fee     numeric(12, 2) := 0;
  order_total      numeric(12, 2);
  v_discount       numeric(12, 2) := 0;
  v_status         public.order_status;
  v_channel        public.order_channel;
  order_id         uuid;
  order_no         text;
  request_key      text;
  existing_id      uuid;
  shipping_zone_id uuid;
  v_title          text;
  v_qty            integer;
  v_unit_price     numeric(12, 2);
  v_line_total     numeric(12, 2);
begin
  if not public.has_role(array['owner', 'manager']) then
    raise exception 'not_allowed';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid bulk order payload';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array'
    or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'Bulk order requires at least one line';
  end if;

  if coalesce(nullif(btrim(p_payload->>'customer_name'), ''), '') = ''
    or coalesce(nullif(btrim(p_payload->>'customer_phone'), ''), '') = '' then
    raise exception 'Customer name and phone are required';
  end if;

  request_key := nullif(btrim(p_payload->>'idempotency_key'), '');
  if request_key is null or length(request_key) > 128 then
    raise exception 'A valid idempotency key is required';
  end if;

  existing_id := public.order_idempotency_lookup(request_key);
  if existing_id is not null then
    return existing_id;
  end if;

  v_status := coalesce(nullif(p_payload->>'status', ''), 'confirmed')::public.order_status;
  if v_status not in ('pending', 'confirmed') then
    raise exception 'Bulk orders start as pending or confirmed';
  end if;

  -- Bulk orders are always staff-created (source 'admin'), so the
  -- `orders_admin_channel_required` check demands a channel.
  v_channel := nullif(btrim(p_payload->>'channel'), '')::public.order_channel;
  if v_channel is null then
    raise exception 'channel_required';
  end if;

  v_discount := coalesce(nullif(p_payload->>'discount', '')::numeric, 0);
  if v_discount < 0 then
    raise exception 'Discount cannot be negative';
  end if;

  -- Validate + total the lines. A negotiated unit_price is mandatory; an
  -- explicit line_total lets the caller pin the exact order subtotal.
  for item in select value from jsonb_array_elements(p_payload->'items') loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Each bulk line must be an object';
    end if;
    if nullif(btrim(coalesce(item->>'title', '')), '') is null then
      raise exception 'Each bulk line requires a title';
    end if;
    v_qty := coalesce((item->>'qty')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Each bulk line requires a positive quantity';
    end if;
    v_unit_price := nullif(item->>'unit_price', '')::numeric;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'Each bulk line requires a negotiated unit_price';
    end if;
    v_line_total := coalesce(nullif(item->>'line_total', '')::numeric, v_unit_price * v_qty);
    if v_line_total < 0 then
      raise exception 'Line total cannot be negative';
    end if;
    order_subtotal := order_subtotal + v_line_total;
  end loop;

  if v_discount > order_subtotal then
    raise exception 'Discount exceeds subtotal';
  end if;

  -- Bulk shipping is optional: quoted amounts are negotiated per-order and may
  -- already include delivery. When a zone is supplied it must be active.
  shipping_zone_id := nullif(p_payload->>'shipping_zone_id', '')::uuid;
  if shipping_zone_id is not null then
    select case
      when z.free_over is not null and order_subtotal >= z.free_over then 0
      else z.fee
    end into shipping_fee
      from public.shipping_zones as z
      where z.id = shipping_zone_id and z.is_active = true;
    if not found then
      raise exception 'Shipping zone not found or inactive';
    end if;
  else
    shipping_fee := 0;
  end if;

  order_total := order_subtotal - v_discount + shipping_fee;

  order_no := public.reserve_next_order_no();

  insert into public.orders (
    order_no, type, status, payment_method, payment_status,
    source, channel,
    customer_name, customer_phone, customer_email,
    division, district, area, address_line,
    shipping_zone_id, subtotal, shipping_fee, discount, total,
    customer_note, admin_note, source_quote_id, idempotency_key
  )
  values (
    order_no, 'bulk', v_status, 'cod', 'unpaid',
    'admin', v_channel,
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
    nullif(p_payload->>'source_quote_id', '')::uuid,
    request_key
  )
  returning id into order_id;

  for item in select value from jsonb_array_elements(p_payload->'items') loop
    v_qty := (item->>'qty')::integer;
    v_unit_price := (item->>'unit_price')::numeric;
    v_line_total := coalesce(nullif(item->>'line_total', '')::numeric, v_unit_price * v_qty);

    insert into public.order_items (
      order_id, variant_id, title_snapshot, sku_snapshot, color_snapshot,
      size_snapshot, unit_price, qty, line_total, customization
    )
    values (
      order_id,
      nullif(item->>'variant_id', '')::uuid,
      btrim(item->>'title'),
      nullif(btrim(coalesce(item->>'sku', '')), ''),
      nullif(btrim(coalesce(item->>'color', '')), ''),
      nullif(btrim(coalesce(item->>'size', '')), ''),
      v_unit_price, v_qty, v_line_total,
      nullif(item->'customization', 'null'::jsonb)
    );
  end loop;

  return order_id;
end;
$$;

-- --------------------------------------------------- convert_quote_to_order --
-- The F1 entry point. Convert-once: a quote that already spawned an order
-- returns that order. Builds one bulk line whose subtotal equals the negotiated
-- `quoted_amount` exactly, links it via `source_quote_id`, marks the quote `won`
-- and writes a single audit_logs row. Runs as definer (bypasses RLS), so the
-- role check is enforced here; the notifications trigger fires on the insert.
create or replace function public.convert_quote_to_order(
  p_quote_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q              record;
  v_order_id     uuid;
  v_existing     uuid;
  v_qty          integer;
  v_unit_price   numeric(12, 2);
  v_channel      text;
  v_title        text;
  v_bulk         jsonb;
begin
  if not public.has_role(array['owner', 'manager']) then
    raise exception 'not_allowed';
  end if;

  -- Serialize conversions of the same quote so a double click cannot make two
  -- orders or two audit rows even before the idempotency key is committed.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote-convert:' || p_quote_id::text, 0)
  );

  select * into q
    from public.quote_requests
    where id = p_quote_id;

  if q.id is null then
    raise exception 'quote_not_found';
  end if;

  -- Convert once: an order already linked to this quote wins outright.
  select o.id into v_existing
    from public.orders as o
    where o.source_quote_id = p_quote_id
    limit 1;

  if v_existing is not null then
    if q.status <> 'won' then
      update public.quote_requests
        set status = 'won', updated_at = now()
        where id = p_quote_id;
    end if;
    return v_existing;
  end if;

  if q.quoted_amount is null then
    raise exception 'quote_not_priced';
  end if;

  v_qty := coalesce(nullif(q.quantity, 0), 1);
  v_unit_price := round(q.quoted_amount / v_qty, 2);

  -- Title snapshot: catalog product if linked, else the requesting company.
  select nullif(btrim(p.title_en), '') into v_title
    from public.products as p
    where p.id = q.product_id;
  if v_title is null then
    v_title := coalesce(
      nullif(btrim(coalesce(q.company_name, '')), ''),
      nullif(btrim(q.contact_name), ''),
      'Custom bulk order'
    );
  end if;

  v_channel := nullif(btrim(coalesce(p_payload->>'channel', '')), '');
  if v_channel is null then
    v_channel := 'other';
  end if;

  v_bulk := jsonb_build_object(
    'idempotency_key', 'quote-convert:' || p_quote_id::text,
    'customer_name', coalesce(nullif(btrim(coalesce(q.company_name, '')), ''), btrim(q.contact_name)),
    'customer_phone', btrim(q.phone),
    'customer_email', nullif(btrim(coalesce(q.email, '')), ''),
    'status', coalesce(nullif(p_payload->>'status', ''), 'confirmed'),
    'channel', v_channel,
    'shipping_zone_id', nullif(p_payload->>'shipping_zone_id', ''),
    'customer_note', nullif(btrim(coalesce(q.message, '')), ''),
    'admin_note', 'Converted from quote ' || left(q.id::text, 8),
    'source_quote_id', p_quote_id,
    'items', jsonb_build_array(
      jsonb_build_object(
        'title', v_title,
        'qty', v_qty,
        'unit_price', v_unit_price,
        'line_total', q.quoted_amount,
        'customization', q.customization
      )
    )
  );

  v_order_id := public.create_order_bulk(v_bulk);

  update public.quote_requests
    set status = 'won', updated_at = now()
    where id = p_quote_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, diff)
  values (
    auth.uid(),
    'quote.convert_to_order',
    'orders',
    v_order_id,
    jsonb_build_object(
      'quote_id', p_quote_id,
      'quoted_amount', q.quoted_amount,
      'quantity', v_qty,
      'channel', v_channel
    )
  );

  return v_order_id;
end;
$$;

-- -------------------------------------------------------------- grants --
-- The two shared helpers and the bulk creator are internal-only: no request
-- role may call them directly (the entry points re-check the staff role inside).
revoke all on function public.order_idempotency_lookup(text) from public, anon, authenticated;
revoke all on function public.reserve_next_order_no() from public, anon, authenticated;
revoke all on function public.create_order_bulk(jsonb) from public, anon;
revoke all on function public.convert_quote_to_order(uuid, jsonb) from public, anon;

-- Staff reach the two new entry points through the Postgres role; the functions
-- themselves refuse anything but owner/manager via has_role().
grant execute on function public.create_order_bulk(jsonb) to authenticated;
grant execute on function public.convert_quote_to_order(uuid, jsonb) to authenticated;
