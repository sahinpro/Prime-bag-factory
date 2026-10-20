import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { DataTableQuery } from "@/components/admin/data/data-table";
import { ErrorState } from "@/components/admin/data/error-state";
import { BlockedContactsManager } from "@/components/admin/blocked-contacts/blocked-contacts-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/lib/auth";
import { listBlockedContacts } from "@/server/blocked-contacts";

export const instant = false;

export const metadata = { title: "Blocked contacts" };

// Plan 15.2 B4b — owner/manager only. Sales may technically read the rows
// under the Phase 1 RLS policy, but managing the list (and its audit trail)
// is management work; the RPC re-checks the role server-side as well.
export default async function BlockedContactsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Partial<DataTableQuery>>;
}>) {
  // Request-time rendering: the layout's `await connection()` does not cover
  // this page segment, and the session check reads Date.now internally.
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Blocked contacts"
        description="You don't have access to manage the blocklist."
      />
    );
  }

  const initialQuery = await searchParams;
  const contacts = await listBlockedContacts();

  if (contacts === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Blocked contacts"
          description="Phones and IP hashes blocked from checkout and quotes."
        />
        <ErrorState
          title="Could not load the blocklist"
          message="The database did not answer. Check the local stack or try again."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/blocked-contacts">Try again</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <BlockedContactsManager contacts={contacts} initialQuery={initialQuery} />;
}
