-- Plan 15.2 — reorder_categories pgTAP tests.
--
-- Proves the single set-based sibling renumber: function shape and grants, the
-- owner/manager role gate (customer / sales / anon refused), a happy renumber of
-- a top-level group and of a child group, rejection of a wrong-parent id and a
-- non-existent id (you cannot reparent by dragging), rejection of duplicate ids,
-- normalisation of pre-existing sort_order ties, and that an empty list is a
-- harmless no-op. Runs inside one rolled-back transaction.

create extension if not exists pgtap with schema extensions;

begin;

select plan(20);

-- ---------------------------------------------------------------- fixture --
insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000003'),
  ('a1000000-0000-4000-8000-000000000004');

insert into public.profiles (id, full_name, role) values
  ('a1000000-0000-4000-8000-000000000001', 'Reorder Owner',   'owner'),
  ('a1000000-0000-4000-8000-000000000002', 'Reorder Manager', 'manager'),
  ('a1000000-0000-4000-8000-000000000003', 'Reorder Customer','customer'),
  ('a1000000-0000-4000-8000-000000000004', 'Reorder Sales',   'sales');

-- Two top-level categories, each with two children.
insert into public.categories (id, parent_id, slug, name_en, sort_order) values
  ('b1000000-0000-4000-8000-00000000000a', null, 'reorder-a', 'Reorder A', 0),
  ('b1000000-0000-4000-8000-00000000000b', null, 'reorder-b', 'Reorder B', 1),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-00000000000a', 'reorder-a-1', 'Reorder A1', 0),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-00000000000a', 'reorder-a-2', 'Reorder A2', 1),
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-00000000000b', 'reorder-b-1', 'Reorder B1', 0),
  ('b3000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-00000000000b', 'reorder-b-2', 'Reorder B2', 1);

-- ------------------------------------------------------------ function shape --
select has_function(
  'public', 'reorder_categories', array['uuid', 'uuid[]'],
  'reorder_categories exists with the (parent, ordered_ids) shape'
);

select ok(
  (select prosecdef from pg_proc
    where oid = 'public.reorder_categories(uuid, uuid[])'::regprocedure),
  'reorder_categories is security definer — it writes past RLS on purpose'
);

select is(
  (select array_to_string(proconfig, '|') from pg_proc
    where oid = 'public.reorder_categories(uuid, uuid[])'::regprocedure),
  'search_path=""',
  'reorder_categories pins search_path to empty'
);

-- ------------------------------------------------------------------- grants --
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select public.reorder_categories(null, array[
    'b1000000-0000-4000-8000-00000000000a'::uuid])$$,
  '42501',
  'permission denied for function reorder_categories',
  'anon cannot execute reorder_categories at all'
);

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.reorder_categories(null, array[
    'b1000000-0000-4000-8000-00000000000a'::uuid,
    'b1000000-0000-4000-8000-00000000000b'::uuid])$$,
  'P0001', 'not_allowed',
  'a plain customer session is refused by the in-function role check'
);

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select throws_ok(
  $$select public.reorder_categories(null, array[
    'b1000000-0000-4000-8000-00000000000a'::uuid])$$,
  'P0001', 'not_allowed',
  'the sales role is outside the owner/manager gate'
);

-- ----------------------------------------------- happy path (as the owner) --
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select public.reorder_categories(null, array[
    'b1000000-0000-4000-8000-00000000000b'::uuid,
    'b1000000-0000-4000-8000-00000000000a'::uuid])$$,
  'the owner can reorder the top-level group'
);

select is(
  (select sort_order from public.categories
    where id = 'b1000000-0000-4000-8000-00000000000b'),
  0, 'the first top-level id in the list became sort_order 0'
);

select is(
  (select sort_order from public.categories
    where id = 'b1000000-0000-4000-8000-00000000000a'),
  1, 'the second top-level id became sort_order 1'
);

select is(
  (select parent_id from public.categories
    where id = 'b1000000-0000-4000-8000-00000000000a'),
  null, 'reorder never touches parent_id (A is still top level)'
);

-- reorder a child group of A
select lives_ok(
  $$select public.reorder_categories('b1000000-0000-4000-8000-00000000000a', array[
    'b2000000-0000-4000-8000-000000000002'::uuid,
    'b2000000-0000-4000-8000-000000000001'::uuid])$$,
  'the owner can reorder a child group under its parent'
);

select is(
  (select sort_order from public.categories
    where id = 'b2000000-0000-4000-8000-000000000002'),
  0, 'A2 moved to the front of its parent group'
);

select is(
  (select sort_order from public.categories
    where id = 'b2000000-0000-4000-8000-000000000001'),
  1, 'A1 took the second slot in its parent group'
);

-- ------------------------------------------------- group-membership guards --
select throws_ok(
  $$select public.reorder_categories(null, array[
    'b1000000-0000-4000-8000-00000000000a'::uuid,
    'b2000000-0000-4000-8000-000000000001'::uuid])$$,  -- A1 is a CHILD, not top level
  'P0001', 'invalid_group',
  'a wrong-parent id cannot be smuggled into the top-level reorder (no drag-reparent)'
);

select throws_ok(
  $$select public.reorder_categories('b1000000-0000-4000-8000-00000000000a', array[
    'b3000000-0000-4000-8000-000000000001'::uuid])$$,  -- B1 belongs to B, not A
  'P0001', 'invalid_group',
  'a child of another parent is rejected from this parent group'
);

select throws_ok(
  $$select public.reorder_categories(null, array[
    'deadbeef-0000-4000-8000-000000000000'::uuid])$$,
  'P0001', 'invalid_group',
  'a non-existent id is rejected'
);

select throws_ok(
  $$select public.reorder_categories(null, array[
    'b1000000-0000-4000-8000-00000000000a'::uuid,
    'b1000000-0000-4000-8000-00000000000a'::uuid])$$,
  'P0001', 'duplicate_id',
  'duplicate ids in the ordered list are rejected'
);

-- ------------------------------------------------- ties normalised (manager) --
update public.categories
   set sort_order = 7
 where id in (
   'b2000000-0000-4000-8000-000000000001',
   'b2000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$select public.reorder_categories('b1000000-0000-4000-8000-00000000000a', array[
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000002'::uuid])$$,
  'the manager role can also reorder'
);

select is(
  (select count(distinct sort_order)::integer from public.categories
    where parent_id = 'b1000000-0000-4000-8000-00000000000a'),
  2, 'a reorder over tied ranks normalises them to distinct 0..n-1'
);

-- ------------------------------------------------------- empty list no-op --
select lives_ok(
  $$select public.reorder_categories(null, '{}'::uuid[])$$,
  'an empty ordered list is a harmless no-op'
);

select * from finish();
rollback;
