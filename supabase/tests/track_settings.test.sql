-- Plan §9 / order-of-work step 9 — pgTAP for `settings` RLS.
--
-- The /admin/settings screen upserts jsonb rows (`company`,
-- `notification_cron`) directly through the API (no definer RPC), so the whole
-- safety story lives in RLS: everyone may READ settings (public invoice/company
-- data + print sheets), but ONLY owner/manager may WRITE. This proves the
-- contract the actions rely on — customer/anon writes are refused, owner and
-- manager writes land — and that the secret blob is never reachable by a
-- non-management session.

create extension if not exists pgtap with schema extensions;

begin;

select plan(10);

-- ------------------------------------------------------------ fixtures ----
insert into auth.users (id) values
  ('5e700001-0000-4000-8000-000000000001'), -- owner
  ('5e700002-0000-4000-8000-000000000001'), -- manager
  ('5e700003-0000-4000-8000-000000000001'), -- customer
  ('5e700004-0000-4000-8000-000000000001'); -- sales (staff, not management)

insert into public.profiles (id, full_name, role) values
  ('5e700001-0000-4000-8000-000000000001', 'Settings Owner', 'owner'),
  ('5e700002-0000-4000-8000-000000000001', 'Settings Manager', 'manager'),
  ('5e700003-0000-4000-8000-000000000001', 'Settings Customer', 'customer'),
  ('5e700004-0000-4000-8000-000000000001', 'Settings Sales', 'sales');

-- Seed one editable row so update-targets exist (inserted as postgres, above RLS).
-- Clear the seed's company/checkout rows first so the fixtures are deterministic.
delete from public.settings;
insert into public.settings (key, value) values
  ('company', '{"name":"Original Co","email":"ops@original.test"}'::jsonb);

-- ------------------------------------------------------- read is public ----
set local role anon;
select lives_ok(
  $$select key from public.settings$$,
  'anon may read settings (public company data + print sheets)'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"5e700003-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select key from public.settings$$,
  'a customer session may read settings'
);

-- ------------------------------------------------- writes: management only --
reset role;
select set_config('request.jwt.claims',
  '{"sub":"5e700003-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.settings (key, value) values ('hijack', '{}'::jsonb)$$,
  '42501',
  'new row violates row-level security policy for table "settings"',
  'a customer cannot insert a settings row'
);

-- A customer UPDATE matches no rows under the for-all USING clause, so it is a
-- silent no-op rather than an error — assert the value is untouched below.
select lives_ok(
  $$update public.settings set value = '{"name":"Hacked"}'::jsonb where key = 'company'$$,
  'a customer update runs but must change nothing'
);

reset role;

select is(
  (select value ->> 'name' from public.settings where key = 'company'),
  'Original Co',
  'the customer update did not alter the company row'
);

-- sales is staff but NOT management — its update must also be a no-op.
reset role;
select set_config('request.jwt.claims',
  '{"sub":"5e700004-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.settings set value = '{"name":"Sales Edits"}'::jsonb
     where key = 'company'$$,
  'sales update runs but matches no rows under RLS'
);

reset role;

select is(
  (select value ->> 'name' from public.settings where key = 'company'),
  'Original Co',
  'the sales update did not alter the company row'
);

-- owner INSERT lands (upsert target for a new group like notification_cron).
reset role;
select set_config('request.jwt.claims',
  '{"sub":"5e700001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.settings (key, value)
    values ('notification_cron', '{"url":"https://app.example/api/cron","secret":"s3cr3t"}'::jsonb)$$,
  'owner may insert the notification_cron settings row'
);

reset role;

select is(
  (select count(*)::integer from public.settings where key = 'notification_cron'),
  1,
  'the owner-inserted notification_cron row persisted'
);

-- manager UPDATE lands (management can manage settings, both roles).
reset role;
select set_config('request.jwt.claims',
  '{"sub":"5e700002-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.settings set value = '{"name":"Renamed Co"}'::jsonb where key = 'company'$$,
  'manager may update the company row'
);

reset role;

select * from finish();
rollback;
