import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeLogo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("footer");
  const a11y = await getTranslations("a11y");

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-3 focus:text-foreground"
      >
        {a11y("skipToContent")}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3">
        <ThemeLogo />
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggle />
        </div>
      </header>
      {children}
      <footer className="mt-auto border-t border-border px-4 py-6 text-sm text-muted-foreground">
        <p>{t("note")}</p>
      </footer>
    </>
  );
}
