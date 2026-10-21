"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireRole } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { adminCreateOrderSchema } from "@/lib/validators/admin-order";
import {
  orderBlockSchema,
  orderNoteSchema,
  orderShippingSchema,
  recordPaymentSchema,
  setOrderStatusSchema,
  setProductionStatusSchema,
} from "@/lib/validators/order-admin";
import { normalizePhone } from "@/server/abuse";
import { phoneIsBlocked } from "@/server/admin-orders";
import { logAudit } from "@/server/audit";

/**
 * Admin order fulfilment (plan §9 Orders, Phase 5 task 3). Same shape as the
 * quote actions: requireRole → zod → write → revalidate. Status changes and
 * payments go through the `security definer` Postgres functions added in
 * `202610180002_phase5_order_fulfilment.sql` because they move stock and money
 * across several tables in one transaction — a `sales` user has no RLS right to
 * write `product_variants`, and the functions re-check `has_role()` themselves.
 * Courier details and the internal note are single-column edits, so they stay
 * direct writes under the existing staff policy.
 */

const ORDER_ROLES = ["owner", "manager", "sales"] as const;

export type OrderActionResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "You are not authorized to manage orders.";

function denied(): OrderActionResult {
  return { ok: false, error: NOT_ALLOWED };
}

function revalidate(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  // Any status/fulfilment move can change the pending-order sidebar badge.
  revalidateTag(CACHE_TAGS.adminCounts, "max");
}

/**
 * The RPCs raise short, stable codes. Translate them for staff; never show raw
 * Postgres text, and never let an unrecognised failure look like a success.
 */
function fulfilmentError(message: string, fallback: string): string {
  const code = message.trim().split(/\s+/)[0] ?? "";
  switch (code) {
    case "not_allowed":
      return NOT_ALLOWED;
    case "order_not_found":
      return "Order not found.";
    case "cannot_cancel_after_shipment":
      return "This order has already shipped, so it can no longer be cancelled. Use Returned once the customer sends it back.";
    case "cannot_return_before_delivery":
      return "Only a delivered order can be marked as returned.";
    case "production_not_applicable":
      return "Production tracking is only for bulk/custom orders.";
    case "invalid_production_transition":
      return "That production step is not allowed from the current stage — move one step at a time.";
    case "invalid_amount":
      return "Enter a payment amount greater than zero.";
    case "payment_exceeds_balance":
      return "That amount is more than the outstanding balance on this order.";
    default:
      if (
        message.includes("admin_set_order_status") ||
        message.includes("admin_record_payment")
      ) {
        return "The order fulfilment database functions are missing. Apply supabase/migrations/202610180002_phase5_order_fulfilment.sql first.";
      }
      if (message.includes("admin_set_production_status")) {
        return "The production status database function is missing. Apply supabase/migrations/202610210005_f2_production_status.sql first.";
      }
      return fallback;
  }
}

type FulfilmentRpc =
  | {
      fn: "admin_set_order_status";
      args: Database["public"]["Functions"]["admin_set_order_status"]["Args"];
    }
  | {
      fn: "admin_record_payment";
      args: Database["public"]["Functions"]["admin_record_payment"]["Args"];
    }
  | {
      fn: "admin_set_production_status";
      args: Database["public"]["Functions"]["admin_set_production_status"]["Args"];
    };

async function callFulfilmentRpc(
  call: FulfilmentRpc,
  fallback: string,
): Promise<OrderActionResult> {
  const supabase = await createClient();
  // `as never` narrows the two distinct Args objects back onto the overload set
  // that `rpc()` resolves from the function name union.
  const { error } = await supabase.rpc(call.fn, call.args as never);
  if (error) {
    return { ok: false, error: fulfilmentError(error.message, fallback) };
  }
  return { ok: true };
}

export async function setOrderStatus(
  payload: unknown,
): Promise<OrderActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(ORDER_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = setOrderStatusSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const { id, status } = parsed.data;
  const result = await callFulfilmentRpc(
    {
      fn: "admin_set_order_status",
      args: { p_order_id: id, p_to_status: status, p_note: parsed.data.note },
    },
    "Could not change the order status.",
  );
  if (result.ok) {
    // The status RPC writes order_status_history, not the audit trail.
    const supabase = await createClient();
    await logAudit(supabase, {
      actorId,
      action: "order.status",
      tableName: "orders",
      recordId: id,
      diff: { to_status: status },
    });
    revalidate(id);
  }
  return result;
}

/**
 * Plan 15.2 F2 — move a bulk/custom order along the production pipeline. The
 * RPC owns the transition legality, the `audit_logs` row and the admin-bell
 * notification (all in one transaction), so this action does NOT call
 * `logAudit` — see server/audit.ts.
 */
export async function setProductionStatus(
  payload: unknown,
): Promise<OrderActionResult> {
  try {
    await requireRole(ORDER_ROLES);
  } catch {
    return denied();
  }
  const parsed = setProductionStatusSchema.safeParse(payload);
  if (!parsed.success)
    return { ok: false, error: "Invalid production status." };
  const { id, status } = parsed.data;
  const result = await callFulfilmentRpc(
    {
      fn: "admin_set_production_status",
      args: { p_order_id: id, p_to_status: status, p_note: parsed.data.note },
    },
    "Could not change the production status.",
  );
  if (result.ok) revalidate(id);
  return result;
}

export async function recordPayment(
  payload: unknown,
): Promise<OrderActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(ORDER_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = recordPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "The payment amount is not valid.",
    };
  }
  const { id, amount, method, reference, note } = parsed.data;
  const result = await callFulfilmentRpc(
    {
      fn: "admin_record_payment",
      args: {
        p_order_id: id,
        p_amount: amount,
        p_method: method,
        p_reference: reference,
        p_note: note,
      },
    },
    "Could not record the payment.",
  );
  if (result.ok) {
    // The payment RPC writes the ledger, not the audit trail. Amount + method,
    // never the reference or free-text note.
    const supabase = await createClient();
    await logAudit(supabase, {
      actorId,
      action: "order.payment",
      tableName: "orders",
      recordId: id,
      diff: { amount, method },
    });
    revalidate(id);
  }
  return result;
}

export async function saveShippingDetails(
  payload: unknown,
): Promise<OrderActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(ORDER_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = orderShippingSchema.safeParse(payload);
  if (!parsed.success)
    return { ok: false, error: "The courier details are too long." };
  const { id, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({
      courier_name: fields.courier_name,
      tracking_code: fields.tracking_code,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not save the courier details." };
  if (!data) return { ok: false, error: "Order not found." };
  await logAudit(supabase, {
    actorId,
    action: "order.shipping",
    tableName: "orders",
    recordId: id,
    diff: {
      courier_name: fields.courier_name,
      tracking_code: fields.tracking_code,
    },
  });
  revalidate(id);
  return { ok: true };
}

export async function saveOrderNote(
  payload: unknown,
): Promise<OrderActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(ORDER_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = orderNoteSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "The note is too long." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ admin_note: parsed.data.admin_note })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not save the note." };
  if (!data) return { ok: false, error: "Order not found." };
  await logAudit(supabase, {
    actorId,
    action: "order.note",
    tableName: "orders",
    recordId: parsed.data.id,
    diff: { fields: ["admin_note"] },
  });
  revalidate(parsed.data.id);
  return { ok: true };
}

/**
 * Plan 15.2 B4 — block the order's phone from future checkout and quotes.
 * The phone is read from the order row (never trusted from the client),
 * canonicalized with the same `normalizePhone()` the public checks use, and
 * written under the existing `blocked_contacts` staff RLS. Re-blocking the
 * same number is a friendly no-op: `unique (type, value)` swallows the
 * duplicate.
 */
export async function blockOrderPhone(
  payload: unknown,
): Promise<OrderActionResult> {
  let staff;
  try {
    staff = await requireRole(ORDER_ROLES);
  } catch {
    return denied();
  }
  const parsed = orderBlockSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid order id." };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("order_no, customer_phone")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };

  const value = normalizePhone(order.customer_phone);
  if (value === "")
    return { ok: false, error: "The order has no usable phone." };

  const { error } = await supabase.from("blocked_contacts").insert({
    type: "phone",
    value,
    reason: parsed.data.reason ?? `Blocked from order ${order.order_no}`,
    created_by: staff.id,
  });
  if (error && error.code !== "23505") {
    return { ok: false, error: "Could not block this phone." };
  }
  // Audit the block without the phone value (PII). Record the originating order.
  await logAudit(supabase, {
    actorId: staff.id,
    action: "blocked_contact.create",
    tableName: "blocked_contacts",
    diff: { type: "phone", order_id: parsed.data.id },
  });
  revalidate(parsed.data.id);
  return { ok: true };
}

/* ------------------------------------------------------------------ * *
 * Plan 15.2 E3 — admin-created orders (phone, WhatsApp, walk-in).     *
 * ------------------------------------------------------------------ * */

export type CreateAdminOrderResult =
  | { ok: true; id: string; orderNo: string; warning?: string }
  | { ok: false; error: string };

/**
 * `admin_create_order` raises short, stable codes and a few full sentences
 * (the ones `create_order_core` shares with `place_order`). Translate every
 * shape for staff; never show raw Postgres text, and never let an
 * unrecognised failure look like a success.
 */
function adminOrderError(message: string): string {
  const code = message.trim().split(/\s+/)[0] ?? "";
  switch (code) {
    case "not_allowed":
      return NOT_ALLOWED;
    case "channel_required":
    case "channel_invalid":
      return "Choose how the order came in.";
    case "override_not_allowed":
      return "Discounts and price overrides are for owners and managers only.";
    case "reason_required":
      return "A reason is required for a discount or a price override.";
    case "advance_exceeds_total":
      return "The advance is more than the order total.";
    case "invalid_amount":
      return "Enter an advance amount of zero or more.";
    default:
      break;
  }
  const lower = message.toLowerCase();
  if (lower.includes("quantity below moq"))
    return "One product is below its minimum order quantity.";
  if (lower.includes("insufficient stock"))
    return "There is not enough stock for one of the items.";
  if (lower.includes("no valid price tier"))
    return "No price tier covers one of the quantities.";
  if (lower.includes("shipping zone not found"))
    return "The chosen shipping zone is missing or inactive.";
  if (lower.includes("variant not found"))
    return "One of the selected variants no longer exists.";
  if (lower.includes("not published"))
    return "One of the selected products is no longer published.";
  if (lower.includes("only buy-now products"))
    return "Only regular (buy-now) products can be added here. Use a quote for custom orders.";
  if (lower.includes("discount exceeds subtotal"))
    return "The discount is larger than the order subtotal.";
  if (
    lower.includes("admin_create_order") ||
    lower.includes("create_order_core")
  ) {
    return "The admin order database functions are missing. Apply supabase/migrations/202610200005_e3_admin_create_order.sql first.";
  }
  return "Could not create the order. Please check the details and try again.";
}

/**
 * Create an order on behalf of a customer (plan 15.2 E3). The staff identity
 * is re-checked twice: by `requireRole` here (so a non-staff caller never even
 * reaches the RPC) and by `admin_create_order` inside the database. Money,
 * MOQ, tiers and stock are recomputed in Postgres — this action only forwards
 * variant ids, quantities and the optional staff overrides. The blocked-phone
 * check is a warning, never a block: a walk-in must stay creatable.
 */
export async function createAdminOrder(
  payload: unknown,
): Promise<CreateAdminOrderResult> {
  try {
    await requireRole(ORDER_ROLES);
  } catch {
    return { ok: false, error: NOT_ALLOWED };
  }

  const parsed = adminCreateOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Some of the details are not valid.",
    };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: orderNo, error } = await supabase.rpc("admin_create_order", {
    payload: {
      items: d.items.map((item) => ({
        variant_id: item.variant_id,
        qty: item.qty,
        unit_price_override: item.unit_price_override ?? null,
      })),
      customer_name: d.customer_name,
      customer_phone: d.customer_phone,
      customer_email: d.customer_email ?? null,
      division: d.division ?? null,
      district: d.district ?? null,
      area: d.area ?? null,
      address_line: d.address_line ?? null,
      shipping_zone_id: d.shipping_zone_id,
      channel: d.channel,
      status: d.status,
      discount: d.discount,
      reason: d.reason ?? null,
      override_reason: d.override_reason ?? null,
      advance_amount: d.advance_amount,
      advance_method: d.advance_method,
      advance_reference: d.advance_reference ?? null,
      admin_note: d.admin_note ?? null,
      customer_note: d.customer_note ?? null,
      type: "retail",
      payment_method: "cod",
      idempotency_key: d.idempotency_key,
    },
  });

  if (error || !orderNo) {
    return { ok: false, error: adminOrderError(error?.message ?? "unknown") };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("order_no", String(orderNo))
    .maybeSingle();
  if (!order) {
    return {
      ok: false,
      error:
        "The order was created but could not be loaded. Open the orders list to find it.",
    };
  }

  revalidatePath("/admin/orders");
  revalidateTag(CACHE_TAGS.adminCounts, "max");
  const warning = (await phoneIsBlocked(d.customer_phone))
    ? "This phone is on the blocklist — the order was still created."
    : undefined;

  return { ok: true, id: String(order.id), orderNo: String(orderNo), warning };
}
