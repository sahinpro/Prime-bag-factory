import { ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Icon } from "@/components/site/icon";
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
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <Link
      href="/cart"
      aria-label={t("cartAria", { count: String(count) })}
      className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Icon icon={ShoppingBag01Icon} size={18} />
      <span
        aria-hidden="true"
        dir={locale === "bn" ? "rtl" : "ltr"}
        className="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[13px] leading-none font-medium text-ivory"
      >
        {ready ? (count > 99 ? "99+" : count) : ""}
      </span>
    </Link>
  );
}
