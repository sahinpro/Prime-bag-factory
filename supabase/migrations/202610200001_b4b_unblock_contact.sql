-- Plan 15.2 B4b — audited unblock for the staff blocklist.
--
-- Removing a `blocked_contacts` row and writing its `audit_logs` trail must
-- commit or roll back together (an unblock with no audit row is exactly the
-- failure this page exists to prevent), so it is one security-definer
-- function — the same rationale as the Phase 5 fulfilment RPCs. The role is
-- re-checked inside, mirroring the owner/manager RLS policies on both tables,
-- so a caller cannot smuggle an unblock through a weaker session.

create or replace function public.admin_unblock_contact(
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.blocked_contacts%rowtype;
begin
  if not public.has_role(array['owner', 'manager']) then
    raise exception 'not_allowed';
  end if;

  select * into v_row from public.blocked_contacts where id = p_id;
  if not found then
    raise exception 'block_not_found';
  end if;

  delete from public.blocked_contacts where id = p_id;

  -- The deleted row is copied into `diff` before it disappears: record_id
  -- alone would dangle. `value` is intentionally readable here — audit_logs
  -- are owner/manager-only (Phase 1 policy), and the point of the trail is
  -- knowing WHICH number came off the list.
  insert into public.audit_logs (actor_id, action, table_name, record_id, diff)
  values (
    auth.uid(),
    'unblock',
    'blocked_contacts',
    v_row.id,
    jsonb_build_object(
      'type', v_row.type,
      'value', v_row.value,
      'reason', v_row.reason,
      'blocked_by', v_row.created_by,
      'blocked_at', v_row.created_at
    )
  );
end;
$$;

revoke all on function public.admin_unblock_contact(uuid) from public, anon;
grant execute on function public.admin_unblock_contact(uuid) to authenticated;
