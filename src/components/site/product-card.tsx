import { getTranslations } from "next-intl/server";

import { Media } from "@/components/site/media";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatMoney, formatNumber } from "@/lib/format";
import { localize, type ProductSummary } from "@/server/catalog";

/**
 * Catalog product tile. Server-rendered (no client JS) so the home, category,
 * collection and search grids stay light for Lighthouse. Price is always derived
 * from quantity tiers on the server — never trusted from the client (AGENTS).
 */
export async function ProductCard({
  product,
  locale,
  priority = false,
}: {
  product: ProductSummary;
  locale: Locale;
  priority?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "common" });
  const title = localize(locale, product.title_en, product.title_bn);
  const blurb = localize(
    locale,
    product.short_description_en,
    product.short_description_bn,
  );

  return (
    <Link
      href={`/product/${product.slug}`}
      locale={locale}
      className="group flex flex-col overflow-hidden rounded-card border bg-surface transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Media
        src={product.thumbnail}
        alt={title}
        priority={priority}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className="aspect-4/3 w-full"
        imgClassName="transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 font-medium text-foreground">{title}</h3>
        {blurb ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{blurb}</p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            {product.priceMin != null ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {t("from")}
                </span>
                <span className="font-semibold text-gold-text">
                  {formatMoney(product.priceMin, locale)}
                </span>
              </>
            ) : (
              <span className="font-semibold text-gold-text">
                {t("priceOnRequest")}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {t("minOrder")} {formatNumber(product.moq, locale)} {t("pieces")}
            </span>
          </div>
          {product.customization_enabled ? (
            <Badge variant="secondary">{t("customize")}</Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
