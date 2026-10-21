import { TableSkeleton } from "@/components/admin/data/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton for the Shipping zones DataTable layout (plan 9c.9): header, filter row
// and a table body matching final row height so nothing shifts on data arrival.
export default function ShippingLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-control" />
      </div>
      <Skeleton className="h-11 w-full max-w-xs rounded-control" />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
