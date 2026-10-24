import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";

type IconProps = Omit<HugeiconsIconProps, "aria-hidden" | "aria-label"> & {
  /** Names the icon for assistive tech. Omitted icons stay decorative. */
  label?: string;
};

/**
 * Public-site Hugeicons (free stroke). Decorative by default.
 * Safe in Server Components: HugeiconsIcon is createElement-only, no hooks.
 */
export function Icon({
  size = 20,
  strokeWidth = 1.75,
  label,
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      size={size}
      strokeWidth={strokeWidth}
      {...props}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
