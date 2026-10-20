import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CustomersManager } from "@/components/admin/customers/customers-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import { listCustomers } from "@/server/customers";

export const instant = false;

export const metadata = { title: "Customers" };

// Sales module (owner/manager/sales), mirroring the sidebar gate and the RLS
// on the two source tables — the directory is derived from orders + quotes,
// so anyone who can see both can see the directory. No filters ride the URL
// beyond the DataTable's own `page`/`sort`/`q`.
export default async function CustomersPage({
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
        title="Customers"
        description="You don't have access to the customer directory."
      />
    );
  }

  const params = await searchParams;
  const customers = await listCustomers();

  return (
    <CustomersManager
      customers={customers}
      initialQuery={{
        q: params.q,
        sort: params.sort,
        dir: params.dir === "desc" ? "desc" : "asc",
        page: params.page ? Number(params.page) : 1,
        pageSize: params.size ? Number(params.size) : 10,
      }}
    />
  );
}
