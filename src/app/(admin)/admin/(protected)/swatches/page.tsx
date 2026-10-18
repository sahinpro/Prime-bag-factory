import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/shell/page-header";
import { SwatchesManager } from "@/components/admin/swatches/swatches-manager";
import { getAdminUser } from "@/lib/auth";
import { listSwatchLibrary } from "@/server/swatches";

export const instant = false;

export const metadata = { title: "Swatch Library" };

// Swatch Library is owner/manager only (mirrors the sidebar gate; writes re-check
// the role inside each server action). The whole library loads in one read and
// group tab switching is client-side, so there are no URL params here.
export default async function SwatchesPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Swatch Library"
        description="You don't have access to manage swatches."
      />
    );
  }

  const groups = await listSwatchLibrary();
  return <SwatchesManager groups={groups} />;
}
