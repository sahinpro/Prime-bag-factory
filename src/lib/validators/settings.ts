import { z } from "zod";

/**
 * Admin settings validation (plan §9 "Settings", order-of-work step 9). The
 * `settings` table is a `key -> jsonb value` store; only two groups are edited
 * here: the company profile (`settings.company`) and the notification delivery
 * config (`settings.notification_cron`). Values are stored as JSONB blobs, so
 * these schemas define the shape we allow inside each blob. Business contact
 * details (name/phone/email/whatsapp) are the company's own — not customer PII
 * — so they are safe to persist and echo back into the admin form.
 */

const trimmed = (max: number) => z.string().trim().max(max);

/** Empty string is stored as null in the blob (a blank field is "unset"). */
const optional = (schema: z.ZodType<string | null>) =>
  schema.or(z.literal("")).transform((v) => (v === "" ? null : v));

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(120),
  phone: optional(trimmed(40)),
  whatsapp: optional(trimmed(40)),
  email: optional(
    z
      .string()
      .trim()
      .max(320)
      .refine((v) => v === "" || z.email().safeParse(v).success, {
        message: "Enter a valid email address.",
      }),
  ),
});

export type CompanyInput = z.input<typeof companySchema>;

/**
 * The pg_cron notification sender reads `{ url, secret }` (C2). The secret is
 * the shared `CRON_SECRET`; blank values keep the job inert, mirroring the
 * "no config → skip" rule the worker already follows. The url must be http(s)
 * so a bogus scheme can never be fired at by the scheduler.
 */
export const notificationCronSchema = z.object({
  url: optional(
    z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => v === "" || /^https?:\/\//i.test(v),
        "The cron URL must start with http:// or https://.",
      ),
  ),
  secret: optional(z.string().trim().max(200)),
});

export type NotificationCronInput = z.input<typeof notificationCronSchema>;
