import type { IconSvgElement } from "@hugeicons/react";
import { cn } from "cn";

import { Icon } from "@/components/site/icon";
import { Link } from "@/i18n/navigation";

/** Outlined pill. 44px on touch, 40px from md. Leading icon is decorative. */
export function ChipLink({
  href,
  icon,
  children,
  className,
  ...props
}: {
  href: string;
  icon?: IconSvgElement;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 min-h-11 items-center gap-2 rounded-full border border-foreground bg-surface px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-surface-2 motion-reduce:transition-none md:h-10 md:min-h-10",
        className,
      )}
      {...props}
    >
      {icon ? <Icon icon={icon} size={16} /> : null}
      {children}
    </Link>
  );
}
