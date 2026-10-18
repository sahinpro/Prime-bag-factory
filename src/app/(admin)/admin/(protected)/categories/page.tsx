import { redirect } from "next/navigation";

import { CategoriesManager } from "@/components/admin/categories/categories-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import { listAdminCategories } from "@/server/categories";

export const instant = false;

export const metadata = { title: "Categories" };

// Categories is owner/manager only (mirrors the `has_role(['owner','manager'])`
// catalog policy and the sidebar gate). The read uses the cookie session; writes
// re-check the role inside each server action.
export default async function CategoriesPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Categories"
        description="You don't have access to manage categories."
      />
    );
  }

  const categories = await listAdminCategories();
  return <CategoriesManager categories={categories} />;
}
