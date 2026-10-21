-- D1 (plan §15): make the audit trail append-only for staff.
--
-- The Phase 1 policy gave owner/manager `for all` on audit_logs, which let them
-- rewrite or erase the very rows meant to record their actions. This replaces it
-- with: staff (any role that performs admin mutations) may INSERT a row whose
-- actor is themselves, and owner/manager may SELECT for the dashboard feed.
-- There is deliberately NO update or delete policy, so under RLS staff can
-- neither edit nor remove audit history. service_role and the security-definer
-- RPCs (E3 admin_create_order, B4b admin_unblock_contact) keep writing through
-- BYPASSRLS, exactly as before.
--
-- Idempotent: drop-then-create so re-applying on an already-migrated DB is safe.

drop policy if exists "Management can manage audit logs" on public.audit_logs;
drop policy if exists "Staff can append audit logs" on public.audit_logs;
drop policy if exists "Management can read audit logs" on public.audit_logs;

-- Append only: the actor must be the caller, and the caller must be staff.
create policy "Staff can append audit logs" on public.audit_logs
for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and public.has_role(array['owner', 'manager', 'sales', 'inventory'])
);

-- Read the trail: management only (the dashboard ActivityFeed runs as owner/manager).
create policy "Management can read audit logs" on public.audit_logs
for select to authenticated
using (public.has_role(array['owner', 'manager']));

-- No UPDATE and no DELETE policy → RLS denies both for every authenticated role.
-- Grants are unchanged from Phase 1 (authenticated already has table privileges);
-- RLS is the wall that makes the log append-only.
