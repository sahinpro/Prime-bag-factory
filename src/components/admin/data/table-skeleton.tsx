import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeletons that match final dimensions so no layout shift occurs when data
 * arrives (plan 9c.1.4, 9c.10). Row height is 52px per the DataTable spec.
 */

export function TableSkeleton({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden", className)}
      role="status"
      aria-label="Loading"
    >
      <div className="flex h-9 items-center gap-4 border-b bg-surface-2 px-4">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-3 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex h-13 items-center gap-4 border-b px-4 last:border-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("gap-4", className)}>
      <div className="px-5 pt-5">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-2 px-5 pb-5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </Card>
  );
}
