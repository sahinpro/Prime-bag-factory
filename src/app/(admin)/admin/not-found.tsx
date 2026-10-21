import { Compass } from "lucide-react";
import Link from "next/link";

// Admin 404 (plan §15 D3 / R8). English only, no next-intl. Reached when a
// signed-in staff member navigates to an unknown /admin path.
export default function AdminNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Compass aria-hidden="true" strokeWidth={1.75} className="size-6" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>
      </div>
      <Link
        href="/admin"
        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-hover"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
