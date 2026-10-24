import { cn } from "cn";

import { Link } from "@/i18n/navigation";

const variants = {
  primary:
    "bg-primary text-primary-foreground hover:bg-brand-hover",
  outline:
    "border border-foreground bg-surface text-foreground hover:bg-surface-2",
} as const;

/**
 * Full-radius action. 44px on touch, 40px from the md breakpoint.
 * Ink on gold for primary. No new hues.
 */
export function PillButton({
  href,
  children,
  variant = "primary",
  className,
  ...props
}: {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      data-slot="pill-button"
      className={cn(
        "inline-flex h-11 min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none md:h-10 md:min-h-10",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
