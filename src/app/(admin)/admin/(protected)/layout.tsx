import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/shell/admin-shell";
import { getAdminUser } from "@/lib/auth";
import { adminNeedsMfaChallenge } from "@/lib/mfa";
import { getAdminNavCounts } from "@/server/admin-counts";
import { listAdminAlerts } from "@/server/notifications";

export const instant = false;

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const [user, alerts, counts] = await Promise.all([
    getAdminUser(),
    listAdminAlerts(),
    getAdminNavCounts(),
  ]);

  if (!user) {
    redirect("/admin/login");
  }

  // D2: when MFA enforcement is on (`settings.security.require_mfa`), an
  // owner/manager session below AAL2 is sent to the challenge page. With the
  // flag off this is always false, so the shell renders exactly as before.
  if (await adminNeedsMfaChallenge(user)) {
    redirect("/admin/mfa");
  }

  return (
    <AdminShell user={user} alerts={alerts} counts={counts}>
      {children}
    </AdminShell>
  );
}
