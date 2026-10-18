import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import {
  PrintRow,
  PrintSection,
  PrintSheet,
} from "@/components/admin/print/print-sheet";
import { getAdminUser } from "@/lib/auth";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { getAdminOrder } from "@/server/orders";
import { getCompanyProfile } from "@/server/settings";

export const instant = false;

export const metadata = { title: "Invoice" };

/**
 * Printable invoice for a placed order (plan 9c.5 PrintSheet, Phase 5 task 3).
 * Every number comes from the order row and the payments ledger — nothing is
 * re-priced here, and the advance/balance lines mirror what the customer sees on
 * their status page.
 */
export default async function OrderInvoicePage({
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
  const [order, company] = await Promise.all([
    getAdminOrder(id),
    getCompanyProfile(),
  ]);
  if (!order) notFound();

  const address = [
    order.address_line,
    order.area,
    order.district,
    order.division,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <PrintSheet
      documentTitle="Invoice"
      documentNumber={order.order_no}
      issuedOn={formatDate(new Date(order.created_at), "en")}
      company={company}
      backHref={`/admin/orders/${order.id}`}
      backLabel="Back to order"
    >
      <PrintSection title="Billed to">
        <dl>
          <PrintRow label="Name">{order.customer_name}</PrintRow>
          <PrintRow label="Phone">{order.customer_phone}</PrintRow>
          {order.customer_email ? (
            <PrintRow label="Email">{order.customer_email}</PrintRow>
          ) : null}
          <PrintRow label="Address">{address || "—"}</PrintRow>
          <PrintRow label="Shipping zone">
            {order.zone_name ?? "Not set"}
          </PrintRow>
        </dl>
      </PrintSection>

      <PrintSection title="Items">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Items invoiced on order {order.order_no}
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
            {order.lines.map((line) => (
              <tr
                key={line.id}
                className="border-b border-neutral-400 align-top"
              >
                <td className="py-2 pr-3">
                  {line.title}
                  <span className="block text-xs text-neutral-700">
                    {[line.sku, line.color, line.size]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatNumber(line.qty, "en")}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatMoney(line.unit_price, "en")}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(line.line_total, "en")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintSection>

      <PrintSection title="Payment">
        <dl>
          <PrintRow label="Subtotal">
            {formatMoney(order.subtotal, "en")}
          </PrintRow>
          <PrintRow label="Shipping">
            {order.shipping_fee > 0
              ? formatMoney(order.shipping_fee, "en")
              : "Free"}
          </PrintRow>
          {order.discount > 0 ? (
            <PrintRow label="Discount">
              {formatMoney(-order.discount, "en")}
            </PrintRow>
          ) : null}
          {order.vat_amount > 0 ? (
            <PrintRow label="VAT">
              {formatMoney(order.vat_amount, "en")}
            </PrintRow>
          ) : null}
          <PrintRow label="Total">
            <strong>{formatMoney(order.total, "en")}</strong>
          </PrintRow>
          <PrintRow label="50% advance due">
            {formatMoney(order.advance_due, "en")}
          </PrintRow>
          <PrintRow label="Received so far">
            {formatMoney(order.paid, "en")}
          </PrintRow>
          <PrintRow label="Balance on delivery">
            <strong>{formatMoney(order.balance, "en")}</strong>
          </PrintRow>
        </dl>
      </PrintSection>

      <PrintSection title="Terms">
        <dl>
          <PrintRow label="Payment method">
            Cash on delivery with a 50% advance. Production or dispatch starts
            once the advance is received.
          </PrintRow>
          <PrintRow label="Confirmation">
            We call {order.customer_phone} to confirm this order before it is
            dispatched.
          </PrintRow>
          <PrintRow label="Currency">
            All amounts in Bangladeshi Taka (BDT).
          </PrintRow>
          {order.tracking_code ? (
            <PrintRow label="Tracking">
              {order.courier_name ?? "Courier"} · {order.tracking_code}
            </PrintRow>
          ) : null}
        </dl>
      </PrintSection>

      <PrintSection title="Authorization">
        <div className="grid grid-cols-2 gap-10 pt-6 text-sm">
          <div className="border-t border-black pt-1">For {company.name}</div>
          <div className="border-t border-black pt-1">
            Received by {order.customer_name}
          </div>
        </div>
      </PrintSection>
    </PrintSheet>
  );
}
