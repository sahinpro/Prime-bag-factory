-- ============================================================================
-- Plan 15.2 B6 (owner decision 2026-10-19, option B) — private quote artwork.
--
-- Customer artwork stops living on Cloudinary public delivery URLs (finding
-- R11: the cloudinary.ts comment promised Supabase Storage while the code
-- shipped public CDN links — anyone with the URL could see a client's
-- unreleased packaging design). It moves to a PRIVATE Supabase Storage bucket:
--
--   * `quote-attachments` — not public, 8 MB cap, png/jpeg/webp/pdf only.
--     The mime list deliberately excludes svg (an uploaded svg is a script
--     waiting to run in the staff panel) and matches ACCEPT in
--     artwork-upload.tsx plus pdf for print-ready artwork documents.
--   * One RESTRICTIVE policy denies anon/authenticated every direct
--     storage.objects path into this bucket — select, insert, update, delete.
--     Restrictive is deliberate: it stays true even if some future permissive
--     policy opens storage.objects, so the bucket can never be re-exposed by
--     accident. The predicate only excludes THIS bucket, so other buckets keep
--     whatever access they have today.
--
-- Uploads and reads flow through server-issued signed URLs instead
-- (createSignedUploadUrl / createSignedUrl via the service-role client).
-- Signed-URL operations run through the storage service's privileged
-- connection — that is the entire point of a signed token: the token IS the
-- grant, no RLS policy is needed, and the browser's anon key alone gets
-- nothing (proven by the pgTAP file and the Playwright upload e2e).
--
-- service_role has BYPASSRLS and is untouched, as is the storage service
-- owner. Idempotent: safe to re-run on a project where the bucket already
-- exists (it also RE-applies the constraints, healing dashboard drift).
-- ============================================================================

begin;

-- ── 1. The private bucket ───────────────────────────────────────────────────
-- file_size_limit is bytes; 8 MiB matches MAX_BYTES in artwork-upload.tsx and
-- the old Cloudinary-era cap. Enforced by the storage API on real uploads.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'quote-attachments',
  'quote-attachments',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Deny all direct anon/authenticated access to the bucket ─────────────
drop policy if exists "b6 quote attachments deny direct access"
  on storage.objects;

create policy "b6 quote attachments deny direct access"
  on storage.objects as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'quote-attachments')
  with check (bucket_id <> 'quote-attachments');

commit;
