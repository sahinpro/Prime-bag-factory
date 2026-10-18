import { ProductCard } from "@/components/site/product-card";
import type { Locale } from "@/i18n/routing";
import type { ProductSummary } from "@/server/catalog";

/** Responsive catalog grid. Cards are server components, so no client JS here. */
export function ProductGrid({
  products,
  locale,
  priorityCount = 0,
}: {
  products: ProductSummary[];
  locale: Locale;
  /** How many leading cards get `priority` (above the fold) for LCP. */
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, i) => (
        <ProductCard
          key={product.slug}
          product={product}
          locale={locale}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}
