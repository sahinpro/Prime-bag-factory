"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const compact: Record<Locale, string> = {
  en: "EN",
  bn: "বাং",
};

const names: Record<Locale, string> = {
  en: "EN",
  bn: "বাং",
};

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const active = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const href = query ? `${pathname}?${query}` : pathname;
  const next: Locale = active === "bn" ? "en" : "bn";

  return (
    <nav aria-label={t("switcherLabel")} className="flex items-center">
      <Link
        href={href}
        locale={next}
        hrefLang={next}
        lang={next}
        aria-label={names[next]}
        className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-input px-1 text-[13px] bg-primary leading-none font-normal text-foreground"
      >
        {compact[next]}
      </Link>
    </nav>
  );
}
