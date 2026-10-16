import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

export const instant = false;

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentProfile();

  if (!profile || profile.role === "customer") {
    redirect("/admin/login");
  }

  // Wrap protected admin pages in the AdminShell (sidebar + topbar).
  // The shell is a client component; children are the server-rendered page content.
  return <AdminShell>{children}</AdminShell>;
}
