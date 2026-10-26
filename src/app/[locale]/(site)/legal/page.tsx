import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { isLocale, type Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";
import { listLegalDocuments } from "@/server/content";
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
  const t = await getTranslations({ locale, namespace: "legal" });
  return buildMetadata({
    locale,
    path: `/${locale}/legal`,
    title: t("title"),
  });
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const l = locale as Locale;
  const [t, docs] = await Promise.all([
    getTranslations({ locale: l, namespace: "legal" }),
    listLegalDocuments(),
  ]);

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>

      {/* Terms of service (owner decision 2026-10-18, Phase 4): the commercial
          policy — builder requests are quote-based, standard products are COD
          with a 50% advance — is stated here until the owner publishes the
          real signed legal documents (Phase 7). */}
      <section
        aria-labelledby="tos-heading"
        className="rounded-card border bg-surface p-6"
      >
        <h2 id="tos-heading" className="text-xl font-semibold">
          {t("termsTitle")}
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:text-foreground">
          <li>{t("terms1")}</li>
          <li>{t("terms2")}</li>
          <li>{t("terms3")}</li>
          <li>{t("terms4")}</li>
        </ol>
      </section>

      {docs.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-card border bg-surface">
          {docs.map((doc, i) => (
            <li
              key={i}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col">
                <span className="font-medium">{doc.title}</span>
                <span className="text-sm text-muted-foreground">
                  {doc.number ? `${doc.number} · ` : ""}
                  {t("updated", {
                    date: formatDate(new Date(doc.updated_at), l),
                  })}
                </span>
              </div>
              {doc.image_path ? (
                <a
                  href={doc.image_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gold-text hover:underline"
                >
                  {t("view")}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border bg-surface-2 p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </main>
  );
}
