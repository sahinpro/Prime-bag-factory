"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const options: { locale: Locale; label: string; lang: Locale }[] = [
  { locale: "en", label: "EN", lang: "en" },
  { locale: "bn", label: "বাংলা", lang: "bn" },
];

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const active = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <nav aria-label={t("switcherLabel")} className="flex items-center gap-2">
      {options.map((option) => {
        const current = active === option.locale;
        return (
          <Link
            key={option.locale}
            href={href}
            locale={option.locale}
            hrefLang={option.locale}
            lang={option.lang}
            aria-current={current ? "true" : undefined}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-semibold text-foreground aria-[current=true]:bg-gold-soft aria-[current=true]:text-ink"
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
