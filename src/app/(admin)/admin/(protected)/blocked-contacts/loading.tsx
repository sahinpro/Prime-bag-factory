import { TableSkeleton } from "@/components/admin/data/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the blocked-contacts list (plan 9c.9): header, one flash
// strip absent, a filter row and a 6-column table at final row height so
// nothing shifts when the rows arrive.
export default function BlockedContactsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 w-full max-w-xs rounded-control" />
      </div>

      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
