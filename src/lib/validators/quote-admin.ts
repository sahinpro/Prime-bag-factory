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
