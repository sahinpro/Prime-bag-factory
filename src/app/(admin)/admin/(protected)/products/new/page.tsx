import { redirect } from "next/navigation";

import { ProductCreateForm } from "@/components/admin/products/product-create-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";

export const instant = false;

export const metadata = { title: "New product" };

// Creating a product is a catalog action (owner/manager/inventory). This step only
// makes a draft; the tabbed editor is where the rest is configured.
export default async function NewProductPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (
    user.role !== "owner" &&
    user.role !== "manager" &&
    user.role !== "inventory"
  ) {
    return (
      <PageHeader
        title="New product"
        description="You don't have access to manage products."
      />
    );
  }

  return <ProductCreateForm />;
}
