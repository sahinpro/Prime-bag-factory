import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Media } from "@/components/site/media";
import { ProductGrid } from "@/components/site/product-grid";
import { Button } from "@/components/ui/button";
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
    <main id="main" className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="border-b bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-gold-text">
            {t("eyebrow")}
          </p>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/search" locale={locale}>
                {t("ctaShop")}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/quote" locale={locale}>
                {t("ctaQuote")}
              </Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link href="/builder" locale={locale}>
                {t("ctaBuilder")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured products */}
      {products.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("featured")}
            </h2>
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
        <section className="bg-surface-2">
          <div className="mx-auto w-full max-w-6xl px-4 py-12">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight">
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
        <section className="mx-auto w-full max-w-6xl px-4 py-12">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
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

      {/* Why */}
      <section className="bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-12">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            {t("whyTitle")}
          </h2>
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
        </div>
      </section>
    </main>
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
      className="group flex flex-col overflow-hidden rounded-card border bg-surface transition-shadow hover:shadow-md"
    >
      <Media
        src={card.image_path}
        alt={name}
        sizes="(min-width: 1024px) 25vw, 50vw"
        className="aspect-4/3 w-full"
      />
      <div className="p-3">
        <h3 className="line-clamp-2 font-medium">{name}</h3>
      </div>
    </Link>
  );
}
