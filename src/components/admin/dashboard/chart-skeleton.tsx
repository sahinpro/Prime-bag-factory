import { Skeleton } from "@/components/ui/skeleton";

// Chart skeleton (plan 9c.9). The height matches the ChartCard content box so the
// final chart does not shift layout: sm=96, md=192, lg=256 px.
const HEIGHTS = { sm: "h-24", md: "h-48", lg: "h-64" } as const;

export function ChartSkeleton({
  height = "lg",
}: {
  height?: keyof typeof HEIGHTS;
}) {
  return (
    <div
      className={`flex w-full flex-col justify-end gap-2 ${HEIGHTS[height]}`}
      aria-hidden="true"
    >
      <div className="flex flex-1 items-end gap-2">
        {[40, 65, 50, 80, 60, 90, 70].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}
