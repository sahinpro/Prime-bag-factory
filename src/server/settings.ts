import { createClient } from "@/lib/supabase/server";

// Settings reads for printable documents (plan §7 Content `settings`). Quote
// print sheets need the company identity; the full Settings admin module ships
// later, so this stays a tiny single-key reader with safe fallbacks (the seed
// row `company` carries name/phone/email/whatsapp).

export type CompanyProfile = {
  name: string;
  phone: string;
  email: string;
  whatsapp: string;
};

const FALLBACK: CompanyProfile = {
  name: "Prime Bag Factory",
  phone: "",
  email: "",
  whatsapp: "",
};

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "company")
    .maybeSingle();
  if (error || !data) return FALLBACK;
  const value = (data.value ?? {}) as Record<string, unknown>;
  const text = (key: string): string =>
    typeof value[key] === "string"
      ? (value[key] as string)
      : FALLBACK[key as keyof CompanyProfile];
  return {
    name: text("name") || FALLBACK.name,
    phone: text("phone"),
    email: text("email"),
    whatsapp: text("whatsapp"),
  };
}

/* ------------------------------------------------------------------ *
 * Admin settings reads (plan §9 "Settings", order-of-work step 9).
 * `settings` is a key -> jsonb store; the two editable groups are the
 * company profile and the notification-delivery config. Reads run under
 * the cookie session (RLS lets everyone read settings; only owner/manager
 * may write, which the actions re-check with requireRole).
 * ------------------------------------------------------------------ */

export type NotificationCron = {
  url: string | null;
  secret: string | null;
};

export type AdminSettings = {
  company: CompanyProfile;
  notificationCron: NotificationCron;
};

async function readSetting(
  key: string,
): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value ?? {}) as Record<string, unknown>;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

/** The full editable settings snapshot for the admin page. */
export async function getAdminSettings(): Promise<AdminSettings> {
  const [company, cron] = await Promise.all([
    readSetting("company"),
    readSetting("notification_cron"),
  ]);
  return {
    company: {
      name: str(company.name) || FALLBACK.name,
      phone: str(company.phone) ?? "",
      email: str(company.email) ?? "",
      whatsapp: str(company.whatsapp) ?? "",
    },
    notificationCron: {
      url: str(cron.url),
      secret: str(cron.secret),
    },
  };
}
