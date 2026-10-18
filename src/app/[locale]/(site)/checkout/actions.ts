"use server";

import { createPublicClient } from "@/lib/supabase/server";
import { checkoutSchema, orderLookupSchema } from "@/lib/validators/checkout";
import { loadCartLines } from "@/server/cart";
import { getCheckoutFlags } from "@/server/checkout";
import { findOrderForLookup, type PublicOrder } from "@/server/orders";

/**
 * Public checkout (plan Phase 5 task 2). Orders are written ONLY through the
 * `place_order` RPC — it holds the advisory lock on the idempotency key, re-prices
 * the cart from the DB, enforces MOQ/tiers/stock, applies the zone fee, reserves
 * stock and writes the movement rows. Nothing here computes money, and the anon
 * client is used on purpose: the RPC is granted to anon, the service-role key is
 * reserved for the order *read* path (RLS gives customers no direct select).
 * Field/form failures come back as stable codes for the client to localize.
 */

export type CheckoutResult =
  | { ok: true; orderNo: string }
  | { ok: false; fieldErrors?: Record<string, string>; formError?: string };

export type OrderLookupResult =
  | { ok: true; order: PublicOrder }
  | { ok: false; formError: string };

/**
 * Every message `place_order` raises, mapped to a stable code (the RPC is the
 * only writer, so this list is its contract). Anything unrecognised degrades to
 * a generic retry message rather than leaking SQL text to the customer.
 */
function codeForRpcError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("moq")) return "errMoq";
  if (m.includes("insufficient stock")) return "errStock";
  if (m.includes("price tier")) return "errTier";
  if (m.includes("shipping zone")) return "errZone";
  if (m.includes("buy-now")) return "errQuoteOnlyItem";
  if (m.includes("variant not found") || m.includes("not published")) {
    return "errStaleCart";
  }
  if (m.includes("valid variant_id")) return "errStaleCart";
  if (m.includes("items are required")) return "errEmptyCart";
  if (m.includes("name and phone")) return "errCustomerFields";
  if (m.includes("idempotency")) return "errIdempotency";
  if (m.includes("retail") || m.includes("cash on delivery")) {
    return "errMethodClosed";
  }
  if (m.includes("daily order number")) return "errDailyLimit";
  return "errGeneric";
}

export async function placeCheckoutOrder(
  payload: unknown,
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!fieldErrors[field]) {
        fieldErrors[field] =
          issue.code === "custom" ? issue.message : "errRequired";
      }
    }
    return { ok: false, fieldErrors };
  }
  const data = parsed.data;

  // Honeypot: pretend success so a bot learns nothing.
  if (data.website !== "") return { ok: true, orderNo: "" };

  const flags = await getCheckoutFlags();
  if (flags.maintenance_mode || !flags.checkout_enabled) {
    return { ok: false, formError: "errClosed" };
  }
  if (!flags.cod_enabled) return { ok: false, formError: "errCodClosed" };

  // Re-read the cart server-side: an unknown/inactive variant, or a quote-only
  // product smuggled in from a stale tab, is rejected before the RPC runs.
  const requested = new Set(data.items.map((item) => item.variant_id));
  const { lines, missing } = await loadCartLines([...requested]);
  if (missing.length > 0 || lines.length !== requested.size) {
    return { ok: false, formError: "errStaleCart" };
  }
  if (lines.some((line) => line.productType !== "buy_now")) {
    return { ok: false, formError: "errQuoteOnlyItem" };
  }

  const supabase = createPublicClient();
  const { data: orderNo, error } = await supabase.rpc("place_order", {
    payload: {
      items: data.items,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email ?? null,
      division: data.division ?? null,
      district: data.district,
      area: data.area,
      address_line: data.address_line,
      shipping_zone_id: data.shipping_zone_id,
      customer_note: data.customer_note ?? null,
      type: "retail",
      payment_method: "cod",
      idempotency_key: data.idempotency_key,
    },
  });

  if (error || !orderNo) {
    return {
      ok: false,
      formError: codeForRpcError(error?.message ?? "unknown"),
    };
  }

  return { ok: true, orderNo: String(orderNo) };
}

/**
 * Order lookup by order number + the phone it was placed with (plan 8). Both
 * halves must match, so this is a status page, not an enumeration oracle; the
 * failure message stays identical whichever one was wrong.
 */
export async function lookupOrder(
  payload: unknown,
): Promise<OrderLookupResult> {
  const parsed = orderLookupSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, formError: "errNotFound" };
  }
  const order = await findOrderForLookup(
    parsed.data.order_no,
    parsed.data.customer_phone,
  );
  if (!order) return { ok: false, formError: "errNotFound" };
  return { ok: true, order };
}
