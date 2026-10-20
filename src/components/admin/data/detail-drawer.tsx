"use client";

import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * DetailDrawer (plan §9 Customers) — a right-side sheet that opens the full
 * context of a row without leaving the list, so staff keep their place in
 * the table. Controlled (`open` / `onOpenChange`) so the caller can deep-link
 * or close from an action. The title is always rendered (Radix needs it for
 * the dialog's accessible name); the description is optional. Body content
 * scrolls independently; a `footer` pins to the bottom for actions.
 *
 * Kit rules: semantic tokens only, the built-in ghost close button carries
 * an sr-only label, motion is the Sheet's own 200ms slide (already inside
 * the 150-200ms budget and disabled under prefers-reduced-motion by the
 * global rule).
 */
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}>) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full flex-col gap-0 sm:max-w-lg", className)}
      >
        <SheetHeader className="border-b border-border pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="border-t border-border p-4">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
