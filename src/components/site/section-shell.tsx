import { cn } from "cn";

/**
 * Public page container (plan 8b.2): max 1440px, gutters 16 / 24 / 32,
 * section rhythm 24px then 32px. The heading is a slot so the page can pass
 * an h1 or an h2.
 */
export function SectionShell({
  as: Tag = "section",
  className,
  children,
}: {
  as?: "section" | "div";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag>
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8",
          className,
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
