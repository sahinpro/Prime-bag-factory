import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader, type HeaderCategory } from "@/components/site/site-header";
import { StickyContact } from "@/components/site/sticky-contact";
import { getNavCategories } from "@/server/catalog";

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

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-3 focus:text-foreground"
      >
        {a11y("skipToContent")}
      </a>
      <SiteHeader categories={categories} />
      {children}
      <SiteFooter locale={locale} />
      <StickyContact />
    </>
  );
}
