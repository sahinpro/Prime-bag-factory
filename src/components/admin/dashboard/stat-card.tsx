import { ToneBadge } from "@/components/admin/data/status-badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

/**
 * StatCard (plan 9c.5): icon chip on --surface-2, label, 28px value, an optional
 * delta badge (icon + sign + "vs last week", never color-only) and an optional
 * inline-SVG sparkline. The whole card becomes a link when `href` is provided.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  caption,
  sparkline,
  href,
  className,
}: {
  label: string;
  value: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  delta?: {
    /** Percentage or absolute change; sign drives the tone. */
    value: number;
    /** Formatted text, e.g. "+7.1%". */
    display: string;
    /** Comparison label, e.g. "vs last week". */
    label?: string;
  };
  /** Muted helper line, shown when there is no delta (e.g. a Phase 5 placeholder). */
  caption?: string;
  sparkline?: number[];
  href?: string;
  className?: string;
}) {
  const isPositive = delta ? delta.value >= 0 : undefined;

  const body = (
    <Card
      className={cn(
        "rounded-card p-5 transition-colors",
        href && "hover:bg-surface-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
          <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </span>
        {sparkline && sparkline.length > 1 ? (
          <Sparkline data={sparkline} />
        ) : null}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-[1.75rem] leading-8 font-semibold tabular-nums">
          {value}
        </p>
      </div>
      {delta ? (
        <div className="mt-3 flex items-center gap-2">
          <ToneBadge
            tone={isPositive ? "success" : "destructive"}
            icon={isPositive ? ArrowUpRight : ArrowDownRight}
          >
            {delta.display}
          </ToneBadge>
          {delta.label ? (
            <span className="text-xs text-muted-foreground">{delta.label}</span>
          ) : null}
        </div>
      ) : caption ? (
        <div className="mt-3">
          <span className="text-xs text-muted-foreground">{caption}</span>
        </div>
      ) : null}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none">
        {body}
      </Link>
    );
  }
  return body;
}

/** Hand-written 64x24 sparkline on --chart-1. aria-hidden; numbers are in text. */
function Sparkline({ data }: { data: number[] }) {
  const width = 64;
  const height = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map(
      (d, i) => `${i * step},${height - ((d - min) / span) * (height - 2) - 1}`,
    )
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
