import type { ContentEntity } from "@/lib/validators/content";

/**
 * Field configuration for the content workspace (plan 9c.8 "Content": left
 * list of content types, right FormSection editors). Pure data so both the
 * server page and the client editor can share it; keep it serializable-friendly.
 */

export type FieldDef =
  | { kind: "text"; name: string; label: string; required?: boolean; hint?: string; maxLength?: number }
  | { kind: "textarea"; name: string; label: string; required?: boolean; hint?: string }
  | { kind: "json"; name: string; label: string; hint?: string }
  | { kind: "bilingual"; name: string; label: string; required?: boolean; multiline?: boolean; hint?: string }
  | { kind: "number"; name: string; label: string; min?: number; max?: number; required?: boolean }
  | { kind: "select"; name: string; label: string; options: readonly string[]; numeric?: boolean; required?: boolean }
  | { kind: "date"; name: string; label: string; hint?: string }
  | {
      kind: "image";
      name: string;
      label: string;
      folder: "catalog" | "clients" | "gallery";
      required?: boolean;
    };

export type ContentTypeConfig = {
  entity: ContentEntity;
  label: string;
  /** One-line summary shown under the type in the rail. */
  hint: string;
  /** Field names used for the row title and its secondary line. */
  titleFields: string[];
  fields: FieldDef[];
  hasSort: boolean;
  hasActive: boolean;
  /** True once a public page reads this table (shown in the editor note). */
  liveOnSite: boolean;
};

export const CONTENT_TYPE_CONFIGS: Record<ContentEntity, ContentTypeConfig> = {
  sections: {
    entity: "sections",
    label: "Homepage sections",
    hint: "Banners and stats blocks (jsonb)",
    titleFields: ["page", "key"],
    hasSort: true,
    hasActive: true,
    liveOnSite: false,
    fields: [
      { kind: "text", name: "page", label: "Page", required: true, hint: 'e.g. "home"' },
      { kind: "text", name: "key", label: "Section key", required: true, hint: 'e.g. "hero_stats"' },
      {
        kind: "json",
        name: "content",
        label: "Content (JSON)",
        hint: 'Bilingual keys by convention: title_en/title_bn, text_en/text_bn, plus any block data as {"value", "label"} pairs.',
      },
    ],
  },
  clients: {
    entity: "clients",
    label: "Clients",
    hint: "Logo wall on /clients",
    titleFields: ["name"],
    hasSort: true,
    hasActive: true,
    liveOnSite: true,
    fields: [
      { kind: "text", name: "name", label: "Client name", required: true },
      { kind: "image", name: "logo_path", label: "Logo", folder: "clients" },
    ],
  },
  gallery: {
    entity: "gallery",
    label: "Gallery",
    hint: "Factory and product photos",
    titleFields: ["caption"],
    hasSort: true,
    hasActive: false,
    liveOnSite: false,
    fields: [
      { kind: "image", name: "image_path", label: "Photo", folder: "gallery", required: true },
      { kind: "text", name: "caption", label: "Caption" },
    ],
  },
  testimonials: {
    entity: "testimonials",
    label: "Testimonials",
    hint: "Client quotes with star rating",
    titleFields: ["name", "company"],
    hasSort: false,
    hasActive: false,
    liveOnSite: false,
    fields: [
      { kind: "text", name: "name", label: "Person", required: true },
      { kind: "text", name: "company", label: "Company" },
      { kind: "number", name: "rating", label: "Rating (1–5)", min: 1, max: 5, required: true },
      { kind: "bilingual", name: "body", label: "Testimonial", multiline: true },
    ],
  },
  faqs: {
    entity: "faqs",
    label: "FAQs",
    hint: "Questions shown on /faq",
    titleFields: ["question_en"],
    hasSort: true,
    hasActive: false,
    liveOnSite: true,
    fields: [
      { kind: "bilingual", name: "question", label: "Question", required: true },
      { kind: "bilingual", name: "answer", label: "Answer", required: true, multiline: true },
    ],
  },
  posts: {
    entity: "posts",
    label: "Blog posts",
    hint: "Articles (public blog arrives with Phase 6/7)",
    titleFields: ["title_en"],
    hasSort: false,
    hasActive: false,
    liveOnSite: false,
    fields: [
      { kind: "text", name: "slug", label: "Slug", required: true, hint: "lowercase-with-hyphens" },
      { kind: "bilingual", name: "title", label: "Title", required: true },
      { kind: "bilingual", name: "body", label: "Body", multiline: true },
      { kind: "image", name: "cover_path", label: "Cover image", folder: "catalog" },
      { kind: "select", name: "status", label: "Status", options: ["draft", "published"] as const },
      { kind: "date", name: "published_at", label: "Published date", hint: "Set automatically when published." },
      { kind: "text", name: "seo_title_en", label: "SEO title (EN)" },
      { kind: "textarea", name: "seo_description_en", label: "SEO description (EN)" },
    ],
  },
  legal: {
    entity: "legal",
    label: "Legal documents",
    hint: "Trade licence, TIN, BIN (shown on /legal)",
    titleFields: ["title"],
    hasSort: false,
    hasActive: false,
    liveOnSite: true,
    fields: [
      { kind: "text", name: "title", label: "Document title", required: true },
      { kind: "text", name: "number", label: "Reference number" },
      { kind: "image", name: "image_path", label: "Scan", folder: "catalog" },
    ],
  },
  redirects: {
    entity: "redirects",
    label: "Redirects",
    hint: "Old URL → new URL (served from Phase 5)",
    titleFields: ["from_path", "to_path"],
    hasSort: false,
    hasActive: false,
    liveOnSite: false,
    fields: [
      { kind: "text", name: "from_path", label: "From path", required: true, hint: 'e.g. "/old-page"' },
      { kind: "text", name: "to_path", label: "To path", required: true },
      { kind: "select", name: "status_code", label: "Status code", options: ["308", "301", "307", "302"] as const, numeric: true },
    ],
  },
};

export const CONTENT_TYPE_ORDER: ContentEntity[] = [
  "sections",
  "clients",
  "gallery",
  "testimonials",
  "faqs",
  "posts",
  "legal",
  "redirects",
];
