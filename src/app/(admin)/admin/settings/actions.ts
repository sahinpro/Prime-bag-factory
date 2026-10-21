"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  companySchema,
  notificationCronSchema,
  type CompanyInput,
  type NotificationCronInput,
} from "@/lib/validators/settings";
import { logAudit } from "@/server/audit";

/**
 * Admin settings mutations (plan §9, order-of-work step 9). Each group is a
 * single jsonb row keyed by name, so a save is an upsert on `key`. Owner and
 * manager only (mirrors the "Management can manage settings" RLS); every write
 * lands an `audit_logs` row. The notification secret value is NEVER logged —
 * the diff only records which fields were set.
 */

const SETTINGS_ROLES = ["owner", "manager"] as const;

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

function denied(): SettingsActionResult {
  return { ok: false, error: "You are not authorized to manage settings." };
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "The form has errors.";
}

async function upsertSetting(
  key: string,
  value: Record<string, string | null>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Could not save the settings." };
  }
  return { ok: true, id: String(data.id) };
}

export async function saveCompany(
  payload: CompanyInput,
): Promise<SettingsActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(SETTINGS_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = companySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = {
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    whatsapp: parsed.data.whatsapp ?? null,
  };
  const saved = await upsertSetting("company", value);
  if (!saved.ok) return saved;

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId,
    action: "settings.company",
    tableName: "settings",
    recordId: saved.id,
    // Which fields are populated — no email/phone value beyond the company
    // identity itself, and never any credential.
    diff: {
      fields: Object.keys(value).filter(
        (k) => value[k as keyof typeof value] != null,
      ),
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function saveNotificationCron(
  payload: NotificationCronInput,
): Promise<SettingsActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(SETTINGS_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = notificationCronSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = {
    url: parsed.data.url ?? null,
    secret: parsed.data.secret ?? null,
  };
  const saved = await upsertSetting("notification_cron", value);
  if (!saved.ok) return saved;

  const supabase = await createClient();
  await logAudit(supabase, {
    actorId,
    action: "settings.notification_cron",
    tableName: "settings",
    recordId: saved.id,
    // Only the shape of what was configured — the secret value is never stored.
    diff: { url_set: value.url != null, secret_set: value.secret != null },
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}
