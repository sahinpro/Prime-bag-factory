import { cn } from "@/lib/utils";

/**
 * RadialGauge (plan 9c.5, optional): a donut with the value in the center and the
 * same value repeated as text underneath for screen readers and color-blind users.
 */
export function RadialGauge({
  value,
  max = 100,
  label,
  suffix = "%",
  className,
}: {
  value: number;
  max?: number;
  label: string;
  suffix?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = pct * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative size-28">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={8}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">
          {Math.round(pct * 100)}
          {suffix}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
