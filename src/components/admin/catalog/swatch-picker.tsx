"use client";

import { SwatchChip } from "@/components/admin/catalog/swatch-chip";
import { cn } from "@/lib/utils";

export type SwatchOption = {
  id: string;
  name: string;
  colorHex: string;
  texturePath?: string | null;
};

/**
 * SwatchPicker (plan 9c.5): a labelled radio group of swatch chips. Keyboard users
 * move with the arrow keys (native radio behavior via roving tabindex is handled by
 * the consumer's form library); each option has a visible name label.
 */
export function SwatchPicker({
  legend,
  value,
  onChange,
  options,
  className,
}: {
  legend: string;
  value: string | null;
  onChange: (id: string) => void;
  options: SwatchOption[];
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div
        role="radiogroup"
        aria-label={legend}
        className="flex flex-wrap gap-3"
      >
        {options.map((opt) => {
          const selected = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-2 py-1.5 pr-3 text-sm transition-colors",
                selected
                  ? "border-foreground bg-surface-2"
                  : "border-border hover:bg-surface-2",
              )}
            >
              <SwatchChip
                colorHex={opt.colorHex}
                textureUrl={opt.texturePath}
                selected={selected}
                size={28}
              />
              <span className="font-medium">{opt.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
