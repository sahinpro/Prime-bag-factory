import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Cookie-free public read of `settings.company` (plan 3b `settings` tag).
 * Lives in its own module so the public shell never imports `cookies()`.
 */
export type PublicCompany = {
  name: string;
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  hours: string;
  facebook: string;
  instagram: string;
  youtube: string;
  linkedin: string;
};

export const PUBLIC_COMPANY_FALLBACK: PublicCompany = {
  name: "Prime Bag Factory",
  phone: "",
  email: "",
  whatsapp: "",
  address: "",
  hours: "",
  facebook: "",
  instagram: "",
  youtube: "",
  linkedin: "",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function getPublicCompany(): Promise<PublicCompany> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.settings);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "company")
    .maybeSingle();
  if (error || !data) return PUBLIC_COMPANY_FALLBACK;
  const value = (data.value ?? {}) as Record<string, unknown>;
  return {
    name: text(value.name) || PUBLIC_COMPANY_FALLBACK.name,
    phone: text(value.phone),
    email: text(value.email),
    whatsapp: text(value.whatsapp),
    address: text(value.address),
    hours: text(value.hours),
    facebook: text(value.facebook),
    instagram: text(value.instagram),
    youtube: text(value.youtube),
    linkedin: text(value.linkedin),
  };
}

export function whatsappHref(number: string): string | null {
  const digits = number.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
