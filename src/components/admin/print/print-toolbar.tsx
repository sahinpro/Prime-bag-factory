"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Screen-only toolbar for print documents: a Print button and a back link to
 * the quote. `print:hidden` keeps it out of the paper (plan 9c.5 PrintSheet —
 * the printed sheet is header, body and footer only).
 */
export function PrintToolbar({
  documentTitle,
}: Readonly<{ documentTitle: string }>) {
  return (
    <div className="mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between gap-3 px-6 print:hidden sm:px-0">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/quotes">
          <ArrowLeft
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4"
          />
          Back to quotes
        </Link>
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Print {documentTitle}
      </Button>
    </div>
  );
}
