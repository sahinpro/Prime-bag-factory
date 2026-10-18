"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  assignQuoteSchema,
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
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  return { ok: true };
}

export async function updateQuoteStatus(
  payload: unknown,
): Promise<QuoteActionResult> {
  try {
    await requireRole(QUOTE_ROLES);
  } catch {
    return denied();
  }
  const parsed = updateQuoteStatusSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  return updateQuote(parsed.data.id, { status: parsed.data.status });
}

export async function assignQuote(
  payload: unknown,
): Promise<QuoteActionResult> {
  try {
    await requireRole(QUOTE_ROLES);
  } catch {
    return denied();
  }
  const parsed = assignQuoteSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid assignee." };
  return updateQuote(parsed.data.id, {
    assigned_to:
      parsed.data.assigned_to === "" ? null : parsed.data.assigned_to,
  });
}

export async function saveQuoteDetails(
  payload: unknown,
): Promise<QuoteActionResult> {
  try {
    await requireRole(QUOTE_ROLES);
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
  return updateQuote(id, {
    quoted_amount: fields.quoted_amount,
    valid_until: fields.valid_until,
    internal_notes: fields.internal_notes,
  });
}
