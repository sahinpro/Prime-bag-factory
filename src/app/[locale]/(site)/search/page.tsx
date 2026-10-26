import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { ProductGrid } from "@/components/site/product-grid";
import { isLocale, type Locale } from "@/i18n/routing";
import { searchProducts } from "@/server/catalog";
// Public locale pages sit under the [locale] segment, which next-intl reads above
// every page (root layout + provider). Navigations into this route may block on
// that URL data; the route is fully prerendered via generateStaticParams. See
// src/app/[locale]/layout.tsx for the full rationale.
export const instant = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: l, namespace: "search" });
  return {
    // Search result pages are internal, thin and parameterized — keep them out
    // of the index (plan 8 SEO).
    title: t("title"),
    robots: { index: false, follow: true },
  };
}

export default function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  // Search params are only known at request time, so the results stream in
  // behind a Suspense boundary while the shell (heading + form) prerenders.
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full container flex-1 flex-col gap-8 px-4 py-10">
          <div className="h-9 w-48 animate-pulse rounded-control bg-surface-2" />
          <div className="h-11 w-full max-w-xl animate-pulse rounded-control bg-surface-2" />
        </div>
      }
    >
      <SearchResults params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchResults({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  setRequestLocale(locale);

  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (raw ?? "").toString();

  const l = locale as Locale;
  const [t, results] = await Promise.all([
    getTranslations({ locale: l, namespace: "search" }),
    searchProducts(q),
  ]);

  const hasQuery = q.trim().length > 0;

  return (
    <main
      id="main"
      className="mx-auto flex w-full container flex-1 flex-col gap-8 px-4 py-10"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>

      <form
        action={`/${l}/search`}
        method="get"
        role="search"
        className="flex w-full max-w-xl gap-2"
      >
        <label htmlFor="q" className="sr-only">
          {t("title")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("placeholder")}
          className="h-11 w-full rounded-control border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          className="h-11 shrink-0 cursor-pointer rounded-control bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-brand-hover"
        >
          {t("button")}
        </button>
      </form>

      {hasQuery ? (
        <h2 className="text-lg font-semibold">
          {t("resultsFor", { q })}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {t("count", { count: results.length })}
          </span>
        </h2>
      ) : (
        // Keep the heading order valid (h1 -> h2 -> product h3) even with no
        // query; the default recent-products grid still needs an h2 landmark.
        <h2 className="sr-only">{t("title")}</h2>
      )}

      {results.length > 0 ? (
        <ProductGrid products={results} locale={l} priorityCount={4} />
      ) : (
        <div className="rounded-card border bg-surface-2 p-10 text-center">
          <p className="font-medium">{t("none")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("tryKeywords")}
          </p>
        </div>
      )}
    </main>
  );
}
