import { z } from "zod";

export const staffLoginSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(1).max(256),
  next: z.string().max(2048).optional(),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
