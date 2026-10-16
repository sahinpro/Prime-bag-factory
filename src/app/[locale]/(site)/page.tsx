import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { isLocale } from "@/i18n/routing";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main id="main" className="flex flex-1 flex-col gap-4 px-4 py-10">
      <h1 lang="en" className="text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <p className="max-w-xl text-muted-foreground">{t("intro")}</p>
    </main>
  );
}
