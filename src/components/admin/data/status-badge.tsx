import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlarmClock,
  BadgeCheck,
  Ban,
  Check,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  Factory,
  FileCheck,
  Loader,
  PackageCheck,
  Phone,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Trash,
  TriangleAlert,
  Trophy,
  Undo2,
  XCircle,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

/**
 * Status badge system (plan 9c.5 / 9c.6).
 * Status is never color alone: every badge pairs a soft-token background with a
 * solid text/icon and a text label. Icons are lucide-react, stroke 1.75.
 */

export type Tone =
  | "ink"
  | "neutral"
  | "gold"
  | "success"
  | "warning"
  | "destructive";

type IconType = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

// Soft background + matching solid foreground per semantic token (plan 9c.2).
const TONE_CLASSES: Record<Tone, string> = {
  ink: "bg-ink-badge-soft text-ink-badge",
  neutral: "bg-surface-2 text-muted-foreground ring-1 ring-border",
  gold: "bg-gold-soft text-gold-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
};

export type StatusMeta = {
  tone: Tone;
  icon: IconType;
  label: string;
};

// Mapping tables transcribed from plan 9c.6.
export const QUOTE_STATUS_META: Record<string, StatusMeta> = {
  new: { tone: "ink", icon: Sparkles, label: "New" },
  contacted: { tone: "neutral", icon: Phone, label: "Contacted" },
  quoted: { tone: "gold", icon: FileCheck, label: "Quoted" },
  won: { tone: "success", icon: Trophy, label: "Won" },
  lost: { tone: "destructive", icon: XCircle, label: "Lost" },
};

export const ORDER_STATUS_META: Record<string, StatusMeta> = {
  pending: { tone: "warning", icon: Clock, label: "Pending" },
  confirmed: { tone: "ink", icon: CheckCircle2, label: "Confirmed" },
  processing: { tone: "gold", icon: Loader, label: "Processing" },
  shipped: { tone: "ink", icon: PackageCheck, label: "Shipped" },
  delivered: { tone: "success", icon: PackageCheck, label: "Delivered" },
  cancelled: { tone: "destructive", icon: Ban, label: "Cancelled" },
  returned: { tone: "warning", icon: Undo2, label: "Returned" },
};

export const PAYMENT_STATUS_META: Record<string, StatusMeta> = {
  unpaid: { tone: "neutral", icon: CircleDashed, label: "Unpaid" },
  partially_paid: {
    tone: "warning",
    icon: CircleDot,
    label: "Partially paid",
  },
  paid: { tone: "success", icon: BadgeCheck, label: "Paid" },
  refunded: { tone: "neutral", icon: RotateCcw, label: "Refunded" },
};

export const PRODUCTION_STATUS_META: Record<string, StatusMeta> = {
  awaiting_artwork: {
    tone: "warning",
    icon: AlarmClock,
    label: "Awaiting artwork",
  },
  artwork_approved: { tone: "ink", icon: Check, label: "Artwork approved" },
  in_production: { tone: "gold", icon: Factory, label: "In production" },
  qc: { tone: "ink", icon: ScanSearch, label: "QC" },
  ready: { tone: "success", icon: PackageCheck, label: "Ready" },
};

export const PRODUCT_STATUS_META: Record<string, StatusMeta> = {
  draft: { tone: "neutral", icon: FileCheck, label: "Draft" },
  published: { tone: "success", icon: BadgeCheck, label: "Published" },
  archived: { tone: "neutral", icon: Trash, label: "Archived" },
};

export const STOCK_STATUS_META: Record<string, StatusMeta> = {
  ok: { tone: "success", icon: CheckCircle2, label: "In stock" },
  low: { tone: "warning", icon: TriangleAlert, label: "Low stock" },
  out: { tone: "destructive", icon: Ban, label: "Out of stock" },
  untracked: { tone: "neutral", icon: Factory, label: "Made to order" },
};

export const URGENCY_STATUS_META: Record<string, StatusMeta> = {
  overdue: { tone: "destructive", icon: AlarmClock, label: "Overdue" },
  due_soon: { tone: "warning", icon: AlarmClock, label: "Due soon" },
  later: { tone: "neutral", icon: Clock, label: "No rush" },
};

const MAPS = {
  quote: QUOTE_STATUS_META,
  order: ORDER_STATUS_META,
  payment: PAYMENT_STATUS_META,
  production: PRODUCTION_STATUS_META,
  product: PRODUCT_STATUS_META,
  stock: STOCK_STATUS_META,
  urgency: URGENCY_STATUS_META,
} as const;

export type StatusDomain = keyof typeof MAPS;

/**
 * Renders a status badge for a known domain value. Falls back to a neutral
 * outline badge with the raw value when the domain has no mapping yet, so a new
 * enum value never renders blank.
 */
export function StatusBadge({
  domain,
  value,
  className,
}: {
  domain: StatusDomain;
  value: string;
  className?: string;
}) {
  const meta = MAPS[domain][value];
  if (!meta) {
    return (
      <Badge variant="outline" className={cn("capitalize", className)}>
        {value.replace(/_/g, " ")}
      </Badge>
    );
  }
  return (
    <ToneBadge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </ToneBadge>
  );
}

/** Low-level badge used by the dashboard deltas and any custom status. */
export function ToneBadge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone;
  icon?: IconType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge className={cn(TONE_CLASSES[tone], "border-transparent", className)}>
      {Icon ? <Icon aria-hidden="true" strokeWidth={1.75} /> : null}
      {children}
    </Badge>
  );
}
