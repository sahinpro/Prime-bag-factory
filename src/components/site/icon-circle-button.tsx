import type { IconSvgElement } from "@hugeicons/react";
import { cn } from "cn";

import { Icon } from "@/components/site/icon";
import { Link } from "@/i18n/navigation";

const sizes = {
  40: "size-10",
  44: "size-11",
} as const;

const tones = {
  surface: "bg-surface-2 text-foreground hover:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted",
} as const;

type Common = {
  icon: IconSvgElement;
  label: string;
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
  className?: string;
};

const circleClass =
  "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none";

export function IconCircleButton({
  icon,
  label,
  size = 40,
  tone = "surface",
  className,
  ...props
}: Common &
  (
    | ({ href: string } & Omit<
        React.ComponentProps<typeof Link>,
        "href" | "className" | "children" | "aria-label"
      >)
    | ({ href?: undefined } & Omit<
        React.ComponentProps<"button">,
        "className" | "children" | "aria-label"
      >)
  )) {
  const classNames = cn(circleClass, sizes[size], tones[tone], className);
  const glyph = <Icon icon={icon} size={size === 44 ? 20 : 18} />;

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} aria-label={label} className={classNames} {...linkProps}>
        {glyph}
      </Link>
    );
  }

  const buttonProps = props as Omit<
    React.ComponentProps<"button">,
    "className" | "children" | "aria-label"
  >;
  return (
    <button type="button" aria-label={label} className={classNames} {...buttonProps}>
      {glyph}
    </button>
  );
}
