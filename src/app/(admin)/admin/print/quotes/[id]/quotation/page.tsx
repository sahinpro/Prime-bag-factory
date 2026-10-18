import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import {
  PrintRow,
  PrintSection,
  PrintSheet,
} from "@/components/admin/print/print-sheet";
import { getAdminUser } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { getAdminQuote } from "@/server/quotes";
import { getCompanyProfile } from "@/server/settings";

export const instant = false;

export const metadata = { title: "Quotation" };

/**
 * Printable quotation (proforma) with a validity date (plan §10 Phase 4,
 * 9c.5 PrintSheet). Same shell-free, role-gated shape as the spec sheet.
 */
export default async function QuoteQuotationPage({
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
  const total = quote.quoted_amount ?? quote.estimated_total;
  const unit =
    quote.quoted_amount != null && quote.quantity
      ? quote.quoted_amount / quote.quantity
      : quote.estimated_unit_price;
  const description = [
    quote.product_title ?? quote.category_name ?? "Custom bag",
    quote.custom_size ??
      (quote.builder?.size && (quote.builder.size.width || quote.builder.size.height)
        ? `${quote.builder.size.width} × ${quote.builder.size.height}${quote.builder.size.gusset ? ` × ${quote.builder.size.gusset}` : ""} ${quote.builder.size.unit ?? "inch"}`
        : null),
    quote.custom_color ??
      (quote.builder?.colors?.primary?.name
        ? `Color: ${quote.builder.colors.primary.name}`
        : null),
    quote.needs_logo_print ? "With logo printing" : null,
  ]
    .filter(Boolean)
    .join(" — ");
  const issued = new Date();

  return (
    <PrintSheet
      documentTitle="Quotation"
      documentNumber={`PBF-QUO-${ref}`}
      issuedOn={formatDate(issued, "en")}
      company={company}
    >
      <PrintSection title="Bill to">
        <dl>
          <PrintRow label="Company">{quote.company_name ?? "—"}</PrintRow>
          <PrintRow label="Contact">{quote.contact_name}</PrintRow>
          <PrintRow label="Phone">{quote.phone}</PrintRow>
          {quote.email ? <PrintRow label="Email">{quote.email}</PrintRow> : null}
        </dl>
      </PrintSection>

      <PrintSection title="Quoted items">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Quoted items for request {ref}
          </caption>
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Description
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Quantity
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Unit price
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black/40 align-top">
              <td className="py-2 pr-3">{description}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {quote.quantity != null
                  ? `${quote.quantity.toLocaleString("en-US")} pcs`
                  : "—"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {unit != null ? formatMoney(unit, "en") : "—"}
              </td>
              <td className="py-2 text-right tabular-nums">
                {total != null ? formatMoney(total, "en") : "To be confirmed"}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="py-2 text-right font-semibold">
                Total
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {total != null ? formatMoney(total, "en") : "—"}
              </td>
            </tr>
          </tbody>
        </table>
        {total != null && quote.quoted_amount == null ? (
          <p className="mt-2 text-xs text-black/70">
            Indicative builder estimate — final price subject to confirmation.
          </p>
        ) : null}
      </PrintSection>

      <PrintSection title="Terms">
        <dl>
          <PrintRow label="Validity">
            {quote.valid_until
              ? `This quotation is valid until ${formatDate(new Date(quote.valid_until), "en")}.`
              : "Quoted prices are valid until confirmed in the order."}
          </PrintRow>
          <PrintRow label="Delivery">
            {quote.needed_by
              ? `Target delivery ${formatDate(new Date(quote.needed_by), "en")} — to be confirmed.`
              : "Delivery timeline to be confirmed with the order."}
          </PrintRow>
          <PrintRow label="Payment">Advance and balance terms to be agreed before production.</PrintRow>
          <PrintRow label="Currency">All amounts in Bangladeshi Taka (BDT).</PrintRow>
        </dl>
      </PrintSection>

      <PrintSection title="Authorization">
        <div className="grid grid-cols-2 gap-10 pt-6 text-sm">
          <div className="border-t border-black pt-1">
            For {company.name}
          </div>
          <div className="border-t border-black pt-1">
            Accepted by {quote.company_name ?? quote.contact_name}
          </div>
        </div>
      </PrintSection>
    </PrintSheet>
  );
}
