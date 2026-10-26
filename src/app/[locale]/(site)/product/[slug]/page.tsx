import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  ProductConfigurator,
  type ConfigImage,
  type ConfigTier,
  type ConfigVariant,
} from "@/components/site/product-configurator";
import { ProductGrid } from "@/components/site/product-grid";
import { isLocale, type Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { buildBreadcrumb, buildMetadata, jsonLd, siteUrl } from "@/lib/seo";
import {
  getProductBySlug,
  getRelatedProducts,
  listSitemapProducts,
  localize,
  type PublicProduct,
} from "@/server/catalog";
// Public locale pages sit under the [locale] segment, which next-intl reads above
// every page (root layout + provider). Navigations into this route may block on
// that URL data; the route is fully prerendered via generateStaticParams. See
// src/app/[locale]/layout.tsx for the full rationale.
export const instant = false;
type RouteParams = { locale: string; slug: string };

// Prerender every published product page at build (plan 3b Static + ISR; locales
// come from the `[locale]` layout). Unlisted slugs still render on request — the
// page keeps the Suspense/await-params streaming pattern (partialPrefetching is
// on), so the shell prerenders and the product streams in.
// Cache Components requires a non-empty result, so an empty catalog falls back to
// a single placeholder param that prerenders through `notFound()` into a 404.
export async function generateStaticParams() {
  const products = await listSitemapProducts();
  if (products.length === 0) return [{ slug: "_" }];
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const seoTitle =
    localize(locale, product.seo_title_en, product.seo_title_bn) ||
    localize(locale, product.title_en, product.title_bn);
  const seoDesc =
    localize(locale, product.seo_description_en, product.seo_description_bn) ||
    localize(
      locale,
      product.short_description_en,
      product.short_description_bn,
    );
  return buildMetadata({
    locale,
    path: `/${locale}/product/${slug}`,
    title: seoTitle,
    description: seoDesc,
    ogImage: product.images[0]?.path ?? null,
  });
}

function toConfig(product: PublicProduct, locale: Locale) {
  const images: ConfigImage[] = product.images
    .filter((im) => im.path)
    .map((im) => ({
      src: im.path,
      alt:
        localize(locale, im.alt_en, im.alt_bn) ||
        localize(locale, product.title_en, product.title_bn),
    }));

  const variants: ConfigVariant[] = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    color: v.color_name,
    hex: v.color_hex,
    texture: v.texture_path,
    size: v.size,
    priceDelta: v.price_delta,
    available:
      product.stock_mode === "made_to_order"
        ? null
        : v.stock_qty - v.reserved_qty,
  }));

  const tiers: ConfigTier[] = product.tiers.map((t) => ({
    minQty: t.min_qty,
    maxQty: t.max_qty,
    unitPrice: t.unit_price,
  }));

  return { images, variants, tiers };
}

export default function ProductPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  // The slug is only known at request time, so the product content streams in
  // behind Suspense while the shared shell prerenders.
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full container flex-1 flex-col gap-10 px-4 py-10">
          <div className="h-9 w-2/3 animate-pulse rounded-control bg-surface-2" />
          <div className="aspect-4/3 w-full animate-pulse rounded-card bg-surface-2 sm:aspect-auto sm:h-96" />
        </div>
      }
    >
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const l = locale as Locale;
  const t = await getTranslations({ locale: l, namespace: "product" });
  const c = await getTranslations({ locale: l, namespace: "common" });
  const nav = await getTranslations({ locale: l, namespace: "nav" });

  const title = localize(l, product.title_en, product.title_bn);
  const blurb = localize(
    l,
    product.short_description_en,
    product.short_description_bn,
  );
  const body = localize(l, product.description_en, product.description_bn);
  const { images, variants, tiers } = toConfig(product, l);

  const priceMin = tiers.length
    ? Math.min(...tiers.map((x) => x.unitPrice))
    : null;

  // Plan 8 SEO: Home > Category > Product trail (first category anchors it).
  const primaryCategory = product.categories[0];
  const breadcrumbJsonLd = buildBreadcrumb(l, [
    { name: nav("home"), path: "" },
    ...(primaryCategory
      ? [
          {
            name: localize(l, primaryCategory.name_en, primaryCategory.name_bn),
            path: `/category/${primaryCategory.slug}`,
          },
        ]
      : []),
    { name: title, path: `/product/${product.slug}` },
  ]);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description: blurb || body || undefined,
    image: images.map((im) => im.src),
    url: siteUrl(`/${l}/product/${product.slug}`),
    sku: variants[0]?.sku,
    brand: { "@type": "Brand", name: "Prime Bag Factory" },
    // Plan 8: publish offers only for buy_now; quote_only products omit price.
    ...(product.type === "buy_now" && priceMin != null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "BDT",
            price: priceMin,
            availability:
              product.stock_mode === "made_to_order"
                ? "https://schema.org/BackOrder"
                : "https://schema.org/InStock",
            url: siteUrl(`/${l}/product/${product.slug}`),
          },
        }
      : {}),
  };

  return (
    <main
      id="main"
      className="mx-auto flex w-full container flex-1 flex-col gap-10 px-4 py-10"
    >
      {jsonLd(productJsonLd)}
      {jsonLd(breadcrumbJsonLd)}

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {blurb ? (
          <p className="max-w-2xl text-muted-foreground">{blurb}</p>
        ) : null}
      </div>

      <ProductConfigurator
        slug={product.slug}
        title={title}
        moq={product.moq}
        stockMode={product.stock_mode}
        productType={product.type}
        variants={variants}
        tiers={tiers}
        images={images}
        customizationEnabled={product.customization_enabled}
        locale={l}
      />

      {body ? (
        <section className="prose-neutral max-w-3xl">
          <h2 className="mb-2 text-xl font-semibold">{t("overview")}</h2>
          <div className="whitespace-pre-line text-muted-foreground">
            {body}
          </div>
        </section>
      ) : null}

      <ProductSpec
        product={product}
        locale={l}
        labels={{
          specifications: t("specifications"),
          material: t("material"),
          leadTime: t("leadTime"),
          minOrder: c("minOrder"),
          days: (n: number) => t("days", { count: n }),
          pieces: c("pieces"),
        }}
      />

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("relatedTitle")}</h2>
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">{c("loading")}</p>
          }
        >
          <RelatedProducts product={product} locale={l} />
        </Suspense>
      </section>
    </main>
  );
}

function ProductSpec({
  product,
  locale,
  labels,
}: {
  product: PublicProduct;
  locale: Locale;
  labels: {
    specifications: string;
    material: string;
    leadTime: string;
    minOrder: string;
    days: (n: number) => string;
    pieces: string;
  };
}) {
  const specs = product.specs;
  const rows: { label: string; value: string }[] = [];
  if (product.material)
    rows.push({ label: labels.material, value: product.material });
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    for (const [k, v] of Object.entries(specs as Record<string, unknown>)) {
      if (v == null) continue;
      rows.push({ label: k, value: String(v) });
    }
  }
  if (rows.length === 0 && product.lead_time_days == null) return null;

  return (
    <section className="max-w-3xl">
      <h2 className="mb-3 text-xl font-semibold">{labels.specifications}</h2>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {product.lead_time_days != null ? (
          <SpecRow
            label={labels.leadTime}
            value={labels.days(product.lead_time_days)}
          />
        ) : null}
        <SpecRow
          label={labels.minOrder}
          value={`${formatNumber(product.moq, locale)} ${labels.pieces}`}
        />
        {rows.map((r) => (
          <SpecRow key={r.label} label={r.label} value={r.value} />
        ))}
      </dl>
    </section>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

async function RelatedProducts({
  product,
  locale,
}: {
  product: PublicProduct;
  locale: Locale;
}) {
  const related = await getRelatedProducts(
    product.categories.map((cat) => cat.id),
    product.slug,
    4,
  );
  if (related.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  return <ProductGrid products={related} locale={locale} />;
}
