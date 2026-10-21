import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Public content reads (plan 8 static pages). RLS already limits these to rows
 * the public may read (active clients, all FAQs/legal docs). Each is memoized
 * with `"use cache"` under a `content:{key}` tag (plan 3b cache tags). The admin
 * content module was removed (owner 2026-10-18), so there is no writer to
 * invalidate these tags — the `catalog` cacheLife profile is the refresh path.
 */

export type FaqItem = {
  question_en: string;
  question_bn: string | null;
  answer_en: string;
  answer_bn: string | null;
};

export async function listFaqs(): Promise<FaqItem[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.content("faqs"));
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("question_en, question_bn, answer_en, answer_bn")
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error("Failed to load FAQs.", { cause: error });
  return (data ?? []) as FaqItem[];
}

export type LegalDocument = {
  title: string;
  number: string | null;
  image_path: string | null;
  updated_at: string;
};

export async function listLegalDocuments(): Promise<LegalDocument[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.content("legal"));
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("legal_documents")
    .select("title, number, image_path, updated_at")
    .order("title");
  if (error) throw new Error("Failed to load documents.", { cause: error });
  return (data ?? []) as LegalDocument[];
}

export type ClientLogo = { id: string; name: string; logo_path: string | null };

export async function listClients(): Promise<ClientLogo[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.content("clients"));
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, logo_path")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error("Failed to load clients.", { cause: error });
  return (data ?? []) as ClientLogo[];
}
