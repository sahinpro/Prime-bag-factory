import { Activity } from "lucide-react";

import { EmptyState } from "@/components/admin/data/empty-state";

import type { DashboardData } from "@/server/dashboard";

// Activity feed (plan 9c.5 / 9c.7): compact rows, newest first, one line each
// ("who, verb, entity, when"), max 10. Record detail links come later with each
// module; until then each row is text with the entity name.

const VERB_LABEL: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  login: "signed in",
  logout: "signed out",
  status_change: "changed status of",
  export: "exported",
};

const TABLE_LABEL: Record<string, string> = {
  products: "a product",
  categories: "a category",
  collections: "a collection",
  quote_requests: "a quote",
  orders: "an order",
  swatches: "a swatch",
  media: "a media file",
  profiles: "a user",
  settings: "a setting",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ActivityFeed({
  entries,
}: {
  entries: DashboardData["activity"];
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Staff actions will appear here."
      />
    );
  }

  return (
    <ul className="divide-y divide-sidebar-border">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: "var(--chart-1)" }}
          />
          <p className="min-w-0 flex-1 truncate">
            <span className="font-medium">{e.actor ?? "Someone"}</span>{" "}
            <span className="text-muted-foreground">
              {VERB_LABEL[e.action] ?? e.action}{" "}
              {TABLE_LABEL[e.table] ?? e.table}
            </span>
          </p>
          <time
            className="shrink-0 text-xs tabular-nums text-muted-foreground"
            dateTime={e.at}
          >
            {relativeTime(e.at)}
          </time>
        </li>
      ))}
    </ul>
  );
}
