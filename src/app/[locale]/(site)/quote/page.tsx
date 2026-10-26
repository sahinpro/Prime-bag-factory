import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { QuoteForm } from "@/components/site/quote-form";
import { isLocale, type Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";
import {
  listCategoryOptions,
  listProductOptions,
  localize,
} from "@/server/catalog";
// Public locale pages sit under the [locale] segment, which next-intl reads above
// every page (root layout + provider). Navigations into this route may block on
// that URL data; the route is fully prerendered via generateStaticParams. See
// src/app/[locale]/layout.tsx for the full rationale.
export const instant = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "quote" });
  return buildMetadata({
    locale,
    path: `/${locale}/quote`,
    title: t("title"),
    description: t("subtitle"),
  });
}

type Sp = {
  product?: string;
  quantity?: string;
  color?: string;
  size?: string;
};

export default function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Sp>;
}) {
  // Prefill values come from the query string, so the form streams in behind
  // Suspense while the page heading prerenders as part of the shell.
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
          <div className="h-9 w-48 animate-pulse rounded-control bg-surface-2" />
          <div className="h-72 animate-pulse rounded-card bg-surface-2" />
        </div>
      }
    >
      <QuoteContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function QuoteContent({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Sp>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const l = locale as Locale;
  const sp = await searchParams;
  const [t, products, categories] = await Promise.all([
    getTranslations({ locale: l, namespace: "quote" }),
    listProductOptions(),
    listCategoryOptions(),
  ]);

  const productOptions = products.map((p) => ({
    id: p.id,
    title: localize(l, p.title_en, p.title_bn),
  }));
  const categoryOptions = categories.map((cat) => ({
    id: cat.id,
    title: localize(l, cat.name_en, cat.name_bn),
  }));

  const defaultProductId = sp.product
    ? products.find((p) => p.slug === sp.product)?.id
    : undefined;

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>

      <QuoteForm
        productOptions={productOptions}
        categoryOptions={categoryOptions}
        defaultProductId={defaultProductId}
        defaultQuantity={sp.quantity}
        defaultColor={sp.color}
        defaultSize={sp.size}
      />
    </main>
  );
}
