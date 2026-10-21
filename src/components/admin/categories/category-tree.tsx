"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
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

export type FlatCategory = { category: AdminCategory; depth: number };

type ParentKey = string | null;

function parentKey(node: FlatCategory): ParentKey {
  return node.category.parent_id ?? null;
}

/**
 * The `nodes` array is a depth-first flatten, so every subtree occupies a
 * contiguous block. Reordering only makes sense *between siblings* (same
 * parent): `sort_order` is compared within a parent, so moving a node past its
 * own child is a no-op. These helpers work on whole subtree blocks so a parent
 * always travels with its descendants.
 */

/** `[start, end)` indices of the subtree rooted at `start`. */
function subtreeRange(nodes: FlatCategory[], start: number): [number, number] {
  const depth = nodes[start].depth;
  let end = start + 1;
  while (end < nodes.length && nodes[end].depth > depth) end += 1;
  return [start, end];
}

/** Index of the previous sibling (same parent) or -1 if there is none. */
function prevSiblingIndex(nodes: FlatCategory[], i: number): number {
  const { depth } = nodes[i];
  const parent = parentKey(nodes[i]);
  for (let k = i - 1; k >= 0; k -= 1) {
    if (nodes[k].depth === depth) {
      return parentKey(nodes[k]) === parent ? k : -1;
    }
    if (nodes[k].depth < depth) return -1;
    // Deeper rows are inside the previous sibling's subtree — keep scanning up.
  }
  return -1;
}

/** Index of the next sibling (same parent) or -1 if there is none. */
function nextSiblingIndex(nodes: FlatCategory[], i: number): number {
  const [, end] = subtreeRange(nodes, i);
  if (end >= nodes.length) return -1;
  return nodes[end].depth === nodes[i].depth && parentKey(nodes[end]) === parentKey(nodes[i])
    ? end
    : -1;
}

function orderedIds(nodes: FlatCategory[]): string[] {
  return nodes.map((n) => n.category.id);
}

/** Swap the two adjacent subtree blocks containing `i` and `j` (must be siblings). */
function swapSiblingBlocks(
  nodes: FlatCategory[],
  i: number,
  j: number,
): string[] | null {
  const [aStart, aEnd] = subtreeRange(nodes, Math.min(i, j));
  const [bStart, bEnd] = subtreeRange(nodes, Math.max(i, j));
  if (aEnd !== bStart) return null; // siblings are adjacent in DFS order
  return orderedIds([
    ...nodes.slice(0, aStart),
    ...nodes.slice(bStart, bEnd),
    ...nodes.slice(aStart, aEnd),
    ...nodes.slice(bEnd),
  ]);
}

/**
 * Drop `activeId` next to `overId`, only when they are siblings; otherwise the
 * drag cannot be represented (parenting is edited in the form, not by dragging)
 * so we return null and the list stays put.
 */
function moveNodeBetweenSiblings(
  nodes: FlatCategory[],
  activeId: string,
  overId: string,
): string[] | null {
  const ai = nodes.findIndex((n) => n.category.id === activeId);
  const oi = nodes.findIndex((n) => n.category.id === overId);
  if (ai < 0 || oi < 0) return null;
  if (parentKey(nodes[ai]) !== parentKey(nodes[oi])) return null;
  const [as, ae] = subtreeRange(nodes, ai);
  const block = nodes.slice(as, ae);
  const rest = [...nodes.slice(0, as), ...nodes.slice(ae)];
  const oi2 = rest.findIndex((n) => n.category.id === overId);
  if (oi2 < 0) return null;
  const [os, oe] = subtreeRange(rest, oi2);
  const insertAt = ai < oi ? oe : os; // dragging down → after target, up → before
  return orderedIds([
    ...rest.slice(0, insertAt),
    ...block,
    ...rest.slice(insertAt),
  ]);
}

/**
 * CategoryTree (plan 9c.8): a flattened, indented tree with drag-to-reorder AND
 * keyboard-accessible Move up / Move down buttons (AGENTS: drag is never the only
 * way to reorder). Dragging changes display order only; parenting is set in the
 * editor. Selecting a row opens it in the editor panel.
 */
export function CategoryTree({
  nodes,
  selectedId,
  onSelect,
  onReorder,
}: {
  nodes: FlatCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const ids = nodes.map((n) => n.category.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ordered = moveNodeBetweenSiblings(
      nodes,
      String(active.id),
      String(over.id),
    );
    if (ordered) onReorder(ordered);
  }

  function move(id: string, direction: -1 | 1) {
    const index = nodes.findIndex((n) => n.category.id === id);
    if (index < 0) return;
    const sib =
      direction === -1
        ? prevSiblingIndex(nodes, index)
        : nextSiblingIndex(nodes, index);
    if (sib < 0) return; // no sibling in that direction (button is disabled)
    const ordered = swapSiblingBlocks(nodes, index, sib);
    if (ordered) onReorder(ordered);
  }

  if (nodes.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
        No categories yet. Create your first one.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-sidebar-border">
          {nodes.map((node, index) => (
            <SortableRow
              key={node.category.id}
              node={node}
              canMoveUp={prevSiblingIndex(nodes, index) >= 0}
              canMoveDown={nextSiblingIndex(nodes, index) >= 0}
              selected={node.category.id === selectedId}
              onSelect={() => onSelect(node.category.id)}
              onMoveUp={() => move(node.category.id, -1)}
              onMoveDown={() => move(node.category.id, 1)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  node,
  canMoveUp,
  canMoveDown,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
}: {
  node: FlatCategory;
  canMoveUp: boolean;
  canMoveDown: boolean;
  selected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.category.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { category, depth } = node;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 py-1.5 pr-2 text-sm",
        isDragging && "z-10 opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${category.name_en}`}
        className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
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
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
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
    </li>
  );
}
