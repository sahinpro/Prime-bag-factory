import { Info, PanelTop, Square } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ChartCard shell (plan 9c.5 / 9c.9): rounded square icon + title (14px medium),
// muted subtitle shows the active range, an optional info tooltip, a ⋯ menu slot,
// a fixed content height (default 256px) so skeletons match, and a footer slot.

const HEIGHTS = { sm: "h-24", md: "h-48", lg: "h-64" } as const;
export type ChartCardHeight = keyof typeof HEIGHTS;

export function ChartCard({
  title,
  subtitle,
  info,
  menu,
  height = "lg",
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  info?: string;
  menu?: ReactNode;
  height?: ChartCardHeight;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card data-widget="chart" className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex-row items-center gap-2 px-4 py-3">
        <Square
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-5 text-foreground"
        />
        <div className="grid leading-tight">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {info ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 rounded-xs"
                aria-label={`About ${title}`}
              >
                <Info
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-3.5"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>{info}</TooltipContent>
          </Tooltip>
        ) : null}
        {menu ? <div className="ml-auto">{menu}</div> : null}
      </CardHeader>
      <CardContent className={`px-4 pb-2 ${HEIGHTS[height]} items-center`}>
        {children}
      </CardContent>
      {footer ? (
        <div className="flex items-center gap-2 border-t border-sidebar-border px-4 py-2 text-xs text-muted-foreground">
          <PanelTop
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-3.5"
          />
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
