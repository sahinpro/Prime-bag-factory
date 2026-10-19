import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductGrid } from "@/components/site/product-grid";
import { Link } from "@/i18n/navigation";
import { isLocale, type Locale } from "@/i18n/routing";
import { buildBreadcrumb, buildMetadata, jsonLd } from "@/lib/seo";
import { getCategoryBySlug, localize } from "@/server/catalog";

type RouteParams = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return buildMetadata({
    locale,
    path: `/${locale}/category/${slug}`,
    title: localize(locale, category.name_en, category.name_bn),
    description: localize(
      locale,
      category.description_en,
      category.description_bn,
    ),
    ogImage: category.image_path,
  });
}

export default function CategoryPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  // The slug is only known at request time, so the category content streams in
  // behind Suspense while the shared shell prerenders.
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
      <CategoryContent params={params} />
    </Suspense>
  );
}

async function CategoryContent({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const l = locale as Locale;
  const [t, c, nav] = await Promise.all([
    getTranslations({ locale: l, namespace: "category" }),
    getTranslations({ locale: l, namespace: "common" }),
    getTranslations({ locale: l, namespace: "nav" }),
  ]);
  const name = localize(l, category.name_en, category.name_bn);
  const description = localize(
    l,
    category.description_en,
    category.description_bn,
  );

  return (
    <main
      id="main"
      className="mx-auto flex w-full container flex-1 flex-col gap-8 px-4 py-10"
    >
      {jsonLd(
        buildBreadcrumb(l, [
          { name: nav("home"), path: "" },
          { name, path: `/category/${category.slug}` },
        ]),
      )}
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
        {description ? (
          <p className="max-w-2xl text-muted-foreground">{description}</p>
        ) : null}
      </header>

      {category.siblings.length > 0 ? (
        <nav aria-label={t("subcategories")} className="flex flex-wrap gap-2">
          {category.siblings.map((sib) => (
            <Link
              key={sib.slug}
              href={`/category/${sib.slug}`}
              locale={l}
              className="rounded-control border bg-surface px-3 py-1.5 text-sm hover:bg-muted"
            >
              {localize(l, sib.name_en, sib.name_bn)}
            </Link>
          ))}
        </nav>
      ) : null}

      {category.products.length > 0 ? (
        <>
          <h2 className="text-sm font-medium text-muted-foreground">
            {category.products.length} {t("products")}
          </h2>
          <ProductGrid
            products={category.products}
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
