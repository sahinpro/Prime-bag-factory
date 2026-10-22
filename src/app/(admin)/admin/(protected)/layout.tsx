import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/shell/admin-shell";
import { getAdminUser } from "@/lib/auth";
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

  return (
    <AdminShell user={user} alerts={alerts} counts={counts}>
      {children}
    </AdminShell>
  );
}
