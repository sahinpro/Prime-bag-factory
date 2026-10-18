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
    typeof value[key] === "string" ? (value[key] as string) : FALLBACK[key as keyof CompanyProfile];
  return {
    name: text("name") || FALLBACK.name,
    phone: text("phone"),
    email: text("email"),
    whatsapp: text("whatsapp"),
  };
}
