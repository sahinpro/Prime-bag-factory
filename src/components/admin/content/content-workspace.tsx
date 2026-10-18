"use client";

import { Plus } from "lucide-react";
import * as React from "react";

import {
  moveContentRow,
  toggleContentRow,
} from "@/app/(admin)/admin/content/actions";
import { ContentEditor } from "@/components/admin/content/content-editor";
import { ToneBadge } from "@/components/admin/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ContentRow } from "@/server/content-admin";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";

import { CONTENT_TYPE_CONFIGS } from "@/components/admin/content/content-types";
import type { ContentEntity } from "@/lib/validators/content";

/**
 * ContentWorkspace (plan 9c.8 "Content": left list of content types, right
 * FormSection editors). One list/editor pair per selected type; the type rail
 * itself is server-rendered links on `?type=`. Every action goes through the
 * generic content actions (zod + requireRole server-side); after a save the
 * page re-renders with fresh rows, so the editor never diverges from the DB.
 */
export function ContentWorkspace({
  entity,
  rows,
}: Readonly<{ entity: ContentEntity; rows: ContentRow[] }>) {
  const config = CONTENT_TYPE_CONFIGS[entity];
  // null = follow the list (first row / new draft when empty); "new" = draft.
  const [selection, setSelection] = React.useState<string | null>(null);

  const current = React.useMemo<ContentRow | null>(() => {
    if (selection === "new") return null;
    if (selection) return rows.find((r) => r.id === selection) ?? rows[0] ?? null;
    return rows[0] ?? null;
  }, [selection, rows]);

  function titleOf(row: ContentRow): string {
    for (const f of config.titleFields) {
      const v = row.values[f];
      if (typeof v === "string" && v.trim() !== "") return v;
    }
    return "Untitled";
  }

  async function move(row: ContentRow, dir: -1 | 1) {
    await moveContentRow({ entity, id: row.id, dir });
  }

  async function toggle(row: ContentRow) {
    await toggleContentRow({ entity, id: row.id });
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <Card className="self-start overflow-hidden rounded-card">
        <div className="flex items-center justify-between gap-2 border-b bg-surface-2 px-4 py-3">
          <h2 className="text-sm font-medium">{config.label}</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelection("new")}
            aria-current={selection === "new" ? "true" : undefined}
          >
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            New
          </Button>
        </div>
        {rows.length === 0 && selection !== "new" ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No {config.label.toLowerCase()} yet. Use New to add the first one.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((row, i) => {
              const active = current?.id === row.id;
              return (
                <li key={row.id}>
                  <div
                    className={
                      active
                        ? "flex items-center gap-1 bg-sidebar px-3 py-2"
                        : "flex items-center gap-1 px-3 py-2"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSelection(row.id)}
                      aria-current={active ? "true" : undefined}
                      className="min-w-0 flex-1 cursor-pointer rounded-control px-1 py-1 text-left text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="block truncate font-medium">
                        {titleOf(row)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {config.hasActive
                          ? row.isActive === false
                            ? "Hidden"
                            : "Visible"
                          : row.sortOrder !== null
                            ? `Position ${i + 1}`
                            : "\u00A0"}
                      </span>
                    </button>
                    {config.hasSort ? (
                      <span className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={i === 0}
                          aria-label={`Move ${titleOf(row)} up`}
                          onClick={() => move(row, -1)}
                        >
                          <ChevronUp aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={i === rows.length - 1}
                          aria-label={`Move ${titleOf(row)} down`}
                          onClick={() => move(row, 1)}
                        >
                          <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                        </Button>
                      </span>
                    ) : null}
                    {config.hasActive ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={
                          row.isActive
                            ? `Hide ${titleOf(row)}`
                            : `Show ${titleOf(row)}`
                        }
                        onClick={() => toggle(row)}
                      >
                        {row.isActive ? (
                          <Eye aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                        ) : (
                          <EyeOff aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {current ? (
              <>
                Editing <span className="font-medium text-foreground">{titleOf(current)}</span>
                {config.hasActive && current.isActive === false ? (
                  <ToneBadge tone="warning" className="ml-2">
                    Hidden
                  </ToneBadge>
                ) : null}
              </>
            ) : selection === "new" ? (
              `New ${config.label.toLowerCase().replace(/s$/, "")}`
            ) : (
              "Nothing selected."
            )}
          </p>
        </div>
        <ContentEditor
          key={`${entity}:${current?.id ?? "new"}`}
          entity={entity}
          row={current}
          isNew={selection === "new"}
        />
      </div>
    </div>
  );
}
