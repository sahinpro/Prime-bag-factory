import { Suspense } from "react";

import { HeaderActions } from "@/components/site/header-actions";
import type { HeaderCategory } from "@/components/site/header-category";
import { HeaderNav } from "@/components/site/header-nav";
import { ThemeLogo } from "@/components/site/logo";

export type { HeaderCategory };

function HeaderChromeFallback() {
  return (
    <div className="flex min-w-0 flex-1 items-center">
      <div className="hidden h-11 flex-1 md:block" />
      <div className="ml-auto flex h-11 items-center gap-1">
        <span className="size-11" />
        <span className="size-11" />
        <span className="hidden size-11 sm:inline-flex" />
        <span className="hidden h-11 w-28 md:inline-flex" />
        <span className="size-8" />
        <span className="size-8" />
        <span className="size-11 md:hidden" />
      </div>
    </div>
  );
}

export function SiteHeader({
  categories,
  whatsappHref,
}: {
  categories: HeaderCategory[];
  whatsappHref: string | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-16 container items-center gap-2 px-4 md:gap-3">
        <ThemeLogo />
        <Suspense fallback={<HeaderChromeFallback />}>
          <div className="flex min-w-0 flex-1 items-center">
            <HeaderNav categories={categories} />
            <HeaderActions categories={categories} whatsappHref={whatsappHref} />
          </div>
        </Suspense>
      </div>
    </header>
  );
}
