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

export type FlatCategory = { category: AdminCategory; depth: number };

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
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  function move(id: string, direction: -1 | 1) {
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    onReorder(arrayMove(ids, index, target));
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
              index={index}
              count={nodes.length}
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
  index,
  count,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
}: {
  node: FlatCategory;
  index: number;
  count: number;
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
          disabled={index === 0}
          aria-label={`Move ${category.name_en} up`}
        >
          <ChevronUp aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onMoveDown}
          disabled={index === count - 1}
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
