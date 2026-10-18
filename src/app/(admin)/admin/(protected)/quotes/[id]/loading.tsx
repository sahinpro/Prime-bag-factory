import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the quote detail layout: header, badge row and the
// two-column body (wide left cards, narrow right rail) at final dimensions.
export default function QuoteDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-control" />
          <Skeleton className="h-9 w-24 rounded-control" />
          <Skeleton className="h-9 w-28 rounded-control" />
        </div>
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-80 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      </div>
    </div>
  );
}
