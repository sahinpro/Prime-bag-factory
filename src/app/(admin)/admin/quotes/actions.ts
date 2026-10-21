"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireRole } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import {
  assignQuoteSchema,
  convertQuoteSchema,
  quoteDetailsSchema,
  updateQuoteStatusSchema,
} from "@/lib/validators/quote-admin";

/**
 * Admin quote workflow (plan §9 Quotes, Phase 4). Mirrors the collections
 * action shape: requireRole → zod → RLS-scoped write → revalidate. RLS on
 * quote_requests already grants owner/manager/sales ("Sales and management can
 * manage quote requests"), so this action is the app-level gate, not the only one.
 */

const QUOTE_ROLES = ["owner", "manager", "sales"] as const;

export type QuoteActionResult = { ok: true } | { ok: false; error: string };

function denied(): QuoteActionResult {
  return { ok: false, error: "You are not authorized to manage quotes." };
}

type QuoteUpdate = Database["public"]["Tables"]["quote_requests"]["Update"];

async function updateQuote(
  id: string,
  patch: QuoteUpdate,
  audit: { actorId: string; action: string },
): Promise<QuoteActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not save the quote." };
  if (!data) return { ok: false, error: "Quote not found." };
  // Diff lists the changed field names only — never the note text or contact PII.
  await logAudit(supabase, {
    actorId: audit.actorId,
    action: audit.action,
    tableName: "quote_requests",
    recordId: id,
    diff: { fields: Object.keys(patch) },
  });
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  // A status move can change how many quotes sit in `new` (the sidebar badge).
  revalidateTag(CACHE_TAGS.adminCounts, "max");
  return { ok: true };
}

export async function updateQuoteStatus(
  payload: unknown,
): Promise<QuoteActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(QUOTE_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = updateQuoteStatusSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  return updateQuote(
    parsed.data.id,
    { status: parsed.data.status },
    { actorId, action: "quote.status" },
  );
}

export async function assignQuote(
  payload: unknown,
): Promise<QuoteActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(QUOTE_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = assignQuoteSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid assignee." };
  return updateQuote(
    parsed.data.id,
    {
      assigned_to:
        parsed.data.assigned_to === "" ? null : parsed.data.assigned_to,
    },
    { actorId, action: "quote.assign" },
  );
}

export async function saveQuoteDetails(
  payload: unknown,
): Promise<QuoteActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(QUOTE_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = quoteDetailsSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "The form has errors.",
    };
  }
  const { id, ...fields } = parsed.data;
  return updateQuote(
    id,
    {
      quoted_amount: fields.quoted_amount,
      valid_until: fields.valid_until,
      internal_notes: fields.internal_notes,
    },
    { actorId, action: "quote.details" },
  );
}

/* ------------------------------------------------------------------ * *
 * Plan 15.2 F1 — convert a won quote into a `bulk` order.             * *
 * ------------------------------------------------------------------ * */

// Bulk conversion is management-only (the RPC re-checks owner/manager inside).
const CONVERT_ROLES = ["owner", "manager"] as const;

export type ConvertQuoteResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

function deniedConvert(): ConvertQuoteResult {
  return { ok: false, error: "Only owners and managers can convert a quote." };
}

/**
 * Translate the short, stable codes `convert_quote_to_order` / `create_order_bulk`
 * raise into staff-facing messages; never surface raw Postgres text, and never
 * let an unrecognised failure look like a success.
 */
function convertError(message: string): string {
  const code = message.trim().split(/\s+/)[0] ?? "";
  switch (code) {
    case "not_allowed":
      return "Only owners and managers can convert a quote.";
    case "quote_not_found":
      return "This quote no longer exists.";
    case "quote_not_priced":
      return "Add a quoted amount before converting this quote.";
    case "channel_required":
    case "channel_invalid":
      return "Choose how the order came in.";
    default:
      if (
        message.includes("convert_quote_to_order") ||
        message.includes("create_order_bulk")
      ) {
        return "The quote-conversion database functions are missing. Apply supabase/migrations/202610210004_f1_quote_to_bulk_order.sql first.";
      }
      return "Could not convert the quote. Please try again.";
  }
}

/**
 * Convert a quote to a bulk order (plan 15.2 F1). The quoted amount, quantity
 * and customization snapshot are read from the quote row inside the RPC, so the
 * client only names the quote plus an optional channel/zone. `convert_quote_to_order`
 * is convert-once idempotent and writes its OWN `audit_logs` row, so this action
 * does not call `logAudit` (AGENTS rule: no double-logging through a definer RPC,
 * mirroring `createAdminOrder`). New-order notifications fire through the C1
 * orders trigger automatically.
 */
export async function convertQuoteToOrder(
  payload: unknown,
): Promise<ConvertQuoteResult> {
  try {
    await requireRole(CONVERT_ROLES);
  } catch {
    return deniedConvert();
  }
  const parsed = convertQuoteSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid quote.",
    };
  }
  const { id, channel, shipping_zone_id } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_quote_to_order", {
    p_quote_id: id,
    p_payload: {
      channel: channel ?? null,
      shipping_zone_id: shipping_zone_id ?? null,
    },
  });

  if (error || !data) {
    return { ok: false, error: convertError(error?.message ?? "unknown") };
  }

  const orderId = String(data);
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  revalidatePath("/admin/orders");
  // The quote left the `new` bucket and a pending order may have entered it.
  revalidateTag(CACHE_TAGS.adminCounts, "max");
  return { ok: true, orderId };
}
