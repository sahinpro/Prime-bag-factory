import { cn } from "cn";
import Image from "next/image";

import { Link } from "@/i18n/navigation";

/**
 * Fabric swatch as a link (plan 8b.4.1). No selected state.
 * `color` is the swatch's own hex from the library, not a brand color.
 */
export function SwatchDot({
  href,
  label,
  color,
  imageSrc,
  className,
}: {
  href: string;
  label: string;
  color?: string | null;
  imageSrc?: string | null;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        // Only used on the dark hero art: the white ring is pinned so the
        // swatches read the same in both themes.
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-primary",
        className,
      )}
    >
      <span className="relative size-7 overflow-hidden rounded-full bg-surface-2">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            width={32}
            height={32}
            className="size-8 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="block size-8"
            style={color ? { backgroundColor: color } : undefined}
          />
        )}
      </span>
    </Link>
  );
}
