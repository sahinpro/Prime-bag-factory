import { z } from "zod";

import { toAsciiDigits } from "@/lib/format";

/**
 * Public quote-request validation (AGENTS: validate with zod on the client AND
 * the server; never trust client data). This is the same schema the server action
 * parses, so a tampered or spammy payload is rejected before it reaches the DB.
 *
 * All form fields arrive as strings, so optional values are normalized from ""
 * to `undefined`. The `website` field is a honeypot: it must stay empty — a real
 * user never sees or fills it, but bots do (plan 8 quote spam guard).
 */

function emptyToUndefined(value: unknown) {
  return value === "" || value == null ? undefined : value;
}

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const optionalUuid = z.preprocess(emptyToUndefined, z.guid().optional());

const optionalQuantity = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(10_000_000).optional(),
);

const phoneSchema = z
  .string()
  .trim()
  .min(1, "required")
  .transform(toAsciiDigits)
  .refine((v) => {
    const digits = v.replace(/[^\d]/g, "");
    return (
      /^\+?[\d\s-]{7,20}$/.test(v) && digits.length >= 7 && digits.length <= 15
    );
  });

const emailSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().email().max(160).optional(),
);

export const quoteSchema = z.object({
  source: z.enum(["form", "builder"]).default("form"),
  contact_name: z.string().trim().min(1, "required").max(120),
  phone: phoneSchema,
  email: emailSchema,
  company_name: optionalText(120),
  product_id: optionalUuid,
  category_id: optionalUuid,
  quantity: optionalQuantity,
  custom_size: optionalText(120),
  custom_color: optionalText(120),
  needs_logo_print: z.preprocess(
    (v) => v === "true" || v === true,
    z.boolean().default(false),
  ),
  needed_by: optionalText(10),
  message: optionalText(4000),
  attachment_path: optionalText(400),
  // JSON snapshot of a builder configuration (validated structurally in the
  // action so a malformed blob can't blow up the insert).
  customization: z.preprocess(
    (v) =>
      v == null ? undefined : typeof v === "string" ? v : JSON.stringify(v),
    z.string().max(20_000).optional(),
  ),
  // Honeypot — present but must be empty.
  website: z
    .string()
    .max(0, "spam")
    .optional()
    .transform((v) => v ?? ""),
});

export type QuoteInput = z.input<typeof quoteSchema>;
export type QuoteData = z.infer<typeof quoteSchema>;
