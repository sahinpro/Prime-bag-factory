import type { Metadata } from "next";

import type { Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

/** Absolute site origin for canonical, OG and JSON-LD URLs. */
export function siteUrl(path = "/"): string {
  const base = (
    publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Build page metadata for a locale. The localized canonical plus `alternates.languages`
 * gives hreflang (next-intl emits none on its own). Titles/descriptions fall back to the
 * brand defaults when a page or entity has no SEO copy.
 */
export function buildMetadata({
  locale,
  path,
  title,
  description,
  ogImage,
}: {
  locale: Locale;
  path: string;
  title: string;
  description?: string | null;
  ogImage?: string | null;
}): Metadata {
  const url = siteUrl(path);
  const locales = ["en", "bn"] as const;
  const languages: Record<string, string> = { "x-default": siteUrl(path) };
  for (const l of locales) {
    languages[l] = siteUrl(path.replace(`/${locale}/`, `/${l}/`));
  }

  return {
    title,
    description: description ?? undefined,
    alternates: { canonical: url, languages },
    openGraph: {
      url,
      type: "website",
      locale: locale === "bn" ? "bn_BD" : "en_US",
      title,
      description: description ?? undefined,
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description: description ?? undefined,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

/** A localized trail entry; the last crumb is the current page (no link). */
export type Crumb = { name: string; path?: string };

/**
 * Build a schema.org BreadcrumbList (plan 8 SEO). `path` is locale-relative
 * ("", "/category/slug", "/product/slug"); it is prefixed with the locale to form
 * the absolute `item` URL. The trailing crumb omits `item` per the spec.
 */
export function buildBreadcrumb(locale: Locale, crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      ...(crumb.path != null && i < crumbs.length - 1
        ? { item: siteUrl(`/${locale}${crumb.path}`) }
        : {}),
    })),
  };
}

/** A JSON-LD <script> the consumer can drop into a page body (plan 8 SEO). */
export function jsonLd(data: object) {
  // Escape `<` so a title/description containing `</script>` cannot break out of
  // the inline script; JSON.stringify output is otherwise inert.
  const html = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
