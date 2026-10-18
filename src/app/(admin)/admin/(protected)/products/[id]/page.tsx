import { notFound, redirect } from "next/navigation";

import { ProductEditor } from "@/components/admin/products/product-editor";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import { getAdminProduct, listRelationOptions } from "@/server/products";
import { listSwatchLibrary } from "@/server/swatches";

export const instant = false;

export const metadata = { title: "Edit product" };

// The tabbed product editor (plan 9c.8). Catalog roles (owner/manager/inventory)
// reach it; every tab re-checks the role inside its server action. The editor
// loads the full product (all relations) in one read plus the option lists for the
// category/collection pickers and the swatch picker (variants + builder parts).
export default async function EditProductPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}>) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (
    user.role !== "owner" &&
    user.role !== "manager" &&
    user.role !== "inventory"
  ) {
    return (
      <PageHeader
        title="Edit product"
        description="You don't have access to manage products."
      />
    );
  }

  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const product = await getAdminProduct(id);
  if (!product) notFound();

  const [relationOptions, swatchGroups] = await Promise.all([
    listRelationOptions(),
    listSwatchLibrary(),
  ]);

  return (
    <ProductEditor
      product={product}
      relationOptions={relationOptions}
      swatchGroups={swatchGroups}
      initialTab={sp.tab}
    />
  );
}
