import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { DataTableQuery } from "@/components/admin/data/data-table";
import { QuotesTable } from "@/components/admin/quotes/quotes-table";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import {
  countQuotesByStatus,
  listAdminQuotes,
  listAssignableStaff,
} from "@/server/quotes";

export const instant = false;

export const metadata = { title: "Quotes" };

type QuoteStatus = Database["public"]["Enums"]["quote_status"];
const STATUSES: QuoteStatus[] = [
  "new",
  "contacted",
  "quoted",
  "won",
  "lost",
];

function readStatus(raw?: string): QuoteStatus | undefined {
  return STATUSES.includes(raw as QuoteStatus)
    ? (raw as QuoteStatus)
    : undefined;
}

// Quotes is a sales module (owner/manager/sales, mirroring the
// `has_role(['owner','manager','sales'])` quote policy and the sidebar gate).
// The pipeline tab arrives as `?status`; source/assignee filters and search run
// client-side over the loaded rows (the same shape as Products). Sort/page/search
// seed the table so state survives reload and share.
export default async function QuotesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    status?: string;
    q?: string;
    sort?: string;
    dir?: string;
    page?: string;
    size?: string;
  }>;
}>) {
  // Request-time rendering: the layout's `await connection()` does not cover
  // this page segment, and the session check reads Date.now internally.
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (
    user.role !== "owner" &&
    user.role !== "manager" &&
    user.role !== "sales"
  ) {
    return (
      <PageHeader
        title="Quotes"
        description="You don't have access to manage quotes."
      />
    );
  }

  const params = await searchParams;
  const status = readStatus(params.status);

  const [quotes, counts, staff] = await Promise.all([
    listAdminQuotes(status),
    countQuotesByStatus(),
    listAssignableStaff(),
  ]);

  const initialQuery: Partial<DataTableQuery> = {
    q: params.q,
    sort: params.sort,
    dir: params.dir === "desc" ? "desc" : "asc",
    page: params.page ? Number(params.page) : 1,
    pageSize: params.size ? Number(params.size) : 10,
  };

  return (
    <QuotesTable
      quotes={quotes}
      counts={counts}
      staff={staff}
      status={status}
      initialQuery={initialQuery}
    />
  );
}
