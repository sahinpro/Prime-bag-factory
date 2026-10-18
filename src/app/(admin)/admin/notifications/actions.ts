"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { markAdminAlertsRead } from "@/server/notifications";

/**
 * Admin bell (plan Phase 4 task 2): mark all unread new-quote alerts as read.
 * RLS on `notifications` already restricts writes to owner/manager —
 * requireRole mirrors that at the app layer (plan working rule 6).
 */
export async function markAlertsRead(): Promise<{ ok: true }> {
  await requireRole(["owner", "manager"]);
  await markAdminAlertsRead();
  // The bell lives in the protected layout, so revalidate the layout segment.
  revalidatePath("/admin", "layout");
  return { ok: true };
}
