import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { QuoteDetail } from "@/components/admin/quotes/quote-detail";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import {
  createAttachmentReadUrl,
  findConvertedOrderId,
  getAdminQuote,
  listAssignableStaff,
} from "@/server/quotes";

export const instant = false;

export const metadata = { title: "Quote detail" };

// Quote detail (plan 9c.8). Sales roles reach it; every write re-checks the
// role inside its server action. Invalid uuid → notFound (never a DB throw).
export default async function QuoteDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  // Request-time rendering: the layout's `await connection()` does not cover
  // this page segment, and the session check reads Date.now internally
  // (Next 16 PPR "blocking-prerender-current-time").
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
        title="Quote detail"
        description="You don't have access to manage quotes."
      />
    );
  }

  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const canConvert = user.role === "owner" || user.role === "manager";
  const [quote, staff, convertedOrderId] = await Promise.all([
    getAdminQuote(id),
    listAssignableStaff(),
    // Only owners/managers convert, but any staff reader can see a past link.
    findConvertedOrderId(id),
  ]);
  if (!quote) notFound();

  // Private artwork (plan 15.2 B6): a short-lived signed GET URL minted
  // server-side so staff can open the file without a public URL ever existing.
  const attachmentUrl = await createAttachmentReadUrl(quote.attachment_path);

  return (
    <QuoteDetail
      quote={quote}
      staff={staff}
      attachmentUrl={attachmentUrl}
      canConvert={canConvert}
      convertedOrderId={convertedOrderId}
    />
  );
}
