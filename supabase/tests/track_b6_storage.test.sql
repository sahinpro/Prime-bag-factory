-- Plan 15.2 B6 — pgTAP for the private `quote-attachments` bucket.
--
-- Proves the storage half of the owner decision: the bucket exists with the
-- exact constraints (private, 8 MB, png/jpeg/webp/pdf, never svg), and the
-- RESTRICTIVE policy denies anon/authenticated every direct storage.objects
-- path into it — select, insert, update, delete — without touching any other
-- bucket. The signed-URL flows (which bypass RLS by design, token = grant)
-- are proven end-to-end in Playwright, not here.

create extension if not exists pgtap with schema extensions;

begin;

select plan(14);

-- ------------------------------------------------------------ fixtures ----
-- A control bucket + a permissive anon-read policy on it (rolled back with
-- the test): the ONLY way to show the new restrictive policy is scoped to
-- quote-attachments — anon must still see the control row.
insert into storage.buckets (id, name, public)
values ('b6-control-bucket', 'b6-control-bucket', false);

create policy "b6 test anon read control"
  on storage.objects as permissive
  for select
  to anon
  using (bucket_id = 'b6-control-bucket');

insert into storage.objects (bucket_id, name, version)
values
  ('quote-attachments', '2026/b6-seeded.png', '1'),
  ('b6-control-bucket', '2026/b6-control.png', '1');

-- ------------------------------------------------------- bucket shape -----
select ok(
  exists (select 1 from storage.buckets where id = 'quote-attachments'),
  'the quote-attachments bucket exists'
);

select is(
  (select public from storage.buckets where id = 'quote-attachments'),
  false,
  'the bucket is private (no public URL path)'
);

select is(
  (select file_size_limit from storage.buckets where id = 'quote-attachments'),
  8388608::bigint,
  'the bucket caps files at 8 MB'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'quote-attachments'),
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  'the bucket accepts exactly png/jpeg/webp/pdf'
);

select ok(
  (select 'image/svg+xml' <> all (allowed_mime_types)
     from storage.buckets where id = 'quote-attachments'),
  'svg is deliberately not allowed (no scripts in the staff panel)'
);

select is(
  (select permissive from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'b6 quote attachments deny direct access'),
  'RESTRICTIVE',
  'the deny policy is RESTRICTIVE — a future permissive policy cannot re-open the bucket'
);

-- --------------------------------------------- anon: all four verbs dead --
set local role anon;

select is(
  (select count(*) from storage.objects where bucket_id = 'quote-attachments'),
  0::bigint,
  'anon sees no objects in the bucket (select denied)'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, version)
    values ('quote-attachments', '2026/b6-anon-direct.png', '1')$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'anon cannot insert into the bucket directly (with check denied)'
);

reset role;
set local role anon;

-- (data-modifying CTEs must sit at the top level of the statement, so the
-- `is()` call wraps the count read, not the update itself)
with u as (
  update storage.objects set updated_at = now()
    where bucket_id = 'quote-attachments'
  returning 1
)
select is(
  (select count(*) from u),
  0::bigint,
  'anon update touches no rows (using denied)'
);

-- The delete CTE needs the storage guard trigger's escape hatch enabled —
-- every direct SQL delete is blocked for ALL roles by default; with it on,
-- RLS is the wall under test and still filters every row to zero.
set local storage.allow_delete_query = 'true';

with d as (
  delete from storage.objects
    where bucket_id = 'quote-attachments'
  returning 1
)
select is(
  (select count(*) from d),
  0::bigint,
  'anon delete touches no rows (using denied)'
);

-- The restrictive policy must not leak into other buckets: the control
-- bucket has its own permissive anon policy and stays readable.
select is(
  (select count(*) from storage.objects where bucket_id = 'b6-control-bucket'),
  1::bigint,
  'the deny policy is scoped to quote-attachments — other buckets unaffected'
);

reset role;

-- ------------------------------------------- authenticated: same wall ----
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000000","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$insert into storage.objects (bucket_id, name, version)
    values ('quote-attachments', '2026/b6-auth-direct.png', '1')$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'a signed-in customer cannot insert into the bucket either'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'quote-attachments'),
  0::bigint,
  'authenticated sees no objects in the bucket'
);

-- ------------------------------------------------ service_role: passes ----
reset role;
set local role service_role;

-- service_role reaches its OWN seeded object (scoped by name so objects a
-- Playwright run left in the bucket can never skew the expected count).
select is(
  (select count(*) from storage.objects
     where bucket_id = 'quote-attachments' and name = '2026/b6-seeded.png'),
  1::bigint,
  'service_role still reaches its own object (the server-side signed-URL flows)'
);

reset role;

select * from finish();
rollback;
