import { WhatsappIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/site/icon";
import { getTranslations } from "next-intl/server";

/**
 * Floating WhatsApp launcher shown on every public page (plan §8). Only WhatsApp
 * for now — the Messenger button needs a page handle that has no env/settings
 * source yet, so it is deferred (see Decision Log) rather than shipping a dead
 * control.
 */
export async function StickyContact({ href }: { href: string | null }) {
  const t = await getTranslations("contact");
  if (!href) return null;

  return (
    // A named complementary landmark so the floating launcher is contained by a
    // region (axe `region`) instead of sitting bare on the page body.
    <aside
      aria-label={t("whatsapp")}
      data-sticky-contact=""
      className="fixed right-4 bottom-4 z-40"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 font-medium text-accent-foreground shadow-lg transition-transform duration-150 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Icon icon={WhatsappIcon} size={20} aria-hidden="true" />
        <span className="hidden sm:inline">{t("whatsapp")}</span>
        <span className="sr-only sm:hidden">{t("whatsapp")}</span>
      </a>
    </aside>
  );
}
