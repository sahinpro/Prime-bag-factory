import { ArrowDown01Icon, Building03Icon } from "@hugeicons/core-free-icons";
import { getTranslations } from "next-intl/server";

import type { HeaderCategory } from "@/components/site/header-category";
import type { HeaderCollection } from "@/components/site/header-collection";
import { Icon } from "@/components/site/icon";
import { Media } from "@/components/site/media";
import { SheetClose } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

function labelOf(
  locale: string,
  item: { name_en: string; name_bn: string | null },
) {
  return locale === "bn" && item.name_bn && item.name_bn.trim() !== ""
    ? item.name_bn
    : item.name_en;
}

export async function ShopPanel({
  categories,
  locale,
  featureImage,
}: {
  categories: HeaderCategory[];
  locale: string;
  featureImage: string | null;
}) {
  const t = await getTranslations({ locale, namespace: "header" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{nav("noCategories")}</p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li key={category.slug}>
            <p className="text-sm font-medium text-foreground">
              {labelOf(locale, category)}
            </p>
            <ul className="mt-2 space-y-1">
              {category.children.slice(0, 6).map((child) => (
                <li key={child.slug}>
                  <Link
                    href={`/category/${child.slug}`}
                    className="block py-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {labelOf(locale, child)}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`/category/${category.slug}`}
                  className="block py-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {t("viewAll")}
                </Link>
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <Link
        href="/builder"
        className="flex flex-col justify-end gap-2 overflow-hidden rounded-tile bg-surface-2 p-4"
      >
        {featureImage ? (
          <Media
            src={featureImage}
            alt=""
            sizes="256px"
            className="mb-2 aspect-4/3 w-full rounded-card"
            imgClassName="object-cover"
          />
        ) : null}
        <span className="text-base font-medium text-foreground">
          {t("featureTitle")}
        </span>
        <span className="text-sm text-muted-foreground">
          {t("featureLine")}
        </span>
      </Link>
    </div>
  );
}

export async function IndustriesPanel({
  collections,
  locale,
}: {
  collections: HeaderCollection[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "header" });
  if (collections.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noIndustries")}</p>;
  }
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {collections.map((collection) => (
        <li key={collection.slug}>
          <Link
            href={`/collection/${collection.slug}`}
            className="flex min-h-11 items-center gap-3 rounded-full px-2 text-sm text-foreground hover:bg-surface-2"
          >
            <Icon icon={Building03Icon} size={18} />
            {labelOf(locale, collection)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function MobileCatalog({
  categories,
  collections,
  locale,
}: {
  categories: HeaderCategory[];
  collections: HeaderCollection[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "header" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <details className="group border-b border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
          {t("shop")}
          <Icon
            icon={ArrowDown01Icon}
            size={16}
            className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        {categories.length === 0 ? (
          <p className="px-3 pb-3 text-muted-foreground">
            {nav("noCategories")}
          </p>
        ) : (
          <ul className="space-y-3 px-3 pb-3">
            {categories.map((category) => (
              <li key={category.slug}>
                <p className="font-medium text-foreground">
                  {labelOf(locale, category)}
                </p>
                <ul className="mt-1">
                  {category.children.slice(0, 6).map((child) => (
                    <li key={child.slug}>
                      <SheetClose asChild>
                        <Link
                          href={`/category/${child.slug}`}
                          className="flex min-h-11 items-center text-muted-foreground"
                        >
                          {labelOf(locale, child)}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                  <li>
                    <SheetClose asChild>
                      <Link
                        href={`/category/${category.slug}`}
                        className="flex min-h-11 items-center font-medium text-foreground"
                      >
                        {t("viewAll")}
                      </Link>
                    </SheetClose>
                  </li>
                </ul>
              </li>
            ))}
          </ul>
        )}
      </details>
      <details className="group border-b border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
          {t("industries")}
          <Icon
            icon={ArrowDown01Icon}
            size={16}
            className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        {collections.length === 0 ? (
          <p className="px-3 pb-3 text-muted-foreground">{t("noIndustries")}</p>
        ) : (
          <ul className="px-3 pb-3">
            {collections.map((collection) => (
              <li key={collection.slug}>
                <SheetClose asChild>
                  <Link
                    href={`/collection/${collection.slug}`}
                    className="flex min-h-11 items-center gap-3 text-foreground"
                  >
                    <Icon icon={Building03Icon} size={18} />
                    {labelOf(locale, collection)}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        )}
      </details>
    </>
  );
}
