import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * SwatchChip (plan 9c.5): a round chip showing a fabric texture photo when
 * available, otherwise the solid hex. A check mark marks the selected swatch.
 * Decorative only — the accessible label comes from SwatchPicker.
 */
export function SwatchChip({
  colorHex,
  textureUrl,
  selected = false,
  size = 32,
  className,
}: {
  colorHex: string;
  textureUrl?: string | null;
  selected?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-foreground/15",
        selected && "ring-2 ring-foreground",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: textureUrl
          ? `center/cover no-repeat url(${textureUrl})`
          : colorHex,
      }}
    >
      {selected ? (
        <Check strokeWidth={2.5} className="size-4 text-ivory drop-shadow" />
      ) : null}
    </span>
  );
}
