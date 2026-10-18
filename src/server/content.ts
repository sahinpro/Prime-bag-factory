import "server-only";

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/server";
import { CATALOG_TAG } from "@/server/catalog";

/**
 * Public content reads (plan 8 static pages). RLS already limits these to rows
 * the public may read (active clients, all FAQs/legal docs). Memoized under the
 * shared catalog tag so a content save can refresh the public site.
 */

export type FaqItem = {
  question_en: string;
  question_bn: string | null;
  answer_en: string;
  answer_bn: string | null;
};

export const listFaqs = unstable_cache(
  async (): Promise<FaqItem[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("faqs")
      .select("question_en, question_bn, answer_en, answer_bn")
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error("Failed to load FAQs.", { cause: error });
    return (data ?? []) as FaqItem[];
  },
  ["faqs"],
  { revalidate: 300, tags: [CATALOG_TAG] },
);

export type LegalDocument = {
  title: string;
  number: string | null;
  image_path: string | null;
  updated_at: string;
};

export const listLegalDocuments = unstable_cache(
  async (): Promise<LegalDocument[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("legal_documents")
      .select("title, number, image_path, updated_at")
      .order("title");
    if (error) throw new Error("Failed to load documents.", { cause: error });
    return (data ?? []) as LegalDocument[];
  },
  ["legal-documents"],
  { revalidate: 300, tags: [CATALOG_TAG] },
);

export type ClientLogo = { id: string; name: string; logo_path: string | null };

export const listClients = unstable_cache(
  async (): Promise<ClientLogo[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, logo_path")
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    if (error) throw new Error("Failed to load clients.", { cause: error });
    return (data ?? []) as ClientLogo[];
  },
  ["clients"],
  { revalidate: 300, tags: [CATALOG_TAG] },
);
