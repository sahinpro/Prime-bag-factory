import { TableSkeleton } from "@/components/admin/data/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the orders list: header, the pipeline tab strip, a filter
// row and a table body at final row height so nothing shifts on arrival
// (plan 9c.9).
export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <Skeleton className="h-9 w-16 rounded-control" />
        <Skeleton className="h-9 w-20 rounded-control" />
        <Skeleton className="h-9 w-24 rounded-control" />
        <Skeleton className="h-9 w-24 rounded-control" />
        <Skeleton className="h-9 w-20 rounded-control" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-full max-w-xs rounded-control" />
        <Skeleton className="h-11 w-40 rounded-control" />
        <Skeleton className="h-11 w-32 rounded-control" />
      </div>

      <TableSkeleton rows={8} cols={8} />
    </div>
  );
}
