"use client";

import { Ban, CircleCheckBig, Undo2 } from "lucide-react";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTrigger,
} from "@/components/ui/stepper";
import { cn } from "@/lib/utils";

/**
 * Read-only fulfilment progress built on the Stepperize-based `Stepper`.
 *
 * Order/production status is server state, not a wizard, so this component is
 * presentational only: the wizard's `tablist`/`tab` semantics and internal
 * navigation are replaced with a plain `list` of `listitem`s, every trigger is
 * a non-interactive span, and the current step is announced with
 * `aria-current="step"` plus an sr-only "Step N of M: Label". The stepper is
 * remounted via `key={current}` so server state is always the source of truth
 * (no controlled-value effect lag, no onValueChange-on-mount).
 */

export type ProgressStep = {
  id: string;
  label: string;
};

/**
 * Module-level constants — the stepper lib calls `defineStepper` once via a
 * ref, so the step list must be a stable reference across renders.
 */
export const ORDER_PROGRESS_STEPS: ProgressStep[] = [
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
];

export const PRODUCTION_PROGRESS_STEPS: ProgressStep[] = [
  { id: "awaiting_artwork", label: "Awaiting artwork" },
  { id: "artwork_approved", label: "Artwork approved" },
  { id: "in_production", label: "In production" },
  { id: "qc", label: "QC" },
  { id: "ready", label: "Ready" },
];

const TERMINAL_LABELS: Record<"cancelled" | "returned", string> = {
  cancelled: "Order cancelled",
  returned: "Order returned",
};

type OrderProgressProps = {
  steps: ProgressStep[];
  /** Id of the current step; a value not in `steps` renders all steps inactive. */
  current: string;
  /** When set, renders every step dimmed plus a destructive banner. */
  terminal?: "cancelled" | "returned" | null;
  /** Accessible name for the progress list. */
  label: string;
  /** Date of the last change, shown under the current step. */
  currentMeta?: string;
  /** `vertical` stays stacked (narrow columns); `horizontal` is responsive. */
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function OrderProgress({
  steps,
  current,
  terminal,
  label,
  currentMeta,
  orientation = "horizontal",
  className,
}: OrderProgressProps) {
  const currentIndex = steps.findIndex((step) => step.id === current);

  // Terminal (cancelled/returned) or not-yet-started: no active step, so render
  // a dimmed static list instead of the wizard stepper.
  if (terminal || currentIndex === -1) {
    return (
      <div className={cn("space-y-3", className)}>
        {terminal ? <TerminalBanner terminal={terminal} /> : null}
        <ul
          role="list"
          aria-label={label}
          className={cn(
            "flex flex-col gap-2 text-muted-foreground",
            !terminal && orientation === "horizontal" && "md:flex-row md:items-start",
          )}
        >
          {steps.map((step, idx) => (
            <li
              key={step.id}
              role="listitem"
              className={cn(
                "flex items-center gap-2.5",
                !terminal &&
                  orientation === "horizontal" &&
                  "md:flex-1 md:flex-col md:items-center md:gap-1.5",
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground"
              >
                {idx + 1}
              </span>
              <span className="text-xs whitespace-nowrap">{step.label}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const responsive = orientation === "horizontal";

  return (
    <Stepper
      key={current}
      steps={steps}
      defaultValue={current}
      orientation={orientation}
      responsive={responsive}
      role="list"
      aria-label={label}
      aria-orientation={undefined}
      indicators={{
        completed: <CircleCheckBig className="size-4" aria-hidden="true" />,
      }}
      className={cn(className)}
    >
      <StepperNav role="presentation">
        {steps.map((step, idx) => {
          const isCurrent = step.id === current;
          const notLast = idx < steps.length - 1;
          return (
            <StepperItem
              key={step.id}
              stepId={step.id}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              className="items-start gap-0"
            >
              <StepperTrigger
                asChild
                className="flex flex-row items-center gap-2.5 md:flex-col md:gap-1.5"
              >
                <StepperIndicator className="flex items-center justify-center">
                  <span aria-hidden="true">{idx + 1}</span>
                </StepperIndicator>
                <span className="text-xs leading-tight font-normal whitespace-nowrap text-muted-foreground group-data-[state=active]/step:text-foreground group-data-[state=completed]/step:text-foreground md:text-center">
                  <span aria-hidden="true">{step.label}</span>
                  <span className="sr-only">
                    {`Step ${idx + 1} of ${steps.length}: ${step.label}`}
                  </span>
                  {isCurrent && currentMeta ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                      {currentMeta}
                    </span>
                  ) : null}
                </span>
              </StepperTrigger>
              {notLast ? (
                <StepperSeparator className="mt-4 max-md:hidden" />
              ) : null}
            </StepperItem>
          );
        })}
      </StepperNav>
    </Stepper>
  );
}

function TerminalBanner({
  terminal,
}: Readonly<{ terminal: "cancelled" | "returned" }>) {
  const Icon = terminal === "cancelled" ? Ban : Undo2;
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-control bg-destructive-soft px-3 py-2 text-sm font-medium text-destructive"
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      {TERMINAL_LABELS[terminal]}
    </p>
  );
}
