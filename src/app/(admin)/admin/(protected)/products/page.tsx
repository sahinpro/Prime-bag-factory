import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { DataTableQuery } from "@/components/admin/data/data-table";
import { ProductsTable } from "@/components/admin/products/products-table";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { countProductsByStatus, listAdminProducts } from "@/server/products";

export const instant = false;

export const metadata = { title: "Products" };

type ProductStatus = Database["public"]["Enums"]["product_status"];
const STATUSES: ProductStatus[] = ["published", "draft", "archived"];

function readStatus(raw?: string): ProductStatus | undefined {
  return STATUSES.includes(raw as ProductStatus)
    ? (raw as ProductStatus)
    : undefined;
}

// Products is a catalog module (owner/manager/inventory, mirroring the
// `has_role(['owner','manager','inventory'])` product policy and the sidebar
// gate). The status tab arrives as `?status`; the read is scoped server-side,
// while search + the type/stock/custom filters run client-side over the loaded
// rows (the same shape as Collections). Sort/page/search seed the table so state
// survives reload and share.
export default async function ProductsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    status?: string;
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

  if (
    user.role !== "owner" &&
    user.role !== "manager" &&
    user.role !== "inventory"
  ) {
    return (
      <PageHeader
        title="Products"
        description="You don't have access to manage products."
      />
    );
  }

  const params = await searchParams;
  const status = readStatus(params.status);

  const [products, counts] = await Promise.all([
    listAdminProducts(status),
    countProductsByStatus(),
  ]);

  const initialQuery: Partial<DataTableQuery> = {
    q: params.q,
    sort: params.sort,
    dir: params.dir === "desc" ? "desc" : "asc",
    page: params.page ? Number(params.page) : 1,
    pageSize: params.size ? Number(params.size) : 10,
  };

  return (
    <ProductsTable
      products={products}
      counts={counts}
      status={status}
      initialQuery={initialQuery}
    />
  );
}
