-- Plan 15.2 C1 — a new order enqueues its notifications in the same
-- transaction, a replay does not enqueue again, and the sender's claim
-- bumps attempts exactly once per call. The HTTP send itself is proven
-- in vitest (src/server/notifications.test.ts); this file proves the
-- database side the app cannot fake.

create extension if not exists pgtap with schema extensions;

begin;

select plan(25);

-- ---------------------------------------------------------------- fixture --
insert into auth.users (id) values
  ('c1000001-0000-4000-8000-000000000001');

insert into public.profiles (id, full_name, role) values
  ('c1000001-0000-4000-8000-000000000001', 'C1 Owner', 'owner');

insert into public.products (id, slug, type, title_en, moq, stock_mode, status) values
  ('c1000010-0000-4000-8000-000000000001', 'c1-bag', 'buy_now', 'C1 bag', 5, 'tracked', 'published');

insert into public.product_variants (id, product_id, sku, color_name, price_delta, stock_qty, reserved_qty, is_active) values
  ('c1000011-0000-4000-8000-000000000001', 'c1000010-0000-4000-8000-000000000001', 'C1-V1', 'Black', 0, 100, 0, true);

insert into public.price_tiers (product_id, min_qty, max_qty, unit_price) values
  ('c1000010-0000-4000-8000-000000000001', 5, null, 100);

insert into public.shipping_zones (id, name_en, fee, free_over, is_active) values
  ('c1000020-0000-4000-8000-000000000001', 'C1 zone', 50, null, true);

-- ------------------------------------------------------------- function shape --
select has_function(
  'public', 'enqueue_order_notifications', array[]::text[],
  'the order-insert trigger function exists'
);

select ok(
  (select prosecdef from pg_proc
    where oid = 'public.enqueue_order_notifications()'::regprocedure),
  'enqueue_order_notifications is security definer'
);

select is(
  (select array_to_string(proconfig, '|') from pg_proc
    where oid = 'public.enqueue_order_notifications()'::regprocedure),
  'search_path=""',
  'enqueue_order_notifications pins search_path to empty'
);

select has_trigger(
  'public', 'orders', 'orders_enqueue_notifications',
  'orders enqueue notifications after insert'
);

select has_function(
  'public', 'claim_pending_emails', array['integer'],
  'claim_pending_emails exists'
);

select ok(
  (select prosecdef from pg_proc
    where oid = 'public.claim_pending_emails(integer)'::regprocedure),
  'claim_pending_emails is security definer'
);

select is(
  (select array_to_string(proconfig, '|') from pg_proc
    where oid = 'public.claim_pending_emails(integer)'::regprocedure),
  'search_path=""',
  'claim_pending_emails pins search_path to empty'
);

-- ------------------------------------------------------------------- grants --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select * from public.claim_pending_emails(1)$$,
  '42501',
  'permission denied for function claim_pending_emails',
  'anon cannot claim pending emails'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$select * from public.claim_pending_emails(1)$$,
  '42501',
  'permission denied for function claim_pending_emails',
  'a signed-in session cannot claim pending emails'
);

-- ------------------------------------------------------------- place_order --
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select ok(
  public.place_order('{
    "customer_name":"C1 customer","customer_phone":"01700000091",
    "shipping_zone_id":"c1000020-0000-4000-8000-000000000001",
    "idempotency_key":"c1-web",
    "items":[{"variant_id":"c1000011-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb) like 'PBF-%',
  'place_order accepts the C1 order'
);

select lives_ok(
  $$select public.place_order('{
    "customer_name":"C1 customer","customer_phone":"01700000091",
    "shipping_zone_id":"c1000020-0000-4000-8000-000000000001",
    "idempotency_key":"c1-web",
    "items":[{"variant_id":"c1000011-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb)$$,
  'replaying the same idempotency key does not raise'
);

reset role;

select is(
  (select count(*)::integer from public.notifications as n
    where n.channel = 'admin_alert'
      and n.template = 'new_order'
      and n.payload ->> 'order_no' = (
        select o.order_no from public.orders as o where o.idempotency_key = 'c1-web'
      )),
  1,
  'one admin_alert is enqueued for the new order'
);

select is(
  (select count(*)::integer from public.notifications as n
    where n.channel = 'email'
      and n.template = 'new_order'
      and n.status = 'pending'
      and n.attempts = 0
      and n.recipient = (select s.value ->> 'email' from public.settings as s where s.key = 'company')
      and n.payload ->> 'order_no' = (
        select o.order_no from public.orders as o where o.idempotency_key = 'c1-web'
      )),
  1,
  'one pending email is addressed to settings.company and a replay did not add a second'
);

select ok(
  (select n.payload::text not like '%01700000091%'
     and n.payload::text not like '%customer_phone%'
     and n.payload::text not like '%address%'
   from public.notifications as n
   where n.channel = 'email' and n.template = 'new_order'
     and n.payload ->> 'order_no' = (
       select o.order_no from public.orders as o where o.idempotency_key = 'c1-web'
     )),
  'the email payload stores the order, not the phone or the address'
);

-- A rejected order never inserts, so the trigger never runs.
select throws_ok(
  $$select public.place_order('{
      "customer_name":"C1 customer","customer_phone":"01700000091",
      "shipping_zone_id":"c1000020-0000-4000-8000-000000000001",
      "idempotency_key":"c1-moq",
      "items":[{"variant_id":"c1000011-0000-4000-8000-000000000001","qty":1}]
    }'::jsonb)$$,
  'P0001', 'Quantity below MOQ',
  'place_order still rejects a quantity under MOQ'
);

select is(
  (select count(*)::integer from public.orders where idempotency_key = 'c1-moq'),
  0,
  'a rejected order is not stored, so the enqueue trigger never runs'
);

-- ------------------------------------------------------------------- claim --
select is(
  (select attempts from public.claim_pending_emails(20)
    where payload ->> 'order_no' = (
      select o.order_no from public.orders as o where o.idempotency_key = 'c1-web'
    )),
  1,
  'claim increments attempts and returns the pending email'
);

select is(
  (select status::text from public.notifications
    where channel = 'email' and template = 'new_order'
      and payload ->> 'order_no' = (
        select o.order_no from public.orders as o where o.idempotency_key = 'c1-web'
      )),
  'pending',
  'claim leaves the row pending until the sender records the outcome'
);

update public.notifications
  set status = 'sent', sent_at = now()
  where channel = 'email' and template = 'new_order';

select is(
  (select count(*)::integer from public.claim_pending_emails(20)),
  0,
  'a sent email is not claimed again'
);

-- ---------------------------------------------------- missing company email --
update public.settings
  set value = jsonb_set(value, '{email}', '""'::jsonb)
  where key = 'company';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select lives_ok(
  $$select public.place_order('{
    "customer_name":"C1 no-mail","customer_phone":"01700000092",
    "shipping_zone_id":"c1000020-0000-4000-8000-000000000001",
    "idempotency_key":"c1-no-mail",
    "items":[{"variant_id":"c1000011-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb)$$,
  'an order still places when the company email is blank'
);

reset role;

select is(
  (select count(*)::integer from public.notifications as n
    where n.channel = 'admin_alert' and n.template = 'new_order'
      and n.payload ->> 'order_no' = (
        select o.order_no from public.orders as o where o.idempotency_key = 'c1-no-mail'
      )),
  1,
  'the bell alert is still enqueued when the company email is blank'
);

select is(
  (select count(*)::integer from public.notifications as n
    where n.channel = 'email' and n.template = 'new_order'
      and n.payload ->> 'order_no' = (
        select o.order_no from public.orders as o where o.idempotency_key = 'c1-no-mail'
      )),
  0,
  'a blank company email does not enqueue an email row'
);

update public.settings
  set value = jsonb_set(value, '{email}', '"info@primebagfactorybd.com"'::jsonb)
  where key = 'company';

-- ------------------------------------------------------------- admin order --
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1000001-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select public.admin_create_order('{
    "customer_name":"Walk-in","customer_phone":"01700000093","channel":"walk_in",
    "shipping_zone_id":"c1000020-0000-4000-8000-000000000001",
    "idempotency_key":"c1-admin",
    "items":[{"variant_id":"c1000011-0000-4000-8000-000000000001","qty":5}]
  }'::jsonb)$$,
  'an admin order places for the notification check'
);

reset role;

select is(
  (select count(*)::integer from public.notifications as n
    where n.template = 'new_order'
      and n.payload ->> 'source' = 'admin'
      and n.payload ->> 'order_no' = (
        select o.order_no from public.orders as o where o.idempotency_key = 'c1-admin'
      )),
  2,
  'an admin-created order enqueues both the bell alert and the company email'
);

select is(
  (select n.payload ->> 'channel' from public.notifications as n
    where n.channel = 'email' and n.template = 'new_order'
      and n.payload ->> 'order_no' = (
        select o.order_no from public.orders as o where o.idempotency_key = 'c1-admin'
      )),
  'walk_in',
  'the admin email payload records the intake channel'
);

select * from finish();
rollback;
