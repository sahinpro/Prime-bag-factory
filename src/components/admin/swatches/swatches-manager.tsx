"use client";

import { Layers, Palette, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  deleteSwatch,
  deleteSwatchGroup,
  saveSwatch,
  saveSwatchGroup,
} from "@/app/(admin)/admin/swatches/actions";
import { SwatchChip } from "@/components/admin/catalog/swatch-chip";
import { EmptyState } from "@/components/admin/data/empty-state";
import { ToneBadge } from "@/components/admin/data/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { SwatchEditor } from "@/components/admin/swatches/swatch-editor";
import { SwatchGroupEditor } from "@/components/admin/swatches/swatch-group-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SwatchGroupInput, SwatchInput } from "@/lib/validators/swatch";
import type { AdminSwatch, AdminSwatchGroup } from "@/server/swatches";
import { Eye, EyeOff } from "lucide-react";

type Flash = { kind: "error" | "success"; text: string } | null;

/**
 * SwatchesManager (plan 9c.8 "Groups as tabs; grid of SwatchChip cards ... Sheet
 * editor with texture upload"). Server-driven: every save/delete revalidates and
 * the page re-renders with fresh data. Group selection is client state (with a
 * fallback to the first group so a deleted selection never strands the view).
 */
export function SwatchesManager({
  groups,
}: Readonly<{ groups: AdminSwatchGroup[] }>) {
  const router = useRouter();
  const [activeId, setActiveId] = React.useState<string>(groups[0]?.id ?? "");
  const selected =
    groups.find((g) => g.id === activeId) ?? groups[0] ?? undefined;

  const [groupEditorOpen, setGroupEditorOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<
    AdminSwatchGroup | undefined
  >(undefined);
  const [swatchEditorOpen, setSwatchEditorOpen] = React.useState(false);
  const [editingSwatch, setEditingSwatch] = React.useState<
    AdminSwatch | undefined
  >(undefined);
  const [flash, setFlash] = React.useState<Flash>(null);

  function openNewGroup() {
    setEditingGroup(undefined);
    setGroupEditorOpen(true);
    setFlash(null);
  }
  function openEditGroup(group: AdminSwatchGroup) {
    setEditingGroup(group);
    setGroupEditorOpen(true);
    setFlash(null);
  }
  function openNewSwatch() {
    setEditingSwatch(undefined);
    setSwatchEditorOpen(true);
    setFlash(null);
  }
  function openEditSwatch(swatch: AdminSwatch) {
    setEditingSwatch(swatch);
    setSwatchEditorOpen(true);
    setFlash(null);
  }

  async function handleSaveGroup(payload: SwatchGroupInput & { id?: string }) {
    const result = await saveSwatchGroup(payload);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return false;
    }
    if (result.id) setActiveId(result.id);
    router.refresh();
    setGroupEditorOpen(false);
    setFlash({ kind: "success", text: "Group saved." });
    return true;
  }

  async function handleDeleteGroup(id: string) {
    const result = await deleteSwatchGroup(id);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return;
    }
    router.refresh();
    setGroupEditorOpen(false);
    setFlash({ kind: "success", text: "Group deleted." });
  }

  async function handleSaveSwatch(payload: SwatchInput & { id?: string }) {
    const result = await saveSwatch(payload);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return false;
    }
    if (payload.group_id) setActiveId(payload.group_id);
    router.refresh();
    setSwatchEditorOpen(false);
    setFlash({ kind: "success", text: "Swatch saved." });
    return true;
  }

  async function handleDeleteSwatch(id: string) {
    const result = await deleteSwatch(id);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return;
    }
    router.refresh();
    setSwatchEditorOpen(false);
    setFlash({ kind: "success", text: "Swatch deleted." });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Swatch Library"
        description="Fabric colors customers choose for products and the custom builder."
        actions={
          <Button size="sm" onClick={openNewGroup}>
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            New group
          </Button>
        }
      />

      {flash ? (
        <div
          role="status"
          className={cn(
            "rounded-control border px-3 py-2 text-sm",
            flash.kind === "error"
              ? "border-destructive/30 bg-destructive-soft text-destructive"
              : "border-success/30 bg-success-soft text-success",
          )}
        >
          {flash.text}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="rounded-card border">
          <EmptyState
            icon={Palette}
            title="No swatch groups yet"
            description="Create a group like “Body fabric” to start adding fabric colors."
            action={
              <Button size="sm" onClick={openNewGroup}>
                <Plus
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                New group
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Swatch groups"
            className="flex gap-1 overflow-x-auto border-b border-border pb-2"
          >
            {groups.map((group) => {
              const active = selected?.id === group.id;
              return (
                <button
                  key={group.id}
                  role="tab"
                  type="button"
                  id={`tab-${group.id}`}
                  aria-selected={active}
                  aria-controls={active ? `panel-${group.id}` : undefined}
                  onClick={() => setActiveId(group.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-control px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none",
                    active
                      ? "bg-sidebar-active text-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {group.name_en}
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {group.swatches.length}
                  </span>
                </button>
              );
            })}
          </div>

          {selected ? (
            <section
              role="tabpanel"
              id={`panel-${selected.id}`}
              aria-labelledby={`tab-${selected.id}`}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    {selected.name_en}
                  </h2>
                  {selected.name_bn ? (
                    <p
                      lang="bn"
                      className="truncate text-sm text-muted-foreground"
                    >
                      {selected.name_bn}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditGroup(selected)}
                  >
                    <Pencil
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    Edit group
                  </Button>
                  <Button size="sm" onClick={openNewSwatch}>
                    <Plus
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    New swatch
                  </Button>
                </div>
              </div>

              {selected.swatches.length === 0 ? (
                <div className="rounded-card border">
                  <EmptyState
                    icon={Layers}
                    title="No swatches in this group"
                    description="Add the fabric colors customers can pick for this part."
                    action={
                      <Button size="sm" onClick={openNewSwatch}>
                        <Plus
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-4"
                        />
                        New swatch
                      </Button>
                    }
                  />
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selected.swatches.map((swatch) => (
                    <li key={swatch.id}>
                      <div className="flex items-center gap-3 rounded-card border border-sidebar-border bg-surface p-3">
                        <SwatchChip
                          colorHex={swatch.color_hex ?? "#e5e5e5"}
                          textureUrl={swatch.texture_image_path}
                          size={44}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {swatch.name_en}
                          </p>
                          {swatch.name_bn ? (
                            <p
                              lang="bn"
                              className="truncate text-xs text-muted-foreground"
                            >
                              {swatch.name_bn}
                            </p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {swatch.code ? (
                              <code className="rounded bg-surface-2 px-1.5 py-0.5">
                                {swatch.code}
                              </code>
                            ) : null}
                            <span className="tabular-nums">
                              {swatch.usage_count > 0
                                ? `${swatch.usage_count} in use`
                                : "Unused"}
                            </span>
                            {swatch.is_active ? (
                              <ToneBadge tone="success" icon={Eye}>
                                Active
                              </ToneBadge>
                            ) : (
                              <ToneBadge tone="neutral" icon={EyeOff}>
                                Hidden
                              </ToneBadge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSwatch(swatch)}
                        >
                          <Pencil
                            aria-hidden="true"
                            strokeWidth={1.75}
                            className="size-4"
                          />
                          Edit
                          <span className="sr-only">: {swatch.name_en}</span>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}

      <SwatchGroupEditor
        key={editingGroup?.id ?? "new-group"}
        open={groupEditorOpen}
        onOpenChange={setGroupEditorOpen}
        group={editingGroup}
        nextSortOrder={groups.length}
        onSave={handleSaveGroup}
        onDelete={handleDeleteGroup}
      />

      <SwatchEditor
        key={editingSwatch?.id ?? "new-swatch"}
        open={swatchEditorOpen}
        onOpenChange={setSwatchEditorOpen}
        swatch={editingSwatch}
        groups={groups}
        defaultGroupId={selected?.id}
        nextSortOrder={selected?.swatches.length ?? 0}
        onSave={handleSaveSwatch}
        onDelete={handleDeleteSwatch}
      />
    </div>
  );
}
