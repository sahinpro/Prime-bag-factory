"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  orderNoteSchema,
  orderShippingSchema,
  recordPaymentSchema,
  setOrderStatusSchema,
} from "@/lib/validators/order-admin";

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
  try {
    await requireRole(ORDER_ROLES);
  } catch {
    return denied();
  }
  const parsed = setOrderStatusSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const { id, status, note } = parsed.data;
  const result = await callFulfilmentRpc(
    {
      fn: "admin_set_order_status",
      args: { p_order_id: id, p_to_status: status, p_note: note },
    },
    "Could not change the order status.",
  );
  if (result.ok) revalidate(id);
  return result;
}

export async function recordPayment(
  payload: unknown,
): Promise<OrderActionResult> {
  try {
    await requireRole(ORDER_ROLES);
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
  if (result.ok) revalidate(id);
  return result;
}

export async function saveShippingDetails(
  payload: unknown,
): Promise<OrderActionResult> {
  try {
    await requireRole(ORDER_ROLES);
  } catch {
    return denied();
  }
  const parsed = orderShippingSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "The courier details are too long." };
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
  revalidate(id);
  return { ok: true };
}

export async function saveOrderNote(
  payload: unknown,
): Promise<OrderActionResult> {
  try {
    await requireRole(ORDER_ROLES);
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
  revalidate(parsed.data.id);
  return { ok: true };
}
