import type { IconSvgElement } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Backpack01Icon,
  Building03Icon,
  DeliveryTruck01Icon,
  Leaf01Icon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { BagArt } from "@/components/site/bag-art";
import { ChipLink } from "@/components/site/chip-link";
import {
  HeroFeaturedCard,
  type HeroFeaturedItem,
} from "@/components/site/hero-featured-card";
import { Icon } from "@/components/site/icon";
import { PillButton } from "@/components/site/pill-button";
import { SwatchDot } from "@/components/site/swatch-dot";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import {
  listFabricSwatches,
  listFeaturedProducts,
  listPublicCollections,
  listRecentProducts,
  listTopLevelCategoryCards,
  localize,
  type CategoryCard,
} from "@/server/catalog";
import { getPublicCompany, whatsappHref } from "@/server/public-settings";

const pageWidth =
  "mx-auto w-full max-w-[1440px] px-4 md:px-6 lg:px-8";

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
  shopLabel,
  swatches,
  photo,
  card,
  whatsapp,
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
  whatsapp: React.ReactNode;
  side: React.ReactNode;
}) {
  return (
    <section>
      <div className={`${pageWidth} grid min-w-0 gap-4 py-6 lg:py-8 xl:grid-cols-12`}>
        <div className="relative overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-sm xl:col-span-8">
          <svg
            aria-hidden="true"
            viewBox="0 0 280 240"
            className="pointer-events-none absolute -left-6 top-6 h-48 w-64 text-border"
            fill="none"
          >
            <path
              d="M8 200C70 36 170 16 272 128"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 7"
            />
          </svg>
          <div className="relative flex flex-col gap-5 p-5 md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)] md:items-center md:gap-8 md:p-8 xl:min-h-[520px]">
            <div className="contents md:flex md:flex-col md:justify-center md:gap-5">
              <div className="order-3 md:order-none">{swatches}</div>
              <div className="order-1 flex flex-col gap-4 md:order-none">
                <p className="type-secondary font-medium text-muted-foreground">
                  {eyebrow}
                </p>
                <h1 className="type-display max-w-full text-balance text-foreground">
                  {title}
                </h1>
              </div>
              <p className="type-secondary order-2 max-w-md text-muted-foreground md:order-none">
                {subtitle}
              </p>
              <div className="order-4 flex flex-col gap-3 md:order-none">
                <div className="flex flex-wrap gap-3">
                  <PillButton href="/quote" locale={locale}>
                    {quoteLabel}
                  </PillButton>
                  <PillButton href="/builder" locale={locale} variant="outline">
                    {builderLabel}
                  </PillButton>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link
                    href="/search"
                    locale={locale}
                    className="type-secondary inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
                  >
                    {shopLabel}
                    <Icon icon={ArrowRight01Icon} size={16} />
                  </Link>
                  {whatsapp}
                </div>
              </div>
            </div>
            <div className="relative order-5 min-w-0 md:order-none">
              {photo}
              <div className="mt-4 md:absolute md:inset-x-3 md:bottom-3 md:mt-0">
                {card}
              </div>
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
      className="aspect-[4/3] w-full rounded-[var(--radius-tile)] bg-gold-soft md:aspect-[4/5] dark:bg-surface-2"
    />
  );
}

export function HeroCardSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[4.5rem] rounded-[var(--radius-card)] bg-surface-2"
    />
  );
}

export function HeroSideSkeleton() {
  return (
    <div
      aria-hidden
      className="grid gap-4 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1"
    >
      <div className="aspect-[16/10] rounded-[var(--radius-tile)] bg-surface-2" />
      <div className="min-h-64 rounded-[var(--radius-panel)] bg-surface" />
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
      <p className="type-secondary text-muted-foreground">{t("pickFabric")}</p>
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
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-tile)] bg-gold-soft md:aspect-[4/5] dark:bg-surface-2">
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
        <div role="img" aria-label={alt} className="absolute inset-6">
          <BagArt variant="delivery" />
        </div>
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

export async function HeroWhatsApp({ locale }: { locale: Locale }) {
  let href: string | null = null;
  try {
    const company = await getPublicCompany();
    href =
      whatsappHref(company.whatsapp) ??
      whatsappHref(publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER);
  } catch {
    href = whatsappHref(publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER);
  }
  if (!href) return null;
  const t = await getTranslations({ locale, namespace: "home" });
  return (
    <a
      href={href}
      className="type-secondary font-medium text-foreground underline underline-offset-4"
    >
      {t("whatsappCta")}
    </a>
  );
}

export async function HeroSide({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });
  let chips: CategoryCard[] = [];
  let chipKind: "collection" | "category" = "category";
  let picture: { src: string; alt: string } | null = null;

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
    const pictured = [...collections, ...categories].find((card) => card.image_path);
    if (pictured?.image_path) {
      picture = {
        src: pictured.image_path,
        alt: localize(locale, pictured.name_en, pictured.name_bn),
      };
    }
  } catch {
    chips = [];
  }

  return (
    <aside className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-tile)] bg-gold-soft dark:bg-surface-2">
        {picture ? (
          <Image
            src={picture.src}
            alt={picture.alt}
            fill
            sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={t("heroImageAlt")}
            className="absolute inset-6"
          >
            <BagArt variant="backpack" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-sm lg:p-6">
        <h2 className="type-section text-foreground">{t("sideTitle")}</h2>
        <p className="type-secondary text-muted-foreground">{t("sideBody")}</p>
        {chips.length > 0 ? (
          <>
            <hr className="border-border" />
            <h3 className="type-card-title text-foreground">{t("shopByUse")}</h3>
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
