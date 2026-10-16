import { connection } from "next/server";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

export const instant = false;

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const profile = await getCurrentProfile();

  if (!profile || profile.role === "customer") {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
