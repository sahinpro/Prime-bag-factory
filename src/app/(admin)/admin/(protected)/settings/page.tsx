import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CompanyForm } from "@/components/admin/settings/company-form";
import { NotificationForm } from "@/components/admin/settings/notification-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAdminUser } from "@/lib/auth";
import { getAdminSettings } from "@/server/settings";

export const instant = false;

export const metadata = { title: "Settings" };

// Settings (plan §9, order-of-work step 9). Owner/manager only — mirroring the
// "Management can manage settings" RLS; each write re-checks requireRole inside
// the action. Request-time rendering: the layout's connection() does not cover
// this segment and the session check reads Date.now (Next 16 PPR).
export default async function SettingsPage() {
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Settings"
        description="You don't have access to manage settings."
      />
    );
  }

  const settings = await getAdminSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Company profile and notification delivery."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-foreground">
              Company profile
            </h2>
          </CardHeader>
          <CardContent>
            <CompanyForm initial={settings.company} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-foreground">
              Notifications
            </h2>
          </CardHeader>
          <CardContent>
            <NotificationForm initial={settings.notificationCron} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
