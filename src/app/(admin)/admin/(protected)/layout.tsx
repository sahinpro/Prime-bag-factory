import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/shell/admin-shell";
import { getAdminUser } from "@/lib/auth";
import { listAdminAlerts } from "@/server/notifications";

export const instant = false;

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const [user, alerts] = await Promise.all([
    getAdminUser(),
    listAdminAlerts(),
  ]);

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <AdminShell user={user} alerts={alerts}>
      {children}
    </AdminShell>
  );
}
