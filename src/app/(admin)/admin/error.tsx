"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

// Admin error boundary (plan §15 D3 / R8). English only — admin is outside
// [locale] and must not depend on next-intl. Renders inside the (admin) layout
// (theme + tokens available) but outside the sidebar shell, so it is a plain
// centered card. Never surface the stack.
export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
        <TriangleAlert aria-hidden="true" strokeWidth={1.75} className="size-6" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred while loading this page. Please try
          again.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => router.push("/admin")}>
          Back to dashboard
        </Button>
      </div>
    </main>
  );
}
