import { ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/site/icon";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cartCount, useCartItems } from "@/lib/cart";

/**
 * Header cart link (plan Phase 5 task 1). Count comes from the persisted
 * client store, so this is rendered outside the header's cached shell — it
 * would otherwise show zero for a customer holding a cart.
 */
export function CartLink() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const items = useCartItems();
  const count = cartCount(items);

  return (
    <Button variant="ghost" size="icon" asChild>
      <Link href="/cart" aria-label={t("cartAria", { count: String(count) })}>
        <span
          aria-hidden="true"
          dir={locale === "bn" ? "rtl" : "ltr"}
          className="relative inline-flex"
        >
          <Icon icon={ShoppingBag01Icon} size={20} />
          {count > 0 ? (
            <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-deep px-1 text-[10px] font-bold leading-none text-gold-soft">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </span>
      </Link>
    </Button>
  );
}
