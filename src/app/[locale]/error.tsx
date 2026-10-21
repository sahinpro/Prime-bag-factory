"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

// Localized public error boundary (plan §15 D3 / R8). Client leaf so it can
// offer reset(). Never render the stack — only a generic, translated message.
export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.somethingWrong");

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
        <TriangleAlert aria-hidden="true" strokeWidth={1.75} className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mx-auto max-w-md text-base text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button onClick={() => reset()}>{t("retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </main>
  );
}
