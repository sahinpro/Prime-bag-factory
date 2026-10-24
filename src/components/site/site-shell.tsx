import { getTranslations } from "next-intl/server";

import type { HeaderCollection } from "@/components/site/header-collection";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader, type HeaderCategory } from "@/components/site/site-header";
import { StickyContact } from "@/components/site/sticky-contact";
import { publicEnv } from "@/lib/env";
import {
  getNavCategories,
  listFeaturedProducts,
  listPublicCollections,
} from "@/server/catalog";
import {
  getPublicCompany,
  PUBLIC_COMPANY_FALLBACK,
  whatsappHref,
} from "@/server/public-settings";

/**
 * Public site chrome (plan §8): skip link, sticky header with a category
 * mega-menu built from the DB, the page content (each page owns its own `<main
 * id="main">` so there is exactly one main landmark), the footer and the floating
 * WhatsApp control. Category reads degrade to an empty nav if the DB is
 * unreachable, so a transient outage never blocks a page render.
 */
export async function SiteShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const a11y = await getTranslations({ locale, namespace: "a11y" });

  let categories: HeaderCategory[] = [];
  try {
    categories = await getNavCategories();
  } catch {
    categories = [];
  }

  let collections: HeaderCollection[] = [];
  try {
    collections = (await listPublicCollections()).map((row) => ({
      slug: row.slug,
      name_en: row.name_en,
      name_bn: row.name_bn,
    }));
  } catch {
    collections = [];
  }

  let featureImage: string | null = null;
  try {
    const featured = await listFeaturedProducts(1);
    featureImage = featured[0]?.thumbnail ?? null;
  } catch {
    featureImage = null;
  }

  let company = PUBLIC_COMPANY_FALLBACK;
  try {
    company = await getPublicCompany();
  } catch {
    company = PUBLIC_COMPANY_FALLBACK;
  }

  const headerWhatsapp =
    whatsappHref(company.whatsapp) ??
    whatsappHref(publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-3 focus:text-foreground"
      >
        {a11y("skipToContent")}
      </a>
      <SiteHeader
        categories={categories}
        collections={collections}
        featureImage={featureImage}
        phone={company.phone}
        whatsappHref={headerWhatsapp}
        locale={locale}
      />
      {children}
      <SiteFooter locale={locale} categories={categories} company={company} />
      <StickyContact href={headerWhatsapp} />
    </>
  );
}
