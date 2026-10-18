import { cn } from "@/lib/utils";

/**
 * SegmentBar (plan 9c.5): a horizontal stacked bar plus legend rows carrying the
 * count for each segment. Color is never the only signal — every segment has a
 * text label and a value.
 */
export type Segment = {
  label: string;
  value: number;
  /** A CSS color, normally a chart token such as `var(--chart-1)`. */
  color: string;
};

export function SegmentBar({
  segments,
  total,
  className,
}: {
  segments: Segment[];
  total?: number;
  className?: string;
}) {
  const sum = total ?? segments.reduce((acc, s) => acc + s.value, 0);
  const safeSum = sum || 1;

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={
          segments.map((s) => `${s.label}: ${s.value}`).join(", ") || "No data"
        }
      >
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              width: `${(s.value / safeSum) * 100}%`,
              background: s.color,
            }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
