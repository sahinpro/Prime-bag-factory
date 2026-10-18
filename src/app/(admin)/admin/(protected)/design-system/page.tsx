"use client";

import {
  Boxes,
  FileText,
  LayoutDashboard,
  Package,
  Pencil,
  ShoppingCart,
} from "lucide-react";

import * as React from "react";

import { SwatchPicker } from "@/components/admin/catalog/swatch-picker";
import { RadialGauge } from "@/components/admin/dashboard/radial-gauge";
import { SegmentBar } from "@/components/admin/dashboard/segment-bar";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import {
  createColumnHelper,
  DataTable,
  type DataTableColumn,
  type DataTableQuery,
} from "@/components/admin/data/data-table";
import { EmptyState } from "@/components/admin/data/empty-state";
import { ErrorState } from "@/components/admin/data/error-state";
import { FilterBar } from "@/components/admin/data/filter-bar";
import type { StatusDomain } from "@/components/admin/data/status-badge";
import { StatusBadge, ToneBadge } from "@/components/admin/data/status-badge";
import {
  CardSkeleton,
  TableSkeleton,
} from "@/components/admin/data/table-skeleton";
import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { FormSection } from "@/components/admin/forms/form-section";
import { ImageUploader } from "@/components/admin/forms/image-uploader";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const STATUS_DOMAINS: { domain: StatusDomain; values: string[] }[] = [
  { domain: "quote", values: ["new", "contacted", "quoted", "won", "lost"] },
  {
    domain: "order",
    values: [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
    ],
  },
  {
    domain: "payment",
    values: ["unpaid", "partially_paid", "paid", "refunded"],
  },
  {
    domain: "production",
    values: [
      "awaiting_artwork",
      "artwork_approved",
      "in_production",
      "qc",
      "ready",
    ],
  },
  { domain: "product", values: ["draft", "published", "archived"] },
  { domain: "stock", values: ["ok", "low", "out"] },
  { domain: "urgency", values: ["overdue", "due_soon", "later"] },
];

const swatches = [
  { id: "s1", name: "Natural Jute", colorHex: "#c8a86a" },
  { id: "s2", name: "Ink Canvas", colorHex: "#1c1917" },
  { id: "s3", name: "Ivory Cotton", colorHex: "#fbf8f1" },
  { id: "s4", name: "Forest Twill", colorHex: "#1f5f4a" },
];

function DemoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-card">
      <CardHeader>
        {/* Real heading (h2) so the gallery keeps a valid h1 → h2 → h3 order
            for the FormSection demo nested below. */}
        <h2 className="text-base font-semibold leading-none tracking-tight">
          {title}
        </h2>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

type DemoRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  published: boolean;
};

const demoRows: DemoRow[] = [
  {
    id: "d1",
    name: "Insulated Delivery Bag",
    category: "Thermal",
    price: 640,
    published: true,
  },
  {
    id: "d2",
    name: "Jute Tote — Natural",
    category: "Jute",
    price: 320,
    published: true,
  },
  {
    id: "d3",
    name: "Non-woven Shopping Bag",
    category: "Poly",
    price: 90,
    published: false,
  },
  {
    id: "d4",
    name: "Canvas Laptop Sleeve",
    category: "Canvas",
    price: 1150,
    published: true,
  },
];

const demoColumnHelper = createColumnHelper<DemoRow>();

// Self-contained DataTable + FilterBar demo (plan 9c.5). Sorting/pagination are
// handled by DataTable; search filters the rows here, mirroring real usage.
function DataTableDemo() {
  const [query, setQuery] = React.useState<DataTableQuery>({
    q: "",
    sort: null,
    dir: "asc",
    page: 1,
    pageSize: 10,
  });

  const filtered = React.useMemo(() => {
    const term = query.q.trim().toLowerCase();
    if (!term) return demoRows;
    return demoRows.filter((r) =>
      `${r.name} ${r.category}`.toLowerCase().includes(term),
    );
  }, [query.q]);

  const columns = React.useMemo<DataTableColumn<DemoRow>[]>(
    () => [
      demoColumnHelper.accessor("name", {
        header: "Product",
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{getValue()}</span>
        ),
      }),
      demoColumnHelper.accessor("category", { header: "Category" }),
      demoColumnHelper.accessor("price", {
        header: "Price",
        cell: ({ getValue }) => (
          <span className="tabular-nums">৳{getValue()}</span>
        ),
      }),
      demoColumnHelper.accessor(
        (row) => (row.published ? "Published" : "Draft"),
        {
          id: "status",
          header: "Status",
          cell: ({ row }) =>
            row.original.published ? (
              <ToneBadge tone="success">Published</ToneBadge>
            ) : (
              <ToneBadge tone="neutral">Draft</ToneBadge>
            ),
        },
      ),
      demoColumnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: () => (
          <div className="flex justify-end">
            <Button variant="outline" size="sm">
              <Pencil
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4"
              />
              Edit
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <FilterBar
        value={query.q}
        label="Search products"
        placeholder="Search products…"
        canReset={query.q !== ""}
        onSearch={(q) => setQuery((prev) => ({ ...prev, q, page: 1 }))}
        onReset={() => setQuery((prev) => ({ ...prev, q: "", page: 1 }))}
      />
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        query={query}
        onQueryChange={setQuery}
        caption="Demo products"
        renderMobileCard={(row) => (
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.category} · ৳{row.price}
              </p>
            </div>
            {row.published ? (
              <ToneBadge tone="success">Published</ToneBadge>
            ) : (
              <ToneBadge tone="neutral">Draft</ToneBadge>
            )}
          </div>
        )}
        empty={
          <EmptyState
            icon={Package}
            title="No matches"
            description="No demo products match your search."
          />
        }
      />
    </div>
  );
}

// Self-contained ImageUploader demo (Media task). Local state only — a real
// upload posts to the server-signed Cloudinary action, but nothing here is saved.
function ImageUploaderDemo() {
  const [url, setUrl] = React.useState("");
  return (
    <div className="max-w-md">
      <ImageUploader
        id="ds-image"
        label="Product image"
        folder="products"
        value={url}
        onChange={setUrl}
        hint="Uploads resize and compress via Cloudinary. Demo only — nothing is saved."
      />
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin design system"
        description="Every kit component, status badge and state. Toggle the theme to check both. Not available in production."
      />

      <div className="grid gap-6">
        <DemoCard title="Status badges (9c.6)">
          <div className="space-y-3">
            {STATUS_DOMAINS.map(({ domain, values }) => (
              <div key={domain} className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {domain}
                </span>
                {values.map((v) => (
                  <StatusBadge key={v} domain={domain} value={v} />
                ))}
              </div>
            ))}
          </div>
        </DemoCard>

        <DemoCard title="Tones">
          <div className="flex flex-wrap gap-2">
            <ToneBadge tone="ink">Ink</ToneBadge>
            <ToneBadge tone="neutral">Neutral</ToneBadge>
            <ToneBadge tone="gold">Gold</ToneBadge>
            <ToneBadge tone="success">Success</ToneBadge>
            <ToneBadge tone="warning">Warning</ToneBadge>
            <ToneBadge tone="destructive">Destructive</ToneBadge>
          </div>
        </DemoCard>

        <DemoCard title="Stat cards">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="New quotes"
              value="12"
              icon={FileText}
              delta={{ value: 7.1, display: "+7.1%", label: "vs last week" }}
              sparkline={[3, 5, 4, 6, 8, 7, 12]}
              href="/admin/design-system"
            />
            <StatCard
              label="Pending orders"
              value="5"
              icon={ShoppingCart}
              delta={{ value: -2, display: "-2", label: "vs last week" }}
            />
            <StatCard
              label="Sales"
              value="৳48,200"
              icon={LayoutDashboard}
              sparkline={[10, 12, 11, 15, 14, 18, 20]}
            />
            <StatCard
              label="Low stock"
              value="8"
              icon={Boxes}
              delta={{ value: -1, display: "-1", label: "vs last week" }}
            />
          </div>
        </DemoCard>

        <DemoCard title="Charts">
          <div className="grid gap-8 sm:grid-cols-2">
            <SegmentBar
              segments={[
                { label: "New", value: 12, color: "var(--chart-2)" },
                { label: "Quoted", value: 8, color: "var(--chart-1)" },
                { label: "Won", value: 5, color: "var(--chart-3)" },
                { label: "Lost", value: 3, color: "var(--chart-5)" },
              ]}
            />
            <div className="flex items-center justify-center">
              <RadialGauge value={62} label="Quote win rate" />
            </div>
          </div>
        </DemoCard>

        <DemoCard title="Data table and filters (9c.5)">
          <DataTableDemo />
        </DemoCard>

        <DemoCard title="Loading states">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-card border">
              <TableSkeleton rows={4} cols={4} />
            </div>
            <CardSkeleton />
          </div>
        </DemoCard>

        <DemoCard title="Empty and error states">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border">
              <EmptyState
                icon={Package}
                title="No products yet"
                description="Create your first product to start building the catalog."
                action={<Button>New product</Button>}
              />
            </div>
            <div className="rounded-card border">
              <ErrorState
                message="We could not load recent orders."
                action={<Button variant="outline">Retry</Button>}
              />
            </div>
          </div>
        </DemoCard>

        <DemoCard title="Forms">
          <FormSection
            title="Product title"
            description="English is required; Bangla falls back to English when empty."
          >
            <BilingualField
              id="title"
              label="Title"
              required
              valueEn="Insulated Delivery Bag"
              valueBn=""
              onChangeEn={() => {}}
              onChangeBn={() => {}}
            />
            <BilingualField
              id="desc"
              label="Short description"
              multiline
              valueEn="Keeps food hot for up to 4 hours."
              valueBn="৪ ঘণ্টা পর্যন্ত খাবার গরম রাখে।"
              onChangeEn={() => {}}
              onChangeBn={() => {}}
            />
          </FormSection>
        </DemoCard>

        <DemoCard title="Swatch picker">
          <SwatchPicker
            legend="Body fabric"
            value="s1"
            onChange={() => {}}
            options={swatches}
          />
        </DemoCard>

        <DemoCard title="Confirm dialog">
          <ConfirmDialog
            trigger={<Button variant="destructive">Archive product</Button>}
            title="Archive “Insulated Delivery Bag”?"
            description="Archived products are hidden from the catalog. You can restore them later."
            confirmLabel="Archive"
            destructive
            onConfirm={() => Promise.resolve()}
          />
        </DemoCard>

        <DemoCard title="Image uploader (Media)">
          <ImageUploaderDemo />
        </DemoCard>
      </div>
    </div>
  );
}
