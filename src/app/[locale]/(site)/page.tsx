import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PillButton } from "@/components/site/pill-button";
import { ProductGrid } from "@/components/site/product-grid";
import { SectionShell } from "@/components/site/section-shell";
import { Link } from "@/i18n/navigation";
import { isLocale, type Locale } from "@/i18n/routing";
import {
  listFeaturedProducts,
  listPublicCollections,
  listRecentProducts,
  listTopLevelCategoryCards,
  localize,
  type CategoryCard,
} from "@/server/catalog";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  // Translations only — no database awaits above this point, so the hero and
  // the "Why" section live in the prerendered PPR shell. Before this split
  // the whole page streamed as one dynamic chunk and the hero paragraph was
  // the LCP at ~3.3 s on CI (FCP 1.1 s); it now paints with the first frame.
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <main id="main" className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="border-b bg-surface">
        <SectionShell as="div" className="py-14 sm:py-20">
          <p className="type-secondary font-medium text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h1 className="type-display text-balance text-foreground">
            {t("heroTitle")}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-wrap gap-3">
            <PillButton href="/search" locale={locale}>
              {t("ctaShop")}
            </PillButton>
            <PillButton href="/quote" locale={locale} variant="outline">
              {t("ctaQuote")}
            </PillButton>
            <PillButton href="/builder" locale={locale} variant="outline">
              {t("ctaBuilder")}
            </PillButton>
          </div>
        </SectionShell>
      </section>

      {/* DB-driven sections stream behind this boundary (PPR); the hero above
          and the "Why" section below are static and ship in the first flush. */}
      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeSections locale={locale} />
      </Suspense>

      {/* Why */}
      <section className="bg-surface">
        <SectionShell as="div">
          <h2 className="type-section text-foreground">{t("whyTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["1", "2", "3"] as const).map((n) => (
              <div key={n} className="rounded-card border bg-surface-2 p-5">
                <h3 className="mb-1 font-semibold">{t(`why${n}Title`)}</h3>
                <p className="text-sm text-muted-foreground">
                  {t(`why${n}Body`)}
                </p>
              </div>
            ))}
          </div>
        </SectionShell>
      </section>
    </main>
  );
}

async function HomeSections({ locale }: { locale: Locale }) {
  const [featuredRaw, recent, categories, collections, t, c] =
    await Promise.all([
      listFeaturedProducts(8),
      listRecentProducts(8),
      listTopLevelCategoryCards(),
      listPublicCollections(),
      getTranslations({ locale, namespace: "home" }),
      getTranslations({ locale, namespace: "common" }),
    ]);

  const products = featuredRaw.length > 0 ? featuredRaw : recent;

  return (
    <>
      {/* Featured products */}
      {products.length > 0 ? (
        <section className="mx-auto w-full container px-4 py-12">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="type-section text-foreground">{t("featured")}</h2>
            <Link
              href="/search"
              locale={locale}
              className="text-sm font-medium text-gold-text hover:underline"
            >
              {c("viewAll")}
            </Link>
          </div>
          <ProductGrid products={products} locale={locale} priorityCount={4} />
        </section>
      ) : null}

      {/* Shop by category */}
      {categories.length > 0 ? (
        <section>
          <div className="mx-auto w-full container px-4 py-12">
            <h2 className="type-section mb-6 text-foreground">
              {t("categoriesTitle")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((cat) => (
                <CategoryTile key={cat.slug} card={cat} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Shop by industry */}
      {collections.length > 0 ? (
        <section className="mx-auto w-full container px-4 py-12">
          <h2 className="type-section mb-6 text-foreground">
            {t("collectionsTitle")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {collections.map((col) => (
              <CategoryTile
                key={col.slug}
                card={col}
                locale={locale}
                collection
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

// Same containers and grid tracks as the sections above so the swap does not
// shift layout (skeletons match final dimensions per the admin-kit rules).
function HomeSectionsSkeleton() {
  return (
    <>
      <section className="mx-auto w-full container px-4 py-12" aria-hidden>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="h-8 w-40 rounded-control bg-surface-2" />
          <div className="h-4 w-16 rounded-control bg-surface-2" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-card border">
              <div className="aspect-4/3 w-full bg-surface-2" />
              <div className="flex flex-col gap-2 p-4">
                <div className="h-4 w-3/4 rounded-control bg-surface-2" />
                <div className="h-3 w-1/2 rounded-control bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section aria-hidden>
        <div className="mx-auto w-full container px-4 py-12">
          <div className="mb-6 h-8 w-48 rounded-control bg-surface-2" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="min-h-45 rounded-card border bg-surface-2"
              />
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto w-full container px-4 py-12" aria-hidden>
        <div className="mb-6 h-8 w-48 rounded-control bg-surface-2" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-h-45 rounded-card border bg-surface-2" />
          ))}
        </div>
      </section>
    </>
  );
}

async function CategoryTile({
  card,
  locale,
  collection = false,
}: {
  card: CategoryCard;
  locale: Locale;
  collection?: boolean;
}) {
  const name = localize(locale, card.name_en, card.name_bn);
  return (
    <Link
      href={`/${collection ? "collection" : "category"}/${card.slug}`}
      locale={locale}
      className="group relative flex min-h-45 flex-col justify-end overflow-hidden rounded-card border bg-surface transition-shadow hover:shadow-md"
    >
      {card.image_path ? (
        <>
          <div aria-hidden className="absolute inset-0">
            <Image
              src={card.image_path}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-duration-300 transition-transform group-hover:scale-105"
            />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/25 to-transparent"
          />
        </>
      ) : null}
      <div className="relative p-3">
        <h3
          className={`line-clamp-2 font-bold text-lg ${
            card.image_path ? "text-ivory" : ""
          }`}
        >
          {name}
        </h3>
      </div>
    </Link>
  );
}
