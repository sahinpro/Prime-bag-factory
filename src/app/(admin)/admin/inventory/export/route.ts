import { requireRole } from "@/lib/auth";
import { listInventory } from "@/server/inventory";

/**
 * Plan §9 Inventory / 15.2 E1 — CSV export of the current stock position. A GET
 * route handler (not a server action) so the browser downloads it directly. The
 * route group does not run the protected layout, so the role is re-checked here;
 * the data itself is the same derived list the page shows (RLS-scoped read).
 */

const INVENTORY_ROLES = ["owner", "manager", "inventory"] as const;

function csvCell(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  try {
    await requireRole(INVENTORY_ROLES);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await listInventory();
  if (rows === null) {
    return new Response("Could not load inventory.", { status: 500 });
  }

  const header = [
    "sku",
    "product",
    "color",
    "size",
    "stock_mode",
    "stock_qty",
    "reserved_qty",
    "available",
    "low_stock_threshold",
    "status",
    "active",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.sku,
        r.product_title,
        r.color_name ?? "",
        r.size ?? "",
        r.stock_mode,
        r.stock_qty,
        r.reserved_qty,
        r.available,
        r.low_stock_threshold,
        r.status,
        r.is_active ? "yes" : "no",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${stamp}.csv"`,
    },
  });
}
