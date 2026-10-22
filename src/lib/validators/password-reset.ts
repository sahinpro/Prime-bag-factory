import { z } from "zod";

/**
 * Password-recovery validators (admin reset + change password). zod runs in the
 * form component AND again inside every server action — the action is the real
 * gate. The 12-char floor matches the plan's password policy for staff.
 */

const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(256);

export const forgotPasswordSchema = z.object({
  // Trimmed by the caller (`String(...).trim()`) before parsing — zod v4
  // runs the email check on the raw value, like the staff-login schema.
  email: z.email().max(254),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password,
    confirm: z.string().min(1).max(256),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    password,
    confirm: z.string().min(1).max(256),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
