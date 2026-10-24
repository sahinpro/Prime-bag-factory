import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { redirect } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";

/** G3 policy pages are not written yet — planned slugs redirect to `/legal`. */
export async function redirectToLegal(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  redirect({ href: "/legal", locale });
}
