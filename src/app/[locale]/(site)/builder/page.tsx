import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  BuilderWizard,
  type BuilderCategory,
} from "@/components/site/builder-wizard";
import { isLocale, type Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";
import {
  getProductBySlug,
  listSwatchGroups,
  listTopLevelCategoryCards,
  localize,
} from "@/server/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "builder" });
  return buildMetadata({
    locale,
    path: `/${locale}/builder`,
    title: t("title"),
    description: t("subtitle"),
  });
}

type BuilderSearchParams = Promise<{ product?: string; category?: string }>;

export default function BuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: BuilderSearchParams;
}) {
  // A `?product=` / `?category=` preselect is read from the query string, so the
  // wizard streams in behind Suspense while the heading prerenders.
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
          <div className="h-9 w-56 animate-pulse rounded-control bg-surface-2" />
          <div className="h-72 animate-pulse rounded-card bg-surface-2" />
        </div>
      }
    >
      <BuilderContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BuilderContent({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: BuilderSearchParams;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const l = locale as Locale;
  const sp = await searchParams;
  const [t, cards, swatchGroups] = await Promise.all([
    getTranslations({ locale: l, namespace: "builder" }),
    listTopLevelCategoryCards(),
    listSwatchGroups(),
  ]);

  const categories: BuilderCategory[] = cards.map((c) => ({
    id: c.slug,
    slug: c.slug,
    name: localize(l, c.name_en, c.name_bn),
  }));

  // Optional preselect from a product link (?product=slug) — best effort.
  let defaultCategoryId: string | undefined = sp.category
    ? (categories.find((c) => c.slug === sp.category)?.id ?? undefined)
    : undefined;
  if (!defaultCategoryId && sp.product) {
    const product = await getProductBySlug(sp.product);
    const firstCat = product?.categories[0];
    if (firstCat) {
      defaultCategoryId =
        categories.find((c) => c.slug === firstCat.slug)?.id ?? undefined;
    }
  }

  const hasMaterials = categories.length > 0 && swatchGroups.length > 0;

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      {hasMaterials ? (
        <BuilderWizard
          categories={categories}
          swatchGroups={swatchGroups}
          defaultCategoryId={defaultCategoryId}
        />
      ) : (
        <p className="rounded-card border bg-surface-2 p-8 text-center text-muted-foreground">
          {t("notAvailable")}
        </p>
      )}
    </main>
  );
}
