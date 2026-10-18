"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Screen-only toolbar for print documents: a Print button and a back link to the
 * record's inbox. `print:hidden` keeps it out of the paper (plan 9c.5 PrintSheet —
 * the printed sheet is header, body and footer only).
 *
 * The back target is a prop because the same sheet serves quotes and orders; the
 * quote defaults keep the existing pages unchanged.
 */
export function PrintToolbar({
  documentTitle,
  backHref = "/admin/quotes",
  backLabel = "Back to quotes",
}: Readonly<{
  documentTitle: string;
  backHref?: string;
  backLabel?: string;
}>) {
  return (
    <div className="mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between gap-3 px-6 print:hidden sm:px-0">
      <Button variant="ghost" size="sm" asChild>
        <Link href={backHref}>
          <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
          {backLabel}
        </Link>
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Print {documentTitle}
      </Button>
    </div>
  );
}
