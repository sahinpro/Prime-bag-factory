import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the content workspace (plan 9c.9): header, the type rail,
// then the list card and editor card at their final widths so nothing shifts.
export default function ContentLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <Skeleton className="h-9 w-32 rounded-control" />
        <Skeleton className="h-9 w-20 rounded-control" />
        <Skeleton className="h-9 w-20 rounded-control" />
        <Skeleton className="h-9 w-28 rounded-control" />
        <Skeleton className="h-9 w-16 rounded-control" />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-2 rounded-card border p-4">
          <Skeleton className="h-8 w-full rounded-control" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-control" />
          ))}
        </div>
        <div className="space-y-4 rounded-card border p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full max-w-xs rounded-control" />
          <Skeleton className="h-10 w-full max-w-xs rounded-control" />
          <Skeleton className="h-24 w-full rounded-control" />
        </div>
      </div>
    </div>
  );
}
