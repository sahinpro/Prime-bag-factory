-- Phase 2 (Swatch Library): `swatch_groups` had only a public READ policy, so
-- even though RLS is enabled, staff could not create / rename / reorder / delete
-- swatch groups — writes fail closed with no matching policy. Grant the same
-- catalog-management rights already held on `swatches` (owner / manager /
-- inventory). Deleting a group still cascades to its swatches (FK on delete
-- cascade) and those swatches cascade out of `product_part_swatches`; a group
-- write is therefore never blocked by a downstream FK.
-- Idempotent: the policy was first created out-of-band before this file was
-- tracked, so drop-if-exists keeps re-application (and a fresh DB that runs the
-- whole history) safe.
drop policy if exists "Staff can manage swatch groups" on public.swatch_groups;
create policy "Staff can manage swatch groups" on public.swatch_groups
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));
