import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrderLookup } from "@/components/site/order-status";
import { isLocale, type Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; orderNo: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: l, namespace: "order" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; orderNo: string }>;
}) {
  // The order number is runtime data, so the body streams in behind a static
  // shell (same shape as the product and search pages).
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10" aria-busy="true">
          <div className="h-9 w-56 animate-pulse rounded-control bg-surface-2" />
          <div className="h-48 animate-pulse rounded-card bg-muted" />
        </div>
      }
    >
      <OrderContent params={params} />
    </Suspense>
  );
}

async function OrderContent({
  params,
}: {
  params: Promise<{ locale: string; orderNo: string }>;
}) {
  const { locale, orderNo } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  // Order status is personal and changes minute to minute — always on request.
  await connection();

  const t = await getTranslations({ locale, namespace: "order" });

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <OrderLookup orderNo={decodeURIComponent(orderNo)} />
    </main>
  );
}
