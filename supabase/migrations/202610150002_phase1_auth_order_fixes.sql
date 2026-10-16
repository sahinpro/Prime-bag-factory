create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles as p
      where p.id = auth.uid()
        and p.role::text = any(roles)
    ),
    false
  );
$$;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles
for select
using (id = auth.uid());

create or replace function public.place_order(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  item_count integer := 0;
  variant_count integer := 0;
  locked_variant_count integer := 0;
  product_quantity integer;
  order_subtotal numeric(12, 2) := 0;
  shipping_fee numeric(12, 2);
  order_total numeric(12, 2);
  order_id uuid;
  variant_id uuid;
  quantity integer;
  base_unit_price numeric(12, 2);
  order_no text;
  next_no integer;
  shipping_zone_id uuid;
  request_idempotency_key text;
  existing_order_no text;
  variant_row record;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Invalid checkout payload';
  end if;

  if jsonb_typeof(payload->'items') <> 'array'
    or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Order items are required';
  end if;

  if coalesce(nullif(btrim(payload->>'customer_name'), ''), '') = ''
    or coalesce(nullif(btrim(payload->>'customer_phone'), ''), '') = '' then
    raise exception 'Customer name and phone are required';
  end if;

  if coalesce(payload->>'type', 'retail') <> 'retail' then
    raise exception 'Checkout only supports retail orders';
  end if;

  if coalesce(payload->>'payment_method', 'cod') <> 'cod' then
    raise exception 'Checkout only supports cash on delivery';
  end if;

  request_idempotency_key := nullif(btrim(payload->>'idempotency_key'), '');
  if request_idempotency_key is null or length(request_idempotency_key) > 128 then
    raise exception 'A valid idempotency key is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('order:' || request_idempotency_key, 0)
  );

  select o.order_no
    into existing_order_no
    from public.orders as o
    where o.idempotency_key = request_idempotency_key;

  if existing_order_no is not null then
    return existing_order_no;
  end if;

  shipping_zone_id := nullif(payload->>'shipping_zone_id', '')::uuid;
  if shipping_zone_id is null then
    raise exception 'A shipping zone is required';
  end if;

  for item in
    select value from jsonb_array_elements(payload->'items')
  loop
    item_count := item_count + 1;
    if jsonb_typeof(item) <> 'object'
      or nullif(item->>'variant_id', '') is null
      or coalesce((item->>'qty')::integer, 0) <= 0 then
      raise exception 'Each item requires a valid variant_id and positive quantity';
    end if;
  end loop;

  select count(distinct (requested.value->>'variant_id')::uuid)
    into variant_count
    from jsonb_array_elements(payload->'items') as requested(value);

  for variant_row in
    select
      v.id,
      v.product_id,
      v.stock_qty,
      v.reserved_qty,
      v.price_delta,
      p.moq,
      p.type,
      p.status,
      p.stock_mode
    from (
      select
        (requested.value->>'variant_id')::uuid as variant_id,
        sum((requested.value->>'qty')::integer)::integer as requested_quantity
      from jsonb_array_elements(payload->'items') as requested(value)
      group by (requested.value->>'variant_id')::uuid
    ) as requested
    join public.product_variants as v on v.id = requested.variant_id
    join public.products as p on p.id = v.product_id
    order by v.id
    for update of v
  loop
    locked_variant_count := locked_variant_count + 1;

    if variant_row.status <> 'published' then
      raise exception 'Variant product is not published';
    end if;

    if variant_row.type <> 'buy_now' then
      raise exception 'Only buy-now products can be checked out';
    end if;

    if not exists (
      select 1
      from public.product_variants as v
      where v.id = variant_row.id
        and v.is_active = true
    ) then
      raise exception 'Variant not found';
    end if;

    select sum((requested.value->>'qty')::integer)::integer
      into product_quantity
      from jsonb_array_elements(payload->'items') as requested(value)
      join public.product_variants as v
        on v.id = (requested.value->>'variant_id')::uuid
      where v.product_id = variant_row.product_id;

    if product_quantity < variant_row.moq then
      raise exception 'Quantity below MOQ';
    end if;

    select t.unit_price
      into base_unit_price
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
        from jsonb_array_elements(payload->'items') as requested(value)
        where (requested.value->>'variant_id')::uuid = variant_row.id
      ) then
      raise exception 'Insufficient stock';
    end if;

    order_subtotal := order_subtotal + (
      (base_unit_price + variant_row.price_delta) * (
        select sum((requested.value->>'qty')::integer)
        from jsonb_array_elements(payload->'items') as requested(value)
        where (requested.value->>'variant_id')::uuid = variant_row.id
      )
    );
  end loop;

  if locked_variant_count <> variant_count then
    raise exception 'Variant not found';
  end if;

  select
    case
      when z.free_over is not null and order_subtotal >= z.free_over then 0
      else z.fee
    end
    into shipping_fee
    from public.shipping_zones as z
    where z.id = shipping_zone_id
      and z.is_active = true;

  if not found then
    raise exception 'Shipping zone not found or inactive';
  end if;

  order_total := order_subtotal + shipping_fee;

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
    order_no,
    type,
    status,
    payment_method,
    payment_status,
    customer_name,
    customer_phone,
    customer_email,
    division,
    district,
    area,
    address_line,
    shipping_zone_id,
    subtotal,
    shipping_fee,
    total,
    customer_note,
    idempotency_key
  )
  values (
    order_no,
    'retail',
    'pending',
    'cod',
    'unpaid',
    btrim(payload->>'customer_name'),
    btrim(payload->>'customer_phone'),
    nullif(btrim(payload->>'customer_email'), ''),
    nullif(btrim(payload->>'division'), ''),
    nullif(btrim(payload->>'district'), ''),
    nullif(btrim(payload->>'area'), ''),
    nullif(btrim(payload->>'address_line'), ''),
    shipping_zone_id,
    order_subtotal,
    shipping_fee,
    order_total,
    nullif(btrim(payload->>'customer_note'), ''),
    request_idempotency_key
  )
  returning id into order_id;

  for item in
    select value from jsonb_array_elements(payload->'items')
  loop
    variant_id := (item->>'variant_id')::uuid;
    quantity := (item->>'qty')::integer;

    select
      v.product_id,
      v.sku,
      v.color_name,
      v.size,
      v.price_delta,
      p.stock_mode,
      p.title_en
      into variant_row
      from public.product_variants as v
      join public.products as p on p.id = v.product_id
      where v.id = variant_id;

    select t.unit_price, t.min_qty
      into base_unit_price, product_quantity
      from public.price_tiers as t
      where t.product_id = variant_row.product_id
        and t.min_qty <= (
          select sum((requested.value->>'qty')::integer)
          from jsonb_array_elements(payload->'items') as requested(value)
          join public.product_variants as v
            on v.id = (requested.value->>'variant_id')::uuid
          where v.product_id = variant_row.product_id
        )
        and (
          t.max_qty is null
          or t.max_qty >= (
            select sum((requested.value->>'qty')::integer)
            from jsonb_array_elements(payload->'items') as requested(value)
            join public.product_variants as v
              on v.id = (requested.value->>'variant_id')::uuid
            where v.product_id = variant_row.product_id
          )
        )
      order by t.min_qty desc
      limit 1;

    insert into public.order_items (
      order_id,
      variant_id,
      title_snapshot,
      sku_snapshot,
      color_snapshot,
      size_snapshot,
      unit_price,
      qty,
      line_total,
      tier_min_qty,
      customization
    )
    values (
      order_id,
      variant_id,
      variant_row.title_en,
      variant_row.sku,
      variant_row.color_name,
      variant_row.size,
      base_unit_price + variant_row.price_delta,
      quantity,
      (base_unit_price + variant_row.price_delta) * quantity,
      product_quantity,
      item->'customization'
    );

    if variant_row.stock_mode = 'tracked' then
      update public.product_variants
        set reserved_qty = reserved_qty + quantity
        where id = variant_id;

      insert into public.inventory_movements (
        variant_id,
        delta,
        reason,
        ref_type,
        ref_id,
        note,
        created_by
      )
      values (
        variant_id,
        -quantity,
        'sale',
        'order',
        order_no,
        'Reserved stock for order',
        null
      );
    end if;
  end loop;

  return order_no;
end;
$$;

drop policy if exists "Public can read published product joins" on public.product_categories;
create policy "Public can read published product joins" on public.product_categories
for select
using (exists (
  select 1
  from public.products as p
  where p.id = product_categories.product_id
    and p.status = 'published'
));

drop policy if exists "Public can read published product joins" on public.product_collections;
create policy "Public can read published product joins" on public.product_collections
for select
using (exists (
  select 1
  from public.products as p
  where p.id = product_collections.product_id
    and p.status = 'published'
));

drop policy if exists "Public can read product images" on public.product_images;
create policy "Public can read product images" on public.product_images
for select
using (exists (
  select 1
  from public.products as p
  where p.id = product_images.product_id
    and p.status = 'published'
));

drop policy if exists "Public can read active variants" on public.product_variants;
create policy "Public can read active variants" on public.product_variants
for select
using (
  is_active = true
  and exists (
    select 1
    from public.products as p
    where p.id = product_variants.product_id
      and p.status = 'published'
  )
);

drop policy if exists "Public can read product tiers" on public.price_tiers;
create policy "Public can read product tiers" on public.price_tiers
for select
using (exists (
  select 1
  from public.products as p
  where p.id = price_tiers.product_id
    and p.status = 'published'
));

drop policy if exists "Public can read product part swatches" on public.product_part_swatches;
create policy "Public can read product part swatches" on public.product_part_swatches
for select
using (exists (
  select 1
  from public.product_custom_parts as part
  join public.products as p on p.id = part.product_id
  join public.swatches as swatch on swatch.id = product_part_swatches.swatch_id
  where part.id = product_part_swatches.part_id
    and p.status = 'published'
    and swatch.is_active = true
));

drop policy if exists "Public can read swatch groups" on public.swatch_groups;
create policy "Public can read swatch groups" on public.swatch_groups
for select
using (true);

grant execute on function public.has_role(text[]) to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
