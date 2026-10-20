import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the new-order form: header line, the two-column body (wide
// left cards for customer / items / pricing / notes, narrow right rail for
// details / summary) at final dimensions — no layout shift when the form lands.
export default function NewOrderLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24 rounded-control" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-80 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
          <Skeleton className="h-56 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    </div>
  );
}
