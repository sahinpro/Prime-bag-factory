import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";

/**
 * Error state (plan 9c.1.4): a message plus a way to Retry. The retry action is
 * passed in so a server component can wire a server action or a link to reload.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  action,
  className,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive-soft text-destructive">
        <TriangleAlert
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-5"
        />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {message}
        </p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
