import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { DataTableQuery } from "@/components/admin/data/data-table";
import { OrdersTable } from "@/components/admin/orders/orders-table";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { countOrdersByStatus, listAdminOrders } from "@/server/orders";

export const instant = false;

export const metadata = { title: "Orders" };

type OrderStatus = Database["public"]["Enums"]["order_status"];
const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

function readStatus(raw?: string): OrderStatus | undefined {
  return STATUSES.includes(raw as OrderStatus)
    ? (raw as OrderStatus)
    : undefined;
}

// Orders is a sales module (owner/manager/sales, mirroring the RLS policy on
// `orders` and the sidebar gate). The pipeline tab arrives as `?status`;
// payment/type filters and search run client-side over the loaded rows, the
// same shape as the quotes inbox.
export default async function OrdersPage({
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
  // this page segment, and the session check reads Date.now internally.
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (
    user.role !== "owner" &&
    user.role !== "manager" &&
    user.role !== "sales"
  ) {
    return (
      <PageHeader
        title="Orders"
        description="You don't have access to manage orders."
      />
    );
  }

  const params = await searchParams;
  const status = readStatus(params.status);

  const [orders, counts] = await Promise.all([
    listAdminOrders(status),
    countOrdersByStatus(),
  ]);

  const initialQuery: Partial<DataTableQuery> = {
    q: params.q,
    sort: params.sort,
    dir: params.dir === "desc" ? "desc" : "asc",
    page: params.page ? Number(params.page) : 1,
    pageSize: params.size ? Number(params.size) : 10,
  };

  return (
    <OrdersTable
      orders={orders}
      counts={counts}
      status={status}
      initialQuery={initialQuery}
    />
  );
}
