import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import {
  PrintChecklist,
  PrintRow,
  PrintSection,
  PrintSheet,
} from "@/components/admin/print/print-sheet";
import { getAdminUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getAdminQuote } from "@/server/quotes";
import { getCompanyProfile } from "@/server/settings";

export const instant = false;

export const metadata = { title: "Production spec sheet" };

/** Color name + hex as a plain print-safe string (no admin tokens on paper). */
function colorText(name?: string | null, hex?: string | null): string | null {
  if (!name && !hex) return null;
  return [name ?? "Unnamed", hex].filter(Boolean).join(" ");
}

/**
 * Printable production spec sheet (plan 9c.5 PrintSheet, §10 Phase 4).
 * Renders outside the admin shell so the paper has no chrome; gated by the
 * same sales roles with a fresh session check on this segment.
 */
export default async function QuoteSpecSheetPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  if (
    user.role !== "owner" &&
    user.role !== "manager" &&
    user.role !== "sales"
  ) {
    redirect("/admin");
  }

  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const [quote, company] = await Promise.all([
    getAdminQuote(id),
    getCompanyProfile(),
  ]);
  if (!quote) notFound();

  const ref = quote.id.slice(0, 8).toUpperCase();
  const builder = quote.builder;
  const size =
    quote.custom_size ??
    (builder?.size && (builder.size.width || builder.size.height)
      ? `${builder.size.width} × ${builder.size.height}${builder.size.gusset ? ` × ${builder.size.gusset}` : ""} ${builder.size.unit ?? "inch"}`
      : null);
  const primary = colorText(
    builder?.colors?.primary?.name,
    builder?.colors?.primary?.hex,
  );
  const handle = colorText(
    builder?.colors?.handle?.name,
    builder?.colors?.handle?.hex,
  );

  return (
    <PrintSheet
      documentTitle="Production Spec Sheet"
      documentNumber={`PBF-Q-${ref}`}
      issuedOn={formatDate(new Date(), "en")}
      company={company}
    >
      <PrintSection title="Customer">
        <dl>
          <PrintRow label="Company">{quote.company_name ?? "—"}</PrintRow>
          <PrintRow label="Contact">{quote.contact_name}</PrintRow>
          <PrintRow label="Phone">{quote.phone}</PrintRow>
          {quote.email ? (
            <PrintRow label="Email">{quote.email}</PrintRow>
          ) : null}
        </dl>
      </PrintSection>

      <PrintSection title="Product">
        <dl>
          <PrintRow label="Request">
            {quote.product_title ?? quote.category_name ?? "Custom bag"}
          </PrintRow>
          <PrintRow label="Source">
            {quote.source === "builder" ? "Custom Bag Builder" : "Quote form"}
          </PrintRow>
          <PrintRow label="Quantity">
            {quote.quantity != null
              ? `${quote.quantity.toLocaleString("en-US")} pcs`
              : "—"}
          </PrintRow>
          <PrintRow label="Needed by">
            {quote.needed_by
              ? formatDate(new Date(quote.needed_by), "en")
              : "—"}
          </PrintRow>
          <PrintRow label="Size">{size ?? "Standard"}</PrintRow>
          <PrintRow label="Body color">{primary ?? "—"}</PrintRow>
          <PrintRow label="Handle color">{handle ?? "—"}</PrintRow>
          {quote.custom_color && !primary ? (
            <PrintRow label="Color (as requested)">
              {quote.custom_color}
            </PrintRow>
          ) : null}
          <PrintRow label="Material">{builder?.material ?? "—"}</PrintRow>
          <PrintRow label="Printing">
            {quote.needs_logo_print || builder?.printing
              ? [
                  builder?.printing?.method,
                  builder?.printing?.text
                    ? `Text: "${builder.printing.text}"`
                    : null,
                  quote.needs_logo_print ? "Logo printing requested" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "None"}
          </PrintRow>
          {builder?.printing?.artwork ? (
            <PrintRow label="Print artwork">
              {builder.printing.artwork}
            </PrintRow>
          ) : null}
          {quote.attachment_path ? (
            <PrintRow label="Customer attachment">
              {quote.attachment_path}
            </PrintRow>
          ) : null}
          {quote.message ? (
            <PrintRow label="Customer message">
              <span className="whitespace-pre-wrap">{quote.message}</span>
            </PrintRow>
          ) : null}
          {quote.internal_notes ? (
            <PrintRow label="Internal notes">
              <span className="whitespace-pre-wrap">
                {quote.internal_notes}
              </span>
            </PrintRow>
          ) : null}
        </dl>
      </PrintSection>

      <PrintSection title="Production checklist">
        <PrintChecklist
          items={[
            "Fabric and colors match the approved swatches",
            "Dimensions verified against the request",
            "Artwork proof approved by the customer",
            "Handle strength test passed",
            "Stitching and finishing QC passed",
            `Quantity packed: ${quote.quantity != null ? `${quote.quantity.toLocaleString("en-US")} pcs` : "see request"}`,
          ]}
        />
      </PrintSection>

      <PrintSection title="Sign-off">
        <dl>
          <PrintRow label="Prepared by">{user.fullName}</PrintRow>
          <PrintRow label="Production manager">{"\u00A0"}</PrintRow>
          <PrintRow label="QC">{"\u00A0"}</PrintRow>
        </dl>
      </PrintSection>
    </PrintSheet>
  );
}
