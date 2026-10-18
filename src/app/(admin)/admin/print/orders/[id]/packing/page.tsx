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
import { formatDate, formatNumber } from "@/lib/format";
import { getAdminOrder } from "@/server/orders";
import { getCompanyProfile } from "@/server/settings";

export const instant = false;

export const metadata = { title: "Packing slip" };

/**
 * Packing slip for the warehouse table (plan 9c.5 PrintSheet): what goes in the
 * box and where it goes. Deliberately no prices — the packer's copy.
 */
export default async function OrderPackingPage({
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
  const unitCount = order.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <PrintSheet
      documentTitle="Packing slip"
      documentNumber={order.order_no}
      issuedOn={formatDate(new Date(order.created_at), "en")}
      company={company}
      backHref={`/admin/orders/${order.id}`}
      backLabel="Back to order"
    >
      <PrintSection title="Ship to">
        <dl>
          <PrintRow label="Name">{order.customer_name}</PrintRow>
          <PrintRow label="Phone">{order.customer_phone}</PrintRow>
          <PrintRow label="Address">{address || "—"}</PrintRow>
          <PrintRow label="Zone">{order.zone_name ?? "—"}</PrintRow>
          <PrintRow label="Courier">
            {order.courier_name ?? "To be assigned"}
          </PrintRow>
          <PrintRow label="Tracking">
            {order.tracking_code ?? "Not yet shipped"}
          </PrintRow>
        </dl>
      </PrintSection>

      <PrintSection title="Contents">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Contents of the shipment for order {order.order_no}
          </caption>
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Item
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Colour / size
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Code
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr
                key={line.id}
                className="border-b border-neutral-400 align-top"
              >
                <td className="py-2 pr-3">{line.title}</td>
                <td className="py-2 pr-3">
                  {[line.color, line.size].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="py-2 pr-3 text-right">{line.sku ?? "—"}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(line.qty, "en")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm">
          Total pieces: <strong>{formatNumber(unitCount, "en")}</strong> ·
          Lines: {formatNumber(order.lines.length, "en")}
        </p>
      </PrintSection>

      <PrintSection title="Before sealing">
        <PrintChecklist
          items={[
            "Count every line against this slip",
            "Check colour and size against the order",
            "Attach the invoice copy for the customer",
            "Write the order number on the box",
          ]}
        />
      </PrintSection>

      {order.customer_note ? (
        <PrintSection title="Customer note">
          <p className="text-sm">{order.customer_note}</p>
        </PrintSection>
      ) : null}
    </PrintSheet>
  );
}
