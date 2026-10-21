import { z } from "zod";

/**
 * Admin quote-workflow validation (plan §9 Quotes / Phase 4). The public
 * submission schema lives in `validators/quote.ts`; this file covers only the
 * staff-side mutations: status pipeline moves, assignment and the quoted
 * amount / validity / internal notes fields. Money and stock are never taken
 * from the client without re-checks — these are admin-authored values, so zod
 * is the authority here (AGENTS rule 6).
 */

export const QUOTE_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "won",
  "lost",
] as const;

// Order channels a converted bulk order may be attributed to (plan 15.2 F1).
// The database derives `other` when the caller supplies nothing.
export const QUOTE_CONVERT_CHANNELS = [
  "phone",
  "whatsapp",
  "facebook",
  "walk_in",
  "other",
] as const;

const id = z.guid({ error: "Invalid quote." });

export const updateQuoteStatusSchema = z.object({
  id,
  status: z.enum(QUOTE_STATUSES),
});

export const assignQuoteSchema = z.object({
  id,
  // Empty string means "unassign"; the action normalizes it to null.
  assigned_to: z.union([
    z.guid({ error: "Invalid staff member." }),
    z.literal(""),
  ]),
});

export const quoteDetailsSchema = z.object({
  id,
  // numeric(12,2) in the DB — clamp to the same width.
  quoted_amount: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().min(0).max(9_999_999_999.99).nullable().default(null),
  ),
  valid_until: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
      .nullable()
      .default(null),
  ),
  internal_notes: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().trim().max(4000).nullable().default(null),
  ),
});

export type UpdateQuoteStatusInput = z.input<typeof updateQuoteStatusSchema>;
export type AssignQuoteInput = z.input<typeof assignQuoteSchema>;
export type QuoteDetailsInput = z.input<typeof quoteDetailsSchema>;

/**
 * Convert a won quote to a bulk order (plan 15.2 F1). The quoted amount, the
 * quantity and the customization snapshot are all read from the quote row
 * inside the `convert_quote_to_order` RPC — the client only names the quote and
 * (optionally) the channel / shipping zone, so no money is ever taken from it.
 */
export const convertQuoteSchema = z.object({
  id: z.guid({ error: "Invalid quote." }),
  channel: z.enum(QUOTE_CONVERT_CHANNELS).optional(),
  shipping_zone_id: z.guid({ error: "Invalid shipping zone." }).optional(),
});

export type ConvertQuoteInput = z.input<typeof convertQuoteSchema>;
