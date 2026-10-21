import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Server-only reads for the Shipping zones module (plan E2). The signed-in staff
 * session rides the cookie client, so `has_role(['owner','manager'])` RLS decides
 * visibility (owner/manager read every row incl. inactive). Mutations are NOT here —
 * they live in `app/(admin)/admin/shipping/actions.ts`. The public checkout read is
 * a separate, anon-client helper in `server/checkout.ts` (`listShippingZones`);
 * this module is admin-only and intentionally uncached so staff always see their
 * own latest save.
 */

export type AdminShippingZone = {
  id: string;
  name_en: string;
  name_bn: string | null;
  fee: number;
  free_over: number | null;
  is_active: boolean;
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/** Every zone (active and inactive), cheapest first — the admin table order. */
export async function listAdminShippingZones(): Promise<AdminShippingZone[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipping_zones")
    .select("id, name_en, name_bn, fee, free_over, is_active")
    .order("fee", { ascending: true })
    .order("name_en", { ascending: true });

  if (error) {
    throw new Error("Failed to load shipping zones.", { cause: error });
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name_en: row.name_en,
    name_bn: row.name_bn ?? null,
    fee: num(row.fee),
    free_over: row.free_over == null ? null : num(row.free_over),
    is_active: row.is_active,
  }));
}
