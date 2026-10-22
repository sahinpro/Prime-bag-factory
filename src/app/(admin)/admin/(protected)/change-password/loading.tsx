import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the change-password page (header + form card) so nothing
// shifts when the form arrives.
export default function ChangePasswordLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>

      <div className="max-w-lg space-y-4 rounded-card border border-border bg-card p-6">
        <Skeleton className="h-5 w-28" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    </div>
  );
}
