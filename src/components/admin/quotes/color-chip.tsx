import { SwatchChip } from "@/components/admin/catalog/swatch-chip";

/**
 * ColorChip (plan §9 Quotes "builder requests shown with color chips"): a
 * SwatchChip paired with its text name and hex, so color is never the only
 * signal. Server-safe — used by the quote detail view and the print sheets.
 */
export function ColorChip({
  name,
  hex,
  label,
}: Readonly<{
  name?: string | null;
  hex?: string | null;
  label: string;
}>) {
  if (!name && !hex) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-control border border-border bg-surface px-2 py-1">
      {hex ? <SwatchChip colorHex={hex} size={20} /> : null}
      <span className="text-sm">
        <span className="text-muted-foreground">{label}: </span>
        {name ?? "Unnamed"}
        {hex ? (
          <span className="text-xs text-muted-foreground"> ({hex})</span>
        ) : null}
      </span>
    </span>
  );
}
