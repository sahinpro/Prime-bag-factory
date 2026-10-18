import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the Swatch Library layout (plan 9c.9): header, a group tab
// strip and a grid of swatch cards at final dimensions so nothing shifts in.
export default function SwatchesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-control" />
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <Skeleton className="h-9 w-28 rounded-control" />
        <Skeleton className="h-9 w-24 rounded-control" />
        <Skeleton className="h-9 w-24 rounded-control" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-44 rounded-control" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[84px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
