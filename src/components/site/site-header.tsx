import { Suspense } from "react";

import { HeaderActions } from "@/components/site/header-actions";
import type { HeaderCategory } from "@/components/site/header-category";
import type { HeaderCollection } from "@/components/site/header-collection";
import { HeaderFrame } from "@/components/site/header-frame";
import { HeaderNav } from "@/components/site/header-nav";
import {
  IndustriesPanel,
  MobileCatalog,
  ShopPanel,
} from "@/components/site/header-panels";
import { ThemeLogo } from "@/components/site/logo";

export type { HeaderCategory };

function HeaderChromeFallback({ phone }: { phone: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 items-center">
      <div className="hidden h-11 flex-1 lg:block" />
      <div className="ml-auto flex h-11 items-center gap-2">
        <span className="hidden h-10 w-[220px] rounded-full bg-surface-2 xl:inline-flex" />
        <span className="size-10 rounded-full bg-surface-2 xl:hidden" />
        {phone ? (
          <span className="hidden size-10 xl:inline-flex" />
        ) : null}
        <span className="hidden h-10 w-28 rounded-full bg-primary lg:inline-flex" />
        <span className="size-10 rounded-full bg-surface-2" />
        <span className="hidden size-8 lg:inline-flex" />
        <span className="hidden size-8 lg:inline-flex" />
        <span className="size-10 lg:hidden" />
      </div>
    </div>
  );
}

export function SiteHeader({
  categories,
  collections,
  featureImage,
  phone,
  whatsappHref,
  locale,
}: {
  categories: HeaderCategory[];
  collections: HeaderCollection[];
  featureImage: string | null;
  phone: string | null;
  whatsappHref: string | null;
  locale: string;
}) {
  const trimmedPhone = phone?.trim() ? phone.trim() : null;

  return (
    <HeaderFrame>
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 md:px-6 lg:px-8">
        <ThemeLogo imageClassName="h-6 w-auto max-h-6 max-w-none" />
        <Suspense fallback={<HeaderChromeFallback phone={Boolean(trimmedPhone)} />}>
          <div className="flex min-w-0 flex-1 items-center">
            <HeaderNav
              shopPanel={
                <ShopPanel
                  categories={categories}
                  locale={locale}
                  featureImage={featureImage}
                />
              }
              industriesPanel={
                <IndustriesPanel collections={collections} locale={locale} />
              }
            />
            <HeaderActions
              phone={trimmedPhone}
              whatsappHref={whatsappHref}
              sheetCatalog={
                <MobileCatalog
                  categories={categories}
                  collections={collections}
                  locale={locale}
                />
              }
            />
          </div>
        </Suspense>
      </div>
    </HeaderFrame>
  );
}
