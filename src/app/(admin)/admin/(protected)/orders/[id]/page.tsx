import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { OrderDetail } from "@/components/admin/orders/order-detail";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import { getAdminOrder } from "@/server/orders";

export const instant = false;

export const metadata = { title: "Order detail" };

// Order detail (plan 9c.8). Sales roles reach it; every write re-checks the
// role inside its server action and the two fulfilment RPCs. A non-uuid id is
// a notFound, never a database throw.
export default async function OrderDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
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
    user.role !== "sales"
  ) {
    return (
      <PageHeader
        title="Order detail"
        description="You don't have access to manage orders."
      />
    );
  }

  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const order = await getAdminOrder(id);
  if (!order) notFound();

  return <OrderDetail order={order} />;
}
