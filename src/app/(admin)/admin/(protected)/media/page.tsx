import { redirect } from "next/navigation";
import { connection } from "next/server";

import { MediaLibrary } from "@/components/admin/media/media-library";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import {
  isMediaFolder,
  listProjectAssets,
  type MediaFolder,
} from "@/server/media";

export const instant = false;

export const metadata = { title: "Media Library" };

// Media Library (owner request 2026-10-25): browse / upload / delete / reuse
// every Cloudinary asset under Primebagfactory/. Owner/manager only, mirroring
// the `uploadMedia` action's role gate. Folder, search and pagination are
// URL-synced so a filtered view is shareable and back-button friendly.
export default async function MediaPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ folder?: string; q?: string; cursor?: string }>;
}>) {
  // Request-time rendering: the layout's `await connection()` does not cover
  // this page segment, and the session check reads Date.now internally.
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Media Library"
        description="You don't have access to manage media."
      />
    );
  }

  const params = await searchParams;
  const folder: MediaFolder | null = isMediaFolder(params.folder)
    ? params.folder
    : null;
  const q = (params.q ?? "").trim().slice(0, 80);
  const cursor = params.cursor || null;

  // `listProjectAssets` already resolves null when Cloudinary answers badly or
  // is not configured; the catch is for an unexpected throw (broken config at
  // runtime) so the page shows its error state instead of the crash boundary.
  const page = await listProjectAssets({ folder, cursor }).catch(() => null);

  // Server-side name filter: the Admin API pages by folder, so a query would
  // otherwise only ever see the current page. Cursor pagination + search don't
  // mix; with a search active we fetch a wide single page instead.
  if (q) {
    const all =
      (await listProjectAssets({ folder, maxResults: 500 }).catch(
        () => null,
      )) ?? page;
    const needle = q.toLowerCase();
    const assets = (all?.assets ?? []).filter((a) =>
      a.publicId.toLowerCase().includes(needle),
    );
    return (
      <MediaLibrary
        assets={assets}
        nextCursor={null}
        folder={folder}
        q={q}
        failed={all === null}
      />
    );
  }

  return (
    <MediaLibrary
      assets={page?.assets ?? []}
      nextCursor={page?.nextCursor ?? null}
      folder={folder}
      q=""
      failed={page === null}
    />
  );
}
