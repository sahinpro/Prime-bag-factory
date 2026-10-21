"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import * as React from "react";

import { StatusBadge } from "@/components/admin/data/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminCategory } from "@/server/categories";

export type CategoryTreeNode = {
  category: AdminCategory;
  children: CategoryTreeNode[];
};

export type ParentKey = string | null;

/**
 * Build a nested tree from a flat category list. Children are ordered by
 * `sort_order` (then name) so an optimistic `sort_order` change re-sorts the
 * group immediately. A row whose parent is missing is treated as a root
 * (defensive against orphaned rows).
 */
export function buildCategoryTree(
  categories: AdminCategory[],
): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>();
  for (const category of categories) {
    byId.set(category.id, { category, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.category.parent_id
      ? byId.get(node.category.parent_id)
      : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortGroup = (list: CategoryTreeNode[]) => {
    list.sort(
      (a, b) =>
        a.category.sort_order - b.category.sort_order ||
        a.category.name_en.localeCompare(b.category.name_en),
    );
    for (const node of list) sortGroup(node.children);
  };
  sortGroup(roots);
  return roots;
}

/**
 * CategoryTree (plan 9c.8): a NESTED tree where every sibling group is its own
 * `SortableContext`, so dragging can only reorder among real siblings (exactly
 * what `sort_order` supports — parenting stays in the editor). Children render
 * inside their parent's `<li>`, so a dragged parent carries its whole subtree,
 * and its children collapse while it is in the air. Keyboard Move up/down
 * buttons share the same reorder callback.
 */
export function CategoryTree({
  nodes,
  selectedId,
  onSelect,
  onReorder,
}: Readonly<{
  nodes: CategoryTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (parentId: ParentKey, orderedIds: string[]) => void;
}>) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // id -> node (for the drag overlay) and parent -> ordered ids (for drag-end).
  const { nodeById, groupIds } = React.useMemo(() => {
    const nodeById = new Map<string, CategoryTreeNode>();
    const groupIds = new Map<ParentKey, string[]>();
    const walk = (list: CategoryTreeNode[], parentId: ParentKey) => {
      if (list.length)
        groupIds.set(
          parentId,
          list.map((n) => n.category.id),
        );
      for (const node of list) {
        nodeById.set(node.category.id, node);
        walk(node.children, node.category.id);
      }
    };
    walk(nodes, null);
    return { nodeById, groupIds };
  }, [nodes]);

  const nameOf = React.useCallback(
    (id: string | number) =>
      nodeById.get(String(id))?.category.name_en ?? "item",
    [nodeById],
  );

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} is over ${nameOf(over.id)}.`
        : `${nameOf(active.id)} has no valid drop target.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} was moved next to ${nameOf(over.id)}.`
        : `Moving ${nameOf(active.id)} was cancelled.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeParent = (active.data.current?.parentId as ParentKey) ?? null;
    const overParent = (over.data.current?.parentId as ParentKey) ?? null;
    // Only reorder within one sibling group; a cross-group drop is ignored so
    // the list never implies a reparent the editor owns.
    if (activeParent !== overParent) return;
    const ids = groupIds.get(activeParent) ?? [];
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(activeParent, arrayMove(ids, oldIndex, newIndex));
  }

  if (nodes.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
        No categories yet. Create your first one.
      </p>
    );
  }

  const activeNode = activeId ? nodeById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{ announcements }}
    >
      <SortableGroup
        nodes={nodes}
        parentId={null}
        isRoot
        selectedId={selectedId}
        onSelect={onSelect}
        onReorder={onReorder}
      />
      <DragOverlay>
        {activeNode ? <DragGhost category={activeNode.category} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableGroup({
  nodes,
  parentId,
  isRoot = false,
  selectedId,
  onSelect,
  onReorder,
}: Readonly<{
  nodes: CategoryTreeNode[];
  parentId: ParentKey;
  isRoot?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (parentId: ParentKey, orderedIds: string[]) => void;
}>) {
  const ids = nodes.map((n) => n.category.id);

  function move(id: string, direction: -1 | 1) {
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    onReorder(parentId, arrayMove(ids, index, target));
  }

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul
        className={cn(
          "space-y-0.5",
          !isRoot && "ml-4 mt-0.5 border-l border-sidebar-border pl-2",
        )}
      >
        {nodes.map((node, index) => (
          <SortableBranch
            key={node.category.id}
            node={node}
            parentId={parentId}
            canMoveUp={index > 0}
            canMoveDown={index < nodes.length - 1}
            selected={node.category.id === selectedId}
            onSelect={onSelect}
            onMoveUp={() => move(node.category.id, -1)}
            onMoveDown={() => move(node.category.id, 1)}
            onReorder={onReorder}
            selectedId={selectedId}
          />
        ))}
      </ul>
    </SortableContext>
  );
}

function SortableBranch({
  node,
  parentId,
  canMoveUp,
  canMoveDown,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onReorder,
  selectedId,
}: Readonly<{
  node: CategoryTreeNode;
  parentId: ParentKey;
  canMoveUp: boolean;
  canMoveDown: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReorder: (parentId: ParentKey, orderedIds: string[]) => void;
  selectedId: string | null;
}>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.category.id, data: { parentId } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-40")}
    >
      <CategoryRow
        category={node.category}
        selected={selected}
        onSelect={() => onSelect(node.category.id)}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        activatorRef={setActivatorNodeRef}
        handleAttributes={attributes}
        handleListeners={listeners}
      />
      {/* Collapse the dragged parent's subtree so descendants travel with it. */}
      {node.children.length > 0 && !isDragging ? (
        <SortableGroup
          nodes={node.children}
          parentId={node.category.id}
          selectedId={selectedId}
          onSelect={onSelect}
          onReorder={onReorder}
        />
      ) : null}
    </li>
  );
}

function CategoryRow({
  category,
  selected,
  onSelect,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  activatorRef,
  handleAttributes,
  handleListeners,
}: Readonly<{
  category: AdminCategory;
  selected: boolean;
  onSelect: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  activatorRef?: (node: HTMLElement | null) => void;
  handleAttributes?: ReturnType<typeof useSortable>["attributes"];
  handleListeners?: ReturnType<typeof useSortable>["listeners"];
}>) {
  return (
    <div className="flex items-center gap-1 py-1.5 pr-2 text-sm">
      <button
        type="button"
        ref={activatorRef}
        aria-label={`Reorder ${category.name_en}`}
        className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 active:cursor-grabbing touch-none"
        {...handleAttributes}
        {...handleListeners}
      >
        <GripVertical
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4"
        />
      </button>

      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          selected ? "bg-surface-2 font-medium" : "hover:bg-surface-2/60",
        )}
      >
        <span className="truncate">{category.name_en}</span>
        {category.name_bn ? (
          <span lang="bn" className="truncate text-xs text-muted-foreground">
            {category.name_bn}
          </span>
        ) : null}
        {!category.is_active ? (
          <StatusBadge
            domain="product"
            value="draft"
            className="ml-auto shrink-0"
          />
        ) : null}
      </button>

      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label={`Move ${category.name_en} up`}
        >
          <ChevronUp aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label={`Move ${category.name_en} down`}
        >
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4"
          />
        </Button>
      </div>
    </div>
  );
}

/** Static clone of a row shown under the cursor while dragging (no children). */
function DragGhost({ category }: Readonly<{ category: AdminCategory }>) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-surface-2 px-2 py-1.5 text-sm shadow-lg">
      <GripVertical
        aria-hidden="true"
        strokeWidth={1.75}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="truncate">{category.name_en}</span>
      {category.name_bn ? (
        <span lang="bn" className="truncate text-xs text-muted-foreground">
          {category.name_bn}
        </span>
      ) : null}
    </div>
  );
}
