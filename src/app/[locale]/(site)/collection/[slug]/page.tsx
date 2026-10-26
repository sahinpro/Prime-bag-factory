import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductGrid } from "@/components/site/product-grid";
import { Link } from "@/i18n/navigation";
import { isLocale, type Locale } from "@/i18n/routing";
import { buildBreadcrumb, buildMetadata, jsonLd } from "@/lib/seo";
import {
  getCollectionBySlug,
  listSitemapCollections,
  localize,
} from "@/server/catalog";
// Public locale pages sit under the [locale] segment, which next-intl reads above
// every page (root layout + provider). Navigations into this route may block on
// that URL data; the route is fully prerendered via generateStaticParams. See
// src/app/[locale]/layout.tsx for the full rationale.
export const instant = false;
type RouteParams = { locale: string; slug: string };

// Prerender every published collection page at build (plan 3b Static + ISR).
// Unlisted slugs still render on request; the page keeps the Suspense/await-params
// streaming pattern (partialPrefetching is on).
// Cache Components requires a non-empty result, so an empty catalog falls back to
// a single placeholder param that prerenders through `notFound()` into a 404.
export async function generateStaticParams() {
  const slugs = await listSitemapCollections();
  if (slugs.length === 0) return [{ slug: "_" }];
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const collection = await getCollectionBySlug(slug);
  if (!collection) return {};
  return buildMetadata({
    locale,
    path: `/${locale}/collection/${slug}`,
    title: localize(locale, collection.name_en, collection.name_bn),
    description: localize(
      locale,
      collection.description_en,
      collection.description_bn,
    ),
    ogImage: collection.image_path,
  });
}

export default function CollectionPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  // The slug is only known at request time, so the collection content streams
  // in behind Suspense while the shared shell prerenders.
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full container flex-1 flex-col gap-8 px-4 py-10">
          <div className="h-9 w-56 animate-pulse rounded-control bg-surface-2" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-4/3 animate-pulse rounded-card bg-surface-2"
              />
            ))}
          </div>
        </div>
      }
    >
      <CollectionContent params={params} />
    </Suspense>
  );
}

async function CollectionContent({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const l = locale as Locale;
  const [t, c, nav] = await Promise.all([
    getTranslations({ locale: l, namespace: "collection" }),
    getTranslations({ locale: l, namespace: "common" }),
    getTranslations({ locale: l, namespace: "nav" }),
  ]);
  const name = localize(l, collection.name_en, collection.name_bn);
  const description = localize(
    l,
    collection.description_en,
    collection.description_bn,
  );

  return (
    <main
      id="main"
      className="mx-auto flex w-full container flex-1 flex-col gap-8 px-4 py-10"
    >
      {jsonLd(
        buildBreadcrumb(l, [
          { name: nav("home"), path: "" },
          { name, path: `/collection/${collection.slug}` },
        ]),
      )}
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
        {description ? (
          <p className="max-w-2xl text-muted-foreground">{description}</p>
        ) : null}
      </header>

      {collection.products.length > 0 ? (
        <>
          <h2 className="text-sm font-medium text-muted-foreground">
            {collection.products.length} {t("products")}
          </h2>
          <ProductGrid
            products={collection.products}
            locale={l}
            priorityCount={4}
          />
        </>
      ) : (
        <div className="rounded-card border bg-surface-2 p-10 text-center">
          <h2 className="font-medium">{t("emptyTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
          <Link
            href="/search"
            locale={l}
            className="mt-4 inline-flex text-sm font-medium text-gold-text hover:underline"
          >
            {c("browseProducts")}
          </Link>
        </div>
      )}
    </main>
  );
}
