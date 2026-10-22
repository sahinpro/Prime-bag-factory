import { Skeleton } from "@/components/ui/skeleton";

// Skeleton matching the forgot-password card at final size so nothing shifts.
export default function ForgotPasswordLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <Skeleton className="size-12 rounded-full" />
      <div className="w-full max-w-md space-y-8 rounded-card border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-full max-w-72" />
        </div>
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-4 w-32" />
    </main>
  );
}
