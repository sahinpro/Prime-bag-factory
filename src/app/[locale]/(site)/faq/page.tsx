import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { isLocale, type Locale } from "@/i18n/routing";
import { buildMetadata, jsonLd } from "@/lib/seo";
import { localize } from "@/server/catalog";
import { listFaqs } from "@/server/content";
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
  const t = await getTranslations({ locale, namespace: "faq" });
  return buildMetadata({
    locale,
    path: `/${locale}/faq`,
    title: t("title"),
    description: t("intro"),
  });
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const l = locale as Locale;
  const [t, faqs] = await Promise.all([
    getTranslations({ locale: l, namespace: "faq" }),
    listFaqs(),
  ]);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: localize(l, f.question_en, f.question_bn),
      acceptedAnswer: {
        "@type": "Answer",
        text: localize(l, f.answer_en, f.answer_bn),
      },
    })),
  };

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10"
    >
      {faqs.length > 0 ? jsonLd(faqJsonLd) : null}

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      {faqs.length > 0 ? (
        <div className="flex flex-col gap-2">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="rounded-card border bg-surface px-4 py-3 open:bg-surface-2"
            >
              <summary className="cursor-pointer font-medium marker:content-none">
                {localize(l, f.question_en, f.question_bn)}
              </summary>
              <p className="mt-2 text-muted-foreground">
                {localize(l, f.answer_en, f.answer_bn)}
              </p>
            </details>
          ))}
        </div>
      ) : (
        <p className="rounded-card border bg-surface-2 p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </main>
  );
}
