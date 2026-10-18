import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CollectionsTable } from "@/components/admin/collections/collections-table";
import type { DataTableQuery } from "@/components/admin/data/data-table";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import { listAdminCollections } from "@/server/collections";

export const instant = false;

export const metadata = { title: "Collections" };

// Collections is owner/manager only (mirrors the `has_role(['owner','manager'])`
// catalog policy and the sidebar gate). The read uses the cookie session; writes
// re-check the role inside each server action. Sort/page/search arrive as URL
// params and seed the client table so state survives reload and share.
export default async function CollectionsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    q?: string;
    sort?: string;
    dir?: string;
    page?: string;
    size?: string;
  }>;
}>) {
  // Request-time rendering: the layout's `await connection()` does not cover
  // this page segment, and the session check reads Date.now internally
  // (Next 16 PPR "blocking-prerender-current-time").
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Collections"
        description="You don't have access to manage collections."
      />
    );
  }

  const [collections, params] = await Promise.all([
    listAdminCollections(),
    searchParams,
  ]);

  const initialQuery: Partial<DataTableQuery> = {
    q: params.q,
    sort: params.sort,
    dir: params.dir === "desc" ? "desc" : "asc",
    page: params.page ? Number(params.page) : 1,
    pageSize: params.size ? Number(params.size) : 10,
  };

  return (
    <CollectionsTable collections={collections} initialQuery={initialQuery} />
  );
}
