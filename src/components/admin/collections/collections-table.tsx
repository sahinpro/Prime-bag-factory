"use client";

import { Layers, Pencil, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  deleteCollection,
  saveCollection,
} from "@/app/(admin)/admin/collections/actions";
import { CollectionEditor } from "@/components/admin/collections/collection-editor";
import {
  createColumnHelper,
  DataTable,
  type DataTableColumn,
  type DataTableQuery,
} from "@/components/admin/data/data-table";
import { EmptyState } from "@/components/admin/data/empty-state";
import { FilterBar } from "@/components/admin/data/filter-bar";
import { ToneBadge } from "@/components/admin/data/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import type { CollectionInput } from "@/lib/validators/collection";
import type { AdminCollection } from "@/server/collections";
import { Eye, EyeOff } from "lucide-react";

type Flash = { kind: "error" | "success"; text: string } | null;

const DEFAULT_QUERY: DataTableQuery = {
  q: "",
  sort: null,
  dir: "asc",
  page: 1,
  pageSize: 10,
};

function toSearchParams(q: DataTableQuery): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.sort) {
    p.set("sort", q.sort);
    p.set("dir", q.dir);
  }
  if (q.page > 1) p.set("page", String(q.page));
  if (q.pageSize !== DEFAULT_QUERY.pageSize) p.set("size", String(q.pageSize));
  return p.toString();
}

function normalizeQuery(
  input: Partial<DataTableQuery> | undefined,
): DataTableQuery {
  const size = Number(input?.pageSize);
  const page = Number(input?.page);
  return {
    q: input?.q ?? "",
    sort: input?.sort || null,
    dir: input?.dir === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50].includes(size) ? size : DEFAULT_QUERY.pageSize,
  };
}

const columnHelper = createColumnHelper<AdminCollection>();

/**
 * CollectionsManager (plan 9c.8 "DataTable + side Sheet editor"). The list is a
 * `DataTable` whose sort/page/search are reflected in the URL; editing happens in
 * a right-hand `Sheet`. Data stays server-driven — every save/delete revalidates
 * and the page re-renders with fresh props.
 */
export function CollectionsTable({
  collections,
  initialQuery,
}: Readonly<{
  collections: AdminCollection[];
  initialQuery: Partial<DataTableQuery>;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState<DataTableQuery>(() =>
    normalizeQuery(initialQuery),
  );
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminCollection | undefined>(
    undefined,
  );
  const [flash, setFlash] = React.useState<Flash>(null);

  function pushQuery(next: DataTableQuery) {
    setQuery(next);
    const search = toSearchParams(next);
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const filtered = React.useMemo(() => {
    const term = query.q.trim().toLowerCase();
    if (!term) return collections;
    return collections.filter((c) =>
      [c.name_en, c.name_bn ?? "", c.slug]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [collections, query.q]);

  function openNew() {
    setEditing(undefined);
    setEditorOpen(true);
    setFlash(null);
  }

  function openEdit(collection: AdminCollection) {
    setEditing(collection);
    setEditorOpen(true);
    setFlash(null);
  }

  async function handleSave(payload: CollectionInput & { id?: string }) {
    const result = await saveCollection(payload);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return false;
    }
    router.refresh();
    setEditorOpen(false);
    setFlash({ kind: "success", text: "Saved." });
    return true;
  }

  async function handleDelete(id: string) {
    const result = await deleteCollection(id);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return;
    }
    router.refresh();
    setEditorOpen(false);
    setFlash({ kind: "success", text: "Collection deleted." });
  }

  const columns = React.useMemo<DataTableColumn<AdminCollection>[]>(
    () => [
      columnHelper.accessor("name_en", {
        header: "Name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.name_en}
            </p>
            {row.original.name_bn ? (
              <p lang="bn" className="truncate text-xs text-muted-foreground">
                {row.original.name_bn}
              </p>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor("slug", {
        header: "Slug",
        cell: ({ getValue }) => (
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted-foreground">
            {getValue()}
          </code>
        ),
      }),
      columnHelper.accessor("product_count", {
        header: "Products",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{getValue()} linked</span>
        ),
      }),
      columnHelper.accessor((row) => (row.is_active ? "active" : "hidden"), {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.is_active ? (
            <ToneBadge tone="success" icon={Eye}>
              Active
            </ToneBadge>
          ) : (
            <ToneBadge tone="neutral" icon={EyeOff}>
              Hidden
            </ToneBadge>
          ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(row.original)}
            >
              <Pencil
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4"
              />
              Edit
              <span className="sr-only">: {row.original.name_en}</span>
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  function renderMobileCard(row: AdminCollection) {
    return (
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium text-foreground">{row.name_en}</p>
          {row.name_bn ? (
            <p lang="bn" className="truncate text-xs text-muted-foreground">
              {row.name_bn}
            </p>
          ) : null}
          <code className="block truncate text-xs text-muted-foreground">
            {row.slug}
          </code>
          <div className="flex items-center gap-2 pt-1">
            {row.is_active ? (
              <ToneBadge tone="success" icon={Eye}>
                Active
              </ToneBadge>
            ) : (
              <ToneBadge tone="neutral" icon={EyeOff}>
                Hidden
              </ToneBadge>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {row.product_count} linked
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
          <Pencil aria-hidden="true" strokeWidth={1.75} className="size-4" />
          Edit
          <span className="sr-only">: {row.name_en}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description="Group products by industry — food delivery, pharma, NGO and more."
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            New collection
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

      <FilterBar
        value={query.q}
        label="Search collections"
        placeholder="Search by name or slug…"
        canReset={query.q !== ""}
        onSearch={(q) => pushQuery({ ...query, q, page: 1 })}
        onReset={() =>
          pushQuery({ ...DEFAULT_QUERY, pageSize: query.pageSize })
        }
      />

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        query={query}
        onQueryChange={pushQuery}
        renderMobileCard={renderMobileCard}
        caption="Collections and their linked product counts"
        empty={
          collections.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No collections yet"
              description="Create a collection to group products by industry or campaign."
              action={
                <Button size="sm" onClick={openNew}>
                  <Plus
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4"
                  />
                  New collection
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Layers}
              title="No matches"
              description="No collections match your search."
            />
          )
        }
      />

      <CollectionEditor
        key={editing?.id ?? "new"}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        collection={editing}
        nextSortOrder={collections.length}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
