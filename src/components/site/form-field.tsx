import * as React from "react";

import { Label } from "@/components/ui/label";

/**
 * Minimal labelled field wrapper for the public site forms (quote, checkout):
 * label, control, and a single `role="alert"` error line. Error text arrives as
 * a localized string because both forms render messages client-side.
 */
export function Field({
  id,
  label,
  required,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
