import type { IconSvgElement } from "@hugeicons/react";
import {
  Backpack01Icon,
  Building03Icon,
  DeliveryTruck01Icon,
  Leaf01Icon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons";
import Image from "next/image";

import { BagArt } from "@/components/site/bag-art";
import { Icon } from "@/components/site/icon";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localize, type CategoryCard } from "@/server/catalog";

function iconForSlug(slug: string): IconSvgElement {
  const value = slug.toLowerCase();
  if (/backpack|laptop|travel/.test(value)) return Backpack01Icon;
  if (/jute|eco|leaf/.test(value)) return Leaf01Icon;
  if (/deliver|food|pizza|groc|cold|pharma|milk/.test(value)) {
    return DeliveryTruck01Icon;
  }
  if (/corp|office|event|seminar|conference|ngo|industr/.test(value)) {
    return Building03Icon;
  }
  return ShoppingBag01Icon;
}

/**
 * "Shop by use" grid (plan 8b.4.3): 4 columns on desktop, 2 on mobile, the
 * first tile spans two rows and two columns. Names always sit on a solid
 * chip at the bottom left, never on the photo directly.
 */
export function CategoryTileGrid({
  cards,
  locale,
  kind,
}: {
  cards: CategoryCard[];
  locale: Locale;
  kind: "category" | "collection";
}) {
  return (
    <div className="grid auto-rows-[min-h-45] grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, index) => (
        <CategoryTile
          key={card.slug}
          card={card}
          locale={locale}
          kind={kind}
          feature={index === 0}
        />
      ))}
    </div>
  );
}

function CategoryTile({
  card,
  locale,
  kind,
  feature = false,
}: {
  card: CategoryCard;
  locale: Locale;
  kind: "category" | "collection";
  feature?: boolean;
}) {
  const name = localize(locale, card.name_en, card.name_bn);
  return (
    <Link
      href={`/${kind}/${card.slug}`}
      locale={locale}
      className={`group relative flex min-h-45 flex-col justify-end overflow-hidden rounded-card bg-surface-2 ring-1 ring-border/60 transition-shadow hover:shadow-md ${
        feature ? "col-span-2 row-span-2" : ""
      }`}
    >
      {card.image_path ? (
        <div aria-hidden className="absolute inset-0">
          <Image
            src={card.image_path}
            alt=""
            fill
            sizes={
              feature
                ? "(min-width: 1024px) 50vw, 100vw"
                : "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            }
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </div>
      ) : (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center p-8 opacity-70">
          <BagArt variant={kind === "collection" ? "backpack" : "delivery"} />
        </div>
      )}
      <div className="relative p-3">
        <span className="type-card-title inline-flex max-w-full items-center gap-2 rounded-full bg-surface px-3 py-1.5 font-medium text-foreground shadow-sm">
          <Icon
            icon={iconForSlug(card.slug)}
            size={16}
            className="shrink-0 text-muted-foreground"
          />
          <span className="truncate">{name}</span>
        </span>
      </div>
    </Link>
  );
}
