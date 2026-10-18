import "server-only";

import { createPublicClient } from "@/lib/supabase/server";

/**
 * Checkout support reads (plan Phase 5 task 2): the feature flags that gate the
 * ordering path and the shipping zones the customer chooses from. Zone fees are
 * public by RLS ("Public can read active shipping zones"), so these go through
 * the anon client — no service-role key on the read path.
 */

export type CheckoutFlags = {
  checkout_enabled: boolean;
  cod_enabled: boolean;
  custom_order_mode: string;
  maintenance_mode: boolean;
};

/**
 * Flags live in `settings.value` under the `checkout` key (plan §7). Until the
 * Settings admin module ships, a missing or unreadable row means "ordering is
 * on" — failing closed would take the whole commerce path down over one absent
 * config row. `maintenance_mode` is read here too so the flag has one home.
 */
const OPEN: CheckoutFlags = {
  checkout_enabled: true,
  cod_enabled: true,
  custom_order_mode: "quote",
  maintenance_mode: false,
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export async function getCheckoutFlags(): Promise<CheckoutFlags> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "checkout")
    .maybeSingle();
  if (error || !data) return OPEN;
  const value = (data.value ?? {}) as Record<string, unknown>;
  return {
    checkout_enabled: bool(value.checkout_enabled, OPEN.checkout_enabled),
    cod_enabled: bool(value.cod_enabled, OPEN.cod_enabled),
    custom_order_mode:
      typeof value.custom_order_mode === "string"
        ? value.custom_order_mode
        : OPEN.custom_order_mode,
    maintenance_mode: bool(value.maintenance_mode, OPEN.maintenance_mode),
  };
}

export type ShippingZone = {
  id: string;
  nameEn: string;
  nameBn: string | null;
  fee: number;
  freeOver: number | null;
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/** Active zones, cheapest first — the order the customer sees on the form. */
export async function listShippingZones(): Promise<ShippingZone[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shipping_zones")
    .select("id, name_en, name_bn, fee, free_over, is_active")
    .eq("is_active", true)
    .order("fee", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[])
    .map((row) => ({
      id: String(row.id),
      nameEn: String(row.name_en ?? ""),
      nameBn: typeof row.name_bn === "string" ? row.name_bn : null,
      fee: num(row.fee),
      freeOver: row.free_over == null ? null : num(row.free_over),
    }))
    .filter((zone) => zone.id !== "" && zone.nameEn !== "");
}
