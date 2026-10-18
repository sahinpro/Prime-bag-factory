import { cn } from "@/lib/utils";

/**
 * FormSection (plan 9c.5 / 9c.8): a titled block with a two-column layout on
 * desktop (title + help on the left, fields on the right) that collapses to one
 * column on mobile. Fields are free-form so any input combination works.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-4 border-b border-border py-6 last:border-0 sm:grid-cols-3 sm:gap-6",
        className,
      )}
    >
      <div className="sm:col-span-1">
        {title ? (
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        ) : null}
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4 sm:col-span-2">{children}</div>
    </section>
  );
}
