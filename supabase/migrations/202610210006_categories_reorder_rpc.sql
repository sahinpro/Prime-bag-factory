-- Plan 15.2 — categories tree reorder (single round trip).
--
-- Reordering a sibling group used to be N sequential UPDATEs from the app
-- (one per category) over the whole flattened tree. This collapses it to one
-- set-based renumber scoped to a single parent's children, guarded by the same
-- owner/manager role gate the `categories` RLS uses. `has_role()` is re-checked
-- inside because SECURITY DEFINER bypasses RLS; the action also calls
-- `requireRole()`.
--
-- Contract: `p_ordered_ids` is the full, newly-ordered list of the direct
-- children of `p_parent_id` (NULL = top level). Every id must exist AND have
-- exactly that parent — a mismatch means the client tried to reparent by
-- dragging, which this table models only through the editor form, so we reject
-- it. `sort_order` is renumbered 0..n-1 in one UPDATE ... FROM unnest(...)
-- WITH ORDINALITY, which also normalises any pre-existing duplicate ranks.

create or replace function public.reorder_categories(
  p_parent_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['owner', 'manager']) then
    raise exception 'not_allowed';
  end if;

  if p_ordered_ids is null or array_length(p_ordered_ids, 1) is null then
    return; -- nothing to reorder
  end if;

  -- Reject duplicate ids and any id that is not a direct child of p_parent_id
  -- (parent_id is compared null-safe so the top level works too).
  if (
    select count(*) from unnest(p_ordered_ids) as t(id)
  ) <> (
    select count(distinct t.id) from unnest(p_ordered_ids) as t(id)
  ) then
    raise exception 'duplicate_id';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) as t(id)
    where not exists (
      select 1
      from public.categories c
      where c.id = t.id
        and c.parent_id is not distinct from p_parent_id
    )
  ) then
    raise exception 'invalid_group';
  end if;

  update public.categories as c
  set sort_order = (o.ord - 1)::integer
  from unnest(p_ordered_ids) with ordinality as o(id, ord)
  where c.id = o.id;
end;
$$;

revoke all on function public.reorder_categories(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid, uuid[]) to authenticated;
