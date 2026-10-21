import { z } from "zod";

/**
 * MFA validators (plan §15 D2, order-of-work step 11). Supabase TOTP codes are
 * six digits; the friendly name is an optional label so a user can tell two
 * authenticator devices apart. Both are validated with zod on the way into the
 * `@supabase/ssr` MFA calls — nothing reaches GoTrue unchecked.
 */

export const mfaCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app.");

export const enrollFactorSchema = z.object({
  friendlyName: z.string().trim().max(40).optional(),
});

export type EnrollFactorInput = z.input<typeof enrollFactorSchema>;
