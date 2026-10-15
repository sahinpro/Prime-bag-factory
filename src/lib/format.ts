import type { Locale } from "@/i18n/routing";

const intlLocale: Record<Locale, string> = {
  en: "en-BD",
  bn: "bn-BD",
};

const banglaDigits = "০১২৩৪৫৬৭৮৯";

/** Convert Bangla digits to ASCII before validation or storage. */
export function toAsciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) =>
    String(banglaDigits.indexOf(digit)),
  );
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale]).format(value);
}

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
