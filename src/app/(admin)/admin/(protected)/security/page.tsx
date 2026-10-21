import { redirect } from "next/navigation";
import { connection } from "next/server";

import { SecurityManager } from "@/components/admin/security/security-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import { getRequireMfaFlag, listAllFactors } from "@/lib/mfa";

export const instant = false;

export const metadata = { title: "Security" };

// Two-factor self-service (plan §15 D2, order-of-work step 11). Owner/manager
// only — the same management gate the settings screen uses, re-checked inside
// every action via `requireRole`. Request-time rendering (session + AAL read).
// The page is English-first like the rest of admin: it must not depend on
// next-intl (plan "Admin stays outside [locale] and is English first").
export default async function SecurityPage() {
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Security"
        description="You don't have access to manage two-factor settings."
      />
    );
  }

  const [factors, requireMfa] = await Promise.all([
    listAllFactors(),
    getRequireMfaFlag(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Two-factor authentication for owners and managers."
      />
      <SecurityManager factors={factors} requireMfa={requireMfa} />
    </div>
  );
}
