-- Plan §15 D2 — pgTAP for the MFA enforcement flag stored in `settings.security`.
--
-- The require_mfa toggle rides the SAME settings table RLS proved in
-- track_settings.test.sql (everyone reads, only owner/manager write). This file
-- narrows the contract to the one row the security screen flips: a customer or
-- anon session can read the flag but can never raise it, while owner/manager can
-- turn AAL2 enforcement on and off. The login/requireRole checks in the app read
-- exactly this value.

create extension if not exists pgtap with schema extensions;

begin;

select plan(7);

-- ------------------------------------------------------------ fixtures ----
insert into auth.users (id) values
  ('5f200001-0000-4000-8000-000000000001'), -- owner
  ('5f200002-0000-4000-8000-000000000001'), -- manager
  ('5f200003-0000-4000-8000-000000000001'); -- customer

insert into public.profiles (id, full_name, role) values
  ('5f200001-0000-4000-8000-000000000001', 'MFA Owner', 'owner'),
  ('5f200002-0000-4000-8000-000000000001', 'MFA Manager', 'manager'),
  ('5f200003-0000-4000-8000-000000000001', 'MFA Customer', 'customer');

-- Deterministic starting point: enforcement OFF (mirrors seed.sql).
delete from public.settings;
insert into public.settings (key, value) values
  ('security', '{"require_mfa": false}'::jsonb);

-- ------------------------------------------------------- read is public ----
set local role anon;
select is(
  (select value ->> 'require_mfa' from public.settings where key = 'security'),
  'false',
  'anon may read the security flag (defaults to off)'
);

reset role;
select set_config('request.jwt.claims',
  '{"sub":"5f200003-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select value ->> 'require_mfa' from public.settings where key = 'security'$$,
  'a customer session may read the security flag'
);

-- ------------------------------------- a customer cannot raise the flag ----
select lives_ok(
  $$update public.settings
     set value = '{"require_mfa": true}'::jsonb
     where key = 'security'$$,
  'a customer update runs but must match no rows'
);

reset role;

select is(
  (select value ->> 'require_mfa' from public.settings where key = 'security'),
  'false',
  'the customer could not turn enforcement on'
);

-- ------------------------------------- an owner can turn it on ------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"5f200001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.settings
     set value = '{"require_mfa": true}'::jsonb
     where key = 'security'$$,
  'owner may update the security flag'
);

reset role;

select is(
  (select value ->> 'require_mfa' from public.settings where key = 'security'),
  'true',
  'the owner update turned enforcement on'
);

-- ------------------------------------- a manager can turn it back off -----
reset role;
select set_config('request.jwt.claims',
  '{"sub":"5f200002-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.settings
     set value = '{"require_mfa": false}'::jsonb
     where key = 'security'$$,
  'manager may turn enforcement back off'
);

select * from finish();
rollback;
