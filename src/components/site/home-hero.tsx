import {
  Backpack01Icon,
  Building03Icon,
  DeliveryTruck01Icon,
  Leaf01Icon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { ChipLink } from "@/components/site/chip-link";
import {
  HeroFeaturedCard,
  type HeroFeaturedItem,
} from "@/components/site/hero-featured-card";
import { PillButton } from "@/components/site/pill-button";
import { SwatchDot } from "@/components/site/swatch-dot";
import type { Locale } from "@/i18n/routing";
import {
  listFabricSwatches,
  listFeaturedProducts,
  listPublicCollections,
  listRecentProducts,
  listTopLevelCategoryCards,
  localize,
  type CategoryCard,
} from "@/server/catalog";

const pageWidth = "container mx-auto px-4 md:px-6 lg:px-8";

// Static hero art lives in `public/`, so it is referenced by its public URL
// path (not imported as a module, which would resolve under `src/`).
const heroBg = "/images/bags/06-homepage-hero-bag-collection.png";

function iconForSlug(slug: string): IconSvgElement {
  const value = slug.toLowerCase();
  if (/backpack|laptop|travel/.test(value)) return Backpack01Icon;
  if (/jute|eco|leaf/.test(value)) return Leaf01Icon;
  if (/deliver|food|pizza|groc|cold|pharma|milk/.test(value)) {
    return DeliveryTruck01Icon;
  }
  if (/corp|office|event|seminar|conference|ngo|industr/.test(value)) {
    return Building03Icon;
  }
  return ShoppingBag01Icon;
}

export function HeroBento({
  locale,
  eyebrow,
  title,
  subtitle,
  quoteLabel,
  builderLabel,
  swatches,
  card,
  side,
}: {
  locale: Locale;
  eyebrow: string;
  title: string;
  subtitle: string;
  quoteLabel: string;
  builderLabel: string;
  shopLabel: string;
  swatches: React.ReactNode;
  photo: React.ReactNode;
  card: React.ReactNode;
  side: React.ReactNode;
}) {
  return (
    <section>
      <div
        className={`${pageWidth} grid min-w-0 gap-4 py-6 lg:py-8 xl:grid-cols-12`}
      >
        <div
          style={{
            backgroundImage: `url(${heroBg})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
          className="relative overflow-hidden rounded-panel bg-surface shadow-sm xl:col-span-8"
        >
          <div className="absolute inset-0 z-0 bg-black/55 md:bg-black/40" />
          <svg
            aria-hidden="true"
            viewBox="0 0 280 240"
            className="pointer-events-none absolute -left-6 top-6 h-48 w-64 text-white/20"
            fill="none"
          >
            <path
              d="M8 200C70 36 170 16 272 128"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 7"
            />
          </svg>

          <div className=" flex flex-col gap-5 p-3 md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)] md:items-center md:gap-8 md:p-8 xl:min-h-120">
            <div className=" contents z-10 md:flex md:flex-col md:justify-center md:gap-5">
              <div className="relative z-10 order-3 md:order-0">{swatches}</div>
              <div className="relative z-10 order-1 flex flex-col gap-4 md:order-0">
                <p className="type-secondary font-medium text-white/80 [text-shadow:0_1px_6px_rgb(0_0_0/0.6)]">
                  {eyebrow}
                </p>
                <h1 className="type-display max-w-full text-balance text-white ">
                  {title}
                </h1>
              </div>
              <p className="type-secondary relative z-10 order-2 max-w-md text-white/85 [text-shadow:0_1px_6px_rgb(0_0_0/0.6)] md:order-0">
                {subtitle}
              </p>
              <div className="relative z-10 order-4 flex flex-col gap-3 md:order-0">
                <div className="flex flex-wrap gap-3">
                  <PillButton href="/quote" locale={locale}>
                    {quoteLabel}
                  </PillButton>
                  {/* Pinned light-on-dark: the hero art never follows the theme. */}
                  <PillButton
                    href="/builder"
                    locale={locale}
                    variant="outline"
                    className="border-white/70 bg-white/10 text-white hover:bg-white/20"
                  >
                    {builderLabel}
                  </PillButton>
                </div>
              </div>
            </div>
            <div className="relative z-10 order-5 mt-4 md:absolute md:bottom-3 md:right-3 md:mt-0 md:w-96">
              {card}
            </div>
          </div>
        </div>
        {side}
      </div>
    </section>
  );
}

export function SwatchRowSkeleton() {
  return <div className="h-11 w-56 rounded-full bg-surface-2" aria-hidden />;
}

export function HeroPhotoSkeleton() {
  return (
    <div
      aria-hidden
      className="aspect-4/3 w-full rounded-tile bg-white/10 md:aspect-4/5"
    />
  );
}

export function HeroCardSkeleton() {
  return <div aria-hidden className="h-18 rounded-card bg-surface-2" />;
}

export function HeroSideSkeleton() {
  return (
    <div
      aria-hidden
      className="grid gap-4 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1"
    >
      <div className="aspect-16/10 rounded-tile bg-surface-2" />
      <div className="min-h-64 rounded-panel bg-surface" />
    </div>
  );
}

export async function FabricSwatchRow({ locale }: { locale: Locale }) {
  let swatches: Awaited<ReturnType<typeof listFabricSwatches>> = [];
  try {
    swatches = await listFabricSwatches(4);
  } catch {
    return null;
  }
  if (swatches.length < 3) return null;

  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="type-secondary text-white/85 [text-shadow:0_1px_6px_rgb(0_0_0/0.6)]">
        {t("pickFabric")}
      </p>
      <ul className="flex flex-wrap gap-2">
        {swatches.map((swatch) => {
          const name = localize(locale, swatch.name_en, swatch.name_bn);
          return (
            <li key={swatch.code}>
              <SwatchDot
                href={`/builder?fabric=${encodeURIComponent(swatch.code)}`}
                label={t("customizeWith", { name })}
                color={swatch.color_hex}
                imageSrc={swatch.texture_image_path}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export async function HeroPhoto({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });
  let src: string | null = null;
  let alt = t("heroImageAlt");

  try {
    const featured = await listFeaturedProducts(8);
    const pool = featured.length > 0 ? featured : await listRecentProducts(4);
    const hit = pool.find((product) => product.thumbnail);
    if (hit?.thumbnail) {
      src = hit.thumbnail;
      alt = localize(locale, hit.title_en, hit.title_bn);
    }
  } catch {
    src = null;
  }

  return (
    <div className="relative aspect-3/2 w-full overflow-hidden rounded-tile bg-white/10 backdrop-blur-sm border border-white/20 md:aspect-4/5 ">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1280px) 560px, (min-width: 768px) 45vw, 100vw"
          className="object-contain p-4"
        />
      ) : (
        <Image
          src="/images/bags/06-homepage-hero-bag-collection.png"
          alt={t("heroCollectionAlt")}
          fill
          priority
          sizes="(min-width: 1280px) 560px, (min-width: 768px) 45vw, 100vw"
          className="object-cover"
        />
      )}
    </div>
  );
}

export async function HeroFeatured({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });
  let items: HeroFeaturedItem[] = [];
  try {
    const featured = await listFeaturedProducts(5);
    items = featured.slice(0, 5).map((product) => {
      const title = localize(locale, product.title_en, product.title_bn);
      const buyNow = product.type === "buy_now";
      return {
        title,
        href: buyNow ? `/product/${product.slug}` : "/quote",
        cta: buyNow ? t("shopNow") : t("ctaQuote"),
        thumbnail: product.thumbnail,
      };
    });
  } catch {
    items = [];
  }
  if (items.length === 0) return null;
  return <HeroFeaturedCard items={items} />;
}

export async function HeroSide({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });
  let chips: CategoryCard[] = [];
  let chipKind: "collection" | "category" = "category";

  try {
    const [collections, categories] = await Promise.all([
      listPublicCollections(),
      listTopLevelCategoryCards(),
    ]);
    if (collections.length > 0) {
      chips = collections.slice(0, 8);
      chipKind = "collection";
    } else {
      chips = categories.slice(0, 8);
    }
  } catch {
    chips = [];
  }

  return (
    <aside className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
      <div className="relative aspect-video type-secondary inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4ideo overflow-hidden rounded-tile bg-gold-soft dark:bg-surface-2">
        <Image
          src="/images/bags/black-business-briefcase-in-warm-interior.png"
          alt={t("sideImageAlt")}
          fill
          sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4 rounded-panel bg-primary p-5 shadow-sm lg:p-6">
        <h2 className="type-section text-white">{t("sideTitle")}</h2>
        <p className="type-secondary text-white/90">{t("sideBody")}</p>
        {chips.length > 0 ? (
          <>
            <hr className="border-border" />
            <h3 className="type-card-title font-semibold text-foreground">
              {t("shopByUse")}
            </h3>
            <ul className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
              {chips.map((chip) => {
                const name = localize(locale, chip.name_en, chip.name_bn);
                return (
                  <li key={chip.slug} className="shrink-0 snap-start">
                    <ChipLink
                      href={`/${chipKind}/${chip.slug}`}
                      locale={locale}
                      icon={iconForSlug(chip.slug)}
                    >
                      {name}
                    </ChipLink>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </aside>
  );
}

export { pageWidth };
