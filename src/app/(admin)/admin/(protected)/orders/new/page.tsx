import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ErrorState } from "@/components/admin/data/error-state";
import { NewOrderForm } from "@/components/admin/orders/new-order-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/auth";
import {
  listAdminOrderZones,
  listOrderableVariants,
} from "@/server/admin-orders";

export const instant = false;

export const metadata = { title: "New order" };

// Admin-created orders (plan 15.2 E3). Sales reach the form; discount and
// price-override inputs render only for owner/manager (the same split the
// `admin_create_order` RPC enforces, so the UI never offers a control that the
// database would reject). Reads that feed the picker go through the staff client.
export default async function NewOrderPage() {
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
        title="New order"
        description="You don't have access to manage orders."
      />
    );
  }

  const [variants, zones] = await Promise.all([
    listOrderableVariants(),
    listAdminOrderZones(),
  ]);

  if (variants === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="New order"
          description="Record a phone, WhatsApp or walk-in order."
        />
        <ErrorState
          title="Couldn't load products"
          message="The catalog could not be read. Try again in a moment."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/orders/new">
                <RefreshCw
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Retry
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <NewOrderForm
      variants={variants}
      zones={zones}
      canOverride={user.role === "owner" || user.role === "manager"}
    />
  );
}
