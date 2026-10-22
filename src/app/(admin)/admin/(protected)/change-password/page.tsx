import { PageHeader } from "@/components/admin/shell/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";

export const instant = false;

export const metadata = { title: "Change password" };

// Change password (owner track, 2026-10-22). Any signed-in staff role — the
// action re-checks requireRole. Reached from the user menu, not the nav, so it
// is deliberately not a NAV_GROUPS entry.
export default function ChangePasswordPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Change password"
        description="Update the password for your admin account."
      />

      <Card className="max-w-lg">
        <CardHeader>
          <h2 className="text-sm font-medium text-foreground">
            New password
          </h2>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
