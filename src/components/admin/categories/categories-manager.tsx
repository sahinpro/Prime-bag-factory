"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  deleteCategory,
  reorderCategories,
  saveCategory,
} from "@/app/(admin)/admin/categories/actions";
import { CategoryEditor } from "@/components/admin/categories/category-editor";
import {
  buildCategoryTree,
  CategoryTree,
  type ParentKey,
} from "@/components/admin/categories/category-tree";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CategoryInput } from "@/lib/validators/category";
import type { AdminCategory } from "@/server/categories";

type Flash = { kind: "error" | "success"; text: string } | null;

type ReorderAction = { parentId: ParentKey; orderedIds: string[] };

/**
 * Reassign `sort_order` (0..n-1) to the moved sibling group only, leaving every
 * other row untouched. `buildCategoryTree` sorts each group by `sort_order`, so
 * this makes the optimistic order appear instantly in the nested tree.
 */
function applyReorderToCategories(
  categories: AdminCategory[],
  { parentId, orderedIds }: ReorderAction,
): AdminCategory[] {
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  return categories.map((c) => {
    const next = rank.get(c.id);
    if (next === undefined) return c;
    if ((c.parent_id ?? null) !== parentId) return c;
    return c.sort_order === next ? c : { ...c, sort_order: next };
  });
}

function collectDescendants(
  rootId: string,
  categories: AdminCategory[],
): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parent_id) continue;
    const bucket = childrenOf.get(c.parent_id) ?? [];
    bucket.push(c.id);
    childrenOf.set(c.parent_id, bucket);
  }
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of childrenOf.get(id) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }
  return result;
}

/**
 * CategoriesManager (plan 9c.8): two-pane master/detail. Left is the reorderable
 * tree; right is the editor. On narrow screens the panes stack (tree, then the
 * selected editor). Data is server-driven — every action revalidates and the page
 * re-renders with fresh props, so the tree/editor never diverge from the DB.
 */
export function CategoriesManager({
  categories,
}: Readonly<{ categories: AdminCategory[] }>) {
  const router = useRouter();
  // Optimistic reorder: the tree moves instantly, then `router.refresh()` swaps
  // in authoritative rows. On action failure we show a flash and the transition
  // unwinds back to the last server state.
  const [optimisticCategories, applyReorder] = React.useOptimistic(
    categories,
    applyReorderToCategories,
  );
  const tree = React.useMemo(
    () => buildCategoryTree(optimisticCategories),
    [optimisticCategories],
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [flash, setFlash] = React.useState<Flash>(null);

  // Derive the active selection (no effect): a stale id (after create/delete) or
  // no selection falls back to the first category, unless we are creating.
  const activeId =
    creating || (selectedId && categories.some((c) => c.id === selectedId))
      ? selectedId
      : (categories[0]?.id ?? null);

  const selected = categories.find((c) => c.id === activeId) ?? undefined;

  const parentOptions = React.useMemo(() => {
    const excluded = selected
      ? collectDescendants(selected.id, categories)
      : null;
    return categories
      .filter((c) => c.id !== selected?.id && !excluded?.has(c.id))
      .map((c) => ({ id: c.id, name: c.name_en }));
  }, [categories, selected]);

  async function handleSave(payload: CategoryInput & { id?: string }) {
    const result = await saveCategory(payload);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return false;
    }
    router.refresh();
    if (!payload.id && result.id) {
      setCreating(false);
      setSelectedId(result.id);
    }
    setFlash({ kind: "success", text: "Saved." });
    return true;
  }

  async function handleDelete(id: string) {
    const result = await deleteCategory(id);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return;
    }
    router.refresh();
  }

  function handleReorder(parentId: ParentKey, orderedIds: string[]) {
    setFlash(null);
    React.startTransition(async () => {
      applyReorder({ parentId, orderedIds });
      const result = await reorderCategories(parentId, orderedIds);
      if (!result.ok) {
        setFlash({ kind: "error", text: result.error });
        return;
      }
      router.refresh();
    });
  }

  function startNew() {
    setCreating(true);
    setSelectedId(null);
    setFlash(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organize the catalog tree. Drag or use the arrows to reorder."
        actions={
          <Button
            size="sm"
            onClick={startNew}
            variant={creating ? "outline" : "default"}
          >
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            New category
          </Button>
        }
      />

      {flash ? (
        <div
          role="status"
          className={`rounded-control border px-3 py-2 text-sm ${
            flash.kind === "error"
              ? "border-destructive/30 bg-destructive-soft text-destructive"
              : "border-success/30 bg-success-soft text-success"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-card py-0 lg:col-span-1">
          <CardContent className="px-2 py-2">
            <CategoryTree
              nodes={tree}
              selectedId={creating ? null : activeId}
              onSelect={(id) => {
                setCreating(false);
                setSelectedId(id);
              }}
              onReorder={handleReorder}
            />
          </CardContent>
        </Card>

        <Card className="rounded-card py-0 lg:col-span-2">
          <CardContent className="px-4 py-3">
            {creating ? (
              <CategoryEditor
                key="new"
                parentOptions={parentOptions}
                initialSortOrder={categories.length}
                onSave={handleSave}
              />
            ) : selected ? (
              <CategoryEditor
                key={selected.id}
                category={selected}
                parentOptions={parentOptions}
                initialSortOrder={selected.sort_order}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ) : (
              <p className="px-1 py-10 text-center text-sm text-muted-foreground">
                Select a category to edit, or create a new one.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
