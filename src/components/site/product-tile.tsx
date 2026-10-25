import { PlusSignIcon, Tick02Icon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/site/icon";
import { IconCircleButton } from "@/components/site/icon-circle-button";
import { Media } from "@/components/site/media";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localize, type ProductSummary } from "@/server/catalog";

/**
 * Ready-stock tile. The round control opens the product page.
 * Quote-only products never show a retail price.
 */
export function ProductTile({
  product,
  locale,
  labels,
  eager = false,
}: {
  product: ProductSummary;
  locale: Locale;
  labels: {
    fromPrice: string;
    priceOnRequest: string;
    moq: string;
    customizable: string;
    view: string;
  };
  eager?: boolean;
}) {
  const title = localize(locale, product.title_en, product.title_bn);
  const showPrice = product.type === "buy_now" && product.priceMin != null;

  return (
    <article className="flex min-w-0 flex-col gap-3">
      <Link
        href={`/product/${product.slug}`}
        locale={locale}
        className="group flex flex-col gap-3 rounded-md"
      >
        <Media
          src={product.thumbnail}
          alt={title}
          loading={eager ? "eager" : "lazy"}
          sizes="(min-width: 1280px) 280px, (min-width: 768px) 40vw, 85vw"
          className="aspect-square w-full rounded-[var(--radius-card)] bg-surface"
          imgClassName="object-contain p-3 transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <h3 className="type-card-title truncate text-foreground" title={title}>
          {title}
        </h3>
      </Link>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="type-price text-foreground">
            {showPrice ? labels.fromPrice : labels.priceOnRequest}
          </p>
          <p className="type-secondary text-muted-foreground">{labels.moq}</p>
          {product.customization_enabled ? (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-accent">
              <Icon icon={Tick02Icon} size={16} />
              {labels.customizable}
            </p>
          ) : null}
        </div>
        <IconCircleButton
          href={`/product/${product.slug}`}
          locale={locale}
          icon={PlusSignIcon}
          label={labels.view}
          size={44}
        />
      </div>
    </article>
  );
}
