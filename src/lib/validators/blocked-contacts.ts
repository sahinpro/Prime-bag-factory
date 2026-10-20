import { z } from "zod";

/**
 * Plan 15.2 B4b — the unblock UI sends only the row id; everything else
 * (the deleted values, the audit trail) is read server-side inside the
 * `admin_unblock_contact` RPC, so a tampered client cannot rewrite history.
 */
export const unblockSchema = z.object({
  id: z.guid(),
});

export type UnblockInput = z.input<typeof unblockSchema>;
