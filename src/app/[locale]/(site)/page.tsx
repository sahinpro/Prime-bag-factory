import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CategoryTileGrid } from "@/components/site/category-tile-grid";
import {
  FabricSwatchRow,
  HeroBento,
  HeroCardSkeleton,
  HeroFeatured,
  HeroPhoto,
  HeroPhotoSkeleton,
  HeroSide,
  HeroSideSkeleton,
  pageWidth,
  SwatchRowSkeleton,
} from "@/components/site/home-hero";
import { IconCircleButton } from "@/components/site/icon-circle-button";
import { ProductCarousel } from "@/components/site/product-carousel";
import { ProductTile } from "@/components/site/product-tile";
import { isLocale, type Locale } from "@/i18n/routing";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  listFeaturedBuyNow,
  listFeaturedProducts,
  listPublicCollections,
  listRecentProducts,
  listTopLevelCategoryCards,
  localize,
  type ProductSummary,
} from "@/server/catalog";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  // Copy only above the data boundaries, so the headline stays in the first
  // paint. Catalog reads stream in their own slots with matching skeletons.
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <main id="main" className="flex flex-1 flex-col">
      <HeroBento
        locale={locale}
        eyebrow={t("eyebrow")}
        title={t("heroTitle")}
        subtitle={t("heroSubtitle")}
        quoteLabel={t("ctaQuote")}
        builderLabel={t("ctaBuilder")}
        shopLabel={t("ctaShop")}
        swatches={
          <Suspense fallback={<SwatchRowSkeleton />}>
            <FabricSwatchRow locale={locale} />
          </Suspense>
        }
        photo={
          <Suspense fallback={<HeroPhotoSkeleton />}>
            <HeroPhoto locale={locale} />
          </Suspense>
        }
        card={
          <Suspense fallback={<HeroCardSkeleton />}>
            <HeroFeatured locale={locale} />
          </Suspense>
        }
        side={
          <Suspense fallback={<HeroSideSkeleton />}>
            <HeroSide locale={locale} />
          </Suspense>
        }
      />

      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeSections locale={locale} />
      </Suspense>

      <section>
        <div className={`${pageWidth} py-6 lg:py-8`}>
          <div className="rounded-panel bg-surface p-6 shadow-sm lg:p-8">
            <h2 className="type-section text-foreground">{t("whyTitle")}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {(["1", "2", "3"] as const).map((n) => (
                <div key={n} className="flex flex-col gap-1">
                  <h3 className="type-card-title text-foreground">
                    {t(`why${n}Title`)}
                  </h3>
                  <p className="type-secondary text-muted-foreground">
                    {t(`why${n}Body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

async function HomeSections({ locale }: { locale: Locale }) {
  const [buyNow, featuredRaw, recent, categories, collections, t, common] =
    await Promise.all([
      listFeaturedBuyNow(8),
      listFeaturedProducts(8),
      listRecentProducts(8),
      listTopLevelCategoryCards(),
      listPublicCollections(),
      getTranslations({ locale, namespace: "home" }),
      getTranslations({ locale, namespace: "common" }),
    ]);

  const products = featuredRaw.length > 0 ? featuredRaw : recent;
  const readyStock = buyNow.length >= 3;

  return (
    <>
      {readyStock ? (
        <FavoritesBand
          title={t("readyTitle")}
          body={t("readyBody")}
          actionLabel={common("viewAll")}
          locale={locale}
        >
          <ProductCarousel count={buyNow.length} label={t("carouselLabel")}>
            {buyNow.map((product, index) => (
              <ProductTile
                key={product.slug}
                product={product}
                locale={locale}
                eager={index < 3}
                labels={tileLabels(product, locale, t, common)}
              />
            ))}
          </ProductCarousel>
        </FavoritesBand>
      ) : products.length > 0 ? (
        <FavoritesBand
          title={t("featured")}
          body={t("sideBody")}
          actionLabel={common("viewAll")}
          locale={locale}
        >
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.slice(0, 3).map((product, index) => (
              <ProductTile
                key={product.slug}
                product={product}
                locale={locale}
                eager={index < 3}
                labels={tileLabels(product, locale, t, common)}
              />
            ))}
          </div>
        </FavoritesBand>
      ) : null}

      {categories.length > 0 ? (
        <section>
          <div className={`${pageWidth} py-6 lg:py-8`}>
            <h2 className="type-section mb-6 text-foreground">
              {t("categoriesTitle")}
            </h2>
            <CategoryTileGrid
              cards={categories}
              locale={locale}
              kind="category"
            />
          </div>
        </section>
      ) : null}

      {collections.length > 0 ? (
        <section>
          <div className={`${pageWidth} py-6 lg:py-8`}>
            <h2 className="type-section mb-6 text-foreground">
              {t("collectionsTitle")}
            </h2>
            <CategoryTileGrid
              cards={collections}
              locale={locale}
              kind="collection"
            />
          </div>
        </section>
      ) : null}
    </>
  );
}

function tileLabels(
  product: ProductSummary,
  locale: Locale,
  t: Awaited<ReturnType<typeof getTranslations>>,
  common: Awaited<ReturnType<typeof getTranslations>>,
) {
  const title = localize(locale, product.title_en, product.title_bn);
  const price =
    product.priceMin == null ? "" : formatMoney(product.priceMin, locale);
  return {
    fromPrice: t("fromPrice", { price }),
    priceOnRequest: common("priceOnRequest"),
    moq: t("moqShort", { count: formatNumber(product.moq, locale) }),
    customizable: t("customizable"),
    view: t("viewProduct", { name: title }),
  };
}

function FavoritesBand({
  title,
  body,
  actionLabel,
  locale,
  children,
}: {
  title: string;
  body: string;
  actionLabel: string;
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <section className={`${pageWidth} py-6 lg:py-8`}>
      <div className="rounded-panel bg-surface-2 p-6 lg:p-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="type-section text-foreground">{title}</h2>
              <IconCircleButton
                href="/search"
                locale={locale}
                icon={ArrowRight01Icon}
                label={actionLabel}
                size={40}
              />
            </div>
            <p className="type-secondary text-muted-foreground">{body}</p>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

function HomeSectionsSkeleton() {
  return (
    <div className={`${pageWidth} py-6 lg:py-8`} aria-hidden>
      <div className="rounded-panel bg-surface-2 p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="h-8 w-48 rounded-full bg-surface" />
            <div className="h-12 w-full rounded-xl bg-surface" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-card bg-surface" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
