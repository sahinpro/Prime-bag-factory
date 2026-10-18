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
  CategoryTree,
  type FlatCategory,
} from "@/components/admin/categories/category-tree";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CategoryInput } from "@/lib/validators/category";
import type { AdminCategory } from "@/server/categories";

type Flash = { kind: "error" | "success"; text: string } | null;

/** Depth-first flatten that respects `sort_order` and assigns an indent depth. */
function buildFlatTree(categories: AdminCategory[]): FlatCategory[] {
  const childrenOf = new Map<string | null, AdminCategory[]>();
  for (const c of categories) {
    const key = c.parent_id ?? null;
    const bucket = childrenOf.get(key) ?? [];
    bucket.push(c);
    childrenOf.set(key, bucket);
  }

  const out: FlatCategory[] = [];
  const visited = new Set<string>();

  function walk(parentKey: string | null, depth: number) {
    for (const category of childrenOf.get(parentKey) ?? []) {
      if (visited.has(category.id)) continue;
      visited.add(category.id);
      out.push({ category, depth });
      walk(category.id, depth + 1);
    }
  }

  walk(null, 0);

  // Any rows whose parent is missing (defensive) are appended at the top level.
  for (const category of categories) {
    if (!visited.has(category.id)) {
      visited.add(category.id);
      out.push({ category, depth: 0 });
    }
  }
  return out;
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
  const flat = React.useMemo(() => buildFlatTree(categories), [categories]);

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

  function handleReorder(orderedIds: string[]) {
    void reorderCategories(orderedIds).then((result) => {
      if (!result.ok) setFlash({ kind: "error", text: result.error });
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
              nodes={flat}
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
                initialSortOrder={flat.length}
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
