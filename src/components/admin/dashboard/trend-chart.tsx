import { cn } from "@/lib/utils";

// TrendChart (plan 9c.7): a lightweight daily bar chart for the sales trend
// widget. Bars are pure divs on --chart-1 (never a raw hex, matching SegmentBar /
// Sparkline). Color is never the only signal: every bar carries a native-title
// tooltip and the whole series is mirrored in a visually-hidden data table so
// screen readers and keyboard users get the numbers. Rendered server-side, so it
// needs no client boundary. The parent shows an EmptyState when there is no data.

export function TrendChart({
  values,
  formatValue,
  daysAgoLabel,
  className,
}: {
  /** Per-day series; index 0 is the oldest day, the last entry is today. */
  values: number[];
  /** Formats a single day's value for the tooltip and hidden table. */
  formatValue: (value: number) => string;
  /** Human label for a bucket N days back (0 = today). */
  daysAgoLabel: (daysAgo: number) => string;
  className?: string;
}) {
  const max = values.reduce((m, v) => Math.max(m, v), 0);
  if (max <= 0) return null;

  return (
    <div className={cn("flex h-full flex-col gap-2", className)}>
      <div
        className="flex min-h-0 flex-1 items-end gap-px"
        role="img"
        aria-label={values
          .map(
            (v, i) =>
              `${daysAgoLabel(values.length - 1 - i)}: ${formatValue(v)}`,
          )
          .join(", ")}
      >
        {values.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-xs"
            style={{
              height: `${(v / max) * 100}%`,
              minHeight: v > 0 ? "2px" : "0",
              background: "var(--chart-1)",
              opacity: v > 0 ? 1 : 0.15,
            }}
            title={`${daysAgoLabel(values.length - 1 - i)}: ${formatValue(v)}`}
          />
        ))}
      </div>
      {/* Hidden tabular fallback — the numbers behind the bars. */}
      <table className="sr-only">
        <caption>Daily sales totals</caption>
        <tbody>
          {values.map((v, i) => (
            <tr key={i}>
              <th scope="row">{daysAgoLabel(values.length - 1 - i)}</th>
              <td>{formatValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
