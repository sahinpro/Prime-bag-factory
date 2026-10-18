import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the product editor layout (plan 9c.9): header, tab strip, a
// form column and the desktop right rail, at final dimensions so nothing shifts.
export default function EditProductLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-control" />
          <Skeleton className="h-9 w-20 rounded-control" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div className="flex gap-2 border-b border-border pb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-control" />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-11 w-full rounded-control" />
            <Skeleton className="h-11 w-full rounded-control" />
            <Skeleton className="h-11 w-2/3 rounded-control" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    </div>
  );
}
