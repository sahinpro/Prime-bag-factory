import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { DataTableQuery } from "@/components/admin/data/data-table";
import { PageHeader } from "@/components/admin/shell/page-header";
import { ShippingManager } from "@/components/admin/shipping/shipping-table";
import { getAdminUser } from "@/lib/auth";
import { listAdminShippingZones } from "@/server/shipping";

export const instant = false;

export const metadata = { title: "Shipping zones" };

// Shipping zones are owner/manager only (mirrors the `has_role(['owner','manager'])`
// policy and the sidebar gate). The read uses the cookie session; writes re-check the
// role inside each server action. Sort/page/search arrive as URL params and seed the
// client table so state survives reload and share.
export default async function ShippingPage({
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
  // Request-time rendering: the layout's `await connection()` does not cover this
  // page segment, and the session check reads Date.now internally (Next 16 PPR).
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Shipping zones"
        description="You don't have access to manage shipping zones."
      />
    );
  }

  const [zones, params] = await Promise.all([
    listAdminShippingZones(),
    searchParams,
  ]);

  const initialQuery: Partial<DataTableQuery> = {
    q: params.q,
    sort: params.sort,
    dir: params.dir === "desc" ? "desc" : "asc",
    page: params.page ? Number(params.page) : 1,
    pageSize: params.size ? Number(params.size) : 10,
  };

  return <ShippingManager zones={zones} initialQuery={initialQuery} />;
}
