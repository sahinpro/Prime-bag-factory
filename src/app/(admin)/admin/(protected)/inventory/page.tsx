import { redirect } from "next/navigation";
import { connection } from "next/server";

import { InventoryManager } from "@/components/admin/inventory/inventory-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import { listInventory } from "@/server/inventory";

export const instant = false;

export const metadata = { title: "Inventory" };

// Inventory module (owner/manager/inventory), mirroring the sidebar gate and the
// staff RLS on product_variants + inventory_movements. `sales` and `customer`
// roles have no read policy on variants, so they never reach the list.
export default async function InventoryPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    q?: string;
    sort?: string;
    dir?: string;
    page?: string;
    size?: string;
    low?: string;
  }>;
}>) {
  // Request-time rendering: the layout's `await connection()` does not cover
  // this page segment, and the session check reads Date.now internally.
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (
    user.role !== "owner" &&
    user.role !== "manager" &&
    user.role !== "inventory"
  ) {
    return (
      <PageHeader
        title="Inventory"
        description="You don't have access to manage inventory."
      />
    );
  }

  const params = await searchParams;
  const variants = await listInventory();

  return (
    <InventoryManager
      variants={variants}
      initialQuery={{
        q: params.q,
        sort: params.sort,
        dir: params.dir === "desc" ? "desc" : "asc",
        page: params.page ? Number(params.page) : 1,
        pageSize: params.size ? Number(params.size) : 25,
        low: params.low === "1",
      }}
    />
  );
}
