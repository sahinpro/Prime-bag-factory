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

import { SwatchChip } from "@/components/admin/catalog/swatch-chip";
import { SwatchPicker } from "@/components/admin/catalog/swatch-picker";
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed";
import { ChartCard } from "@/components/admin/dashboard/chart-card";
import { ChartRangeMenu } from "@/components/admin/dashboard/chart-range-menu";
import { ChartSkeleton } from "@/components/admin/dashboard/chart-skeleton";
import { RadialGauge } from "@/components/admin/dashboard/radial-gauge";
import { SegmentBar } from "@/components/admin/dashboard/segment-bar";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import {
  createColumnHelper,
  DataTable,
  type DataTableColumn,
  type DataTableQuery,
} from "@/components/admin/data/data-table";
import { DetailDrawer } from "@/components/admin/data/detail-drawer";
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
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import { TierEditor, type TierRow } from "@/components/admin/forms/tier-editor";
import {
  PrintChecklist,
  PrintRow,
  PrintSection,
} from "@/components/admin/print/print-sheet";
import { ColorChip } from "@/components/admin/quotes/color-chip";
import { PageHeader } from "@/components/admin/shell/page-header";
import { TabsBar } from "@/components/admin/shell/tabs-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import type { DashboardData, Range } from "@/server/dashboard";

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

// DetailDrawer demo (Customers task): the controlled sheet a list page uses
// to open a row's full context without leaving the table.
function DetailDrawerDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Right-side sheet, body scrolls independently, footer pins actions.
      </p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open demo drawer
      </Button>
      <DetailDrawer
        open={open}
        onOpenChange={setOpen}
        title="Demo customer"
        description="01700000000 · 2 orders · 1 quote"
        footer={
          <Button className="w-full" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            Drawer body — history lists, contact cards and quick links live
            here.
          </p>
          <p className="text-xs text-muted-foreground">
            Escape, the overlay and the close button all dismiss it; focus
            returns to the trigger.
          </p>
        </div>
      </DetailDrawer>
    </div>
  );
}

// TierEditor demo (plan 9c.5 Pricing): a controlled list of quantity ranges.
// Local state only — nothing is saved. Overlaps/gaps surface as warnings, an
// inverted range or zero price as an error, exactly as on the real product form.
function TierEditorDemo() {
  const [tiers, setTiers] = React.useState<TierRow[]>([
    { min_qty: 1, max_qty: 50, unit_price: 320 },
    { min_qty: 51, max_qty: 200, unit_price: 290 },
    { min_qty: 201, max_qty: null, unit_price: 260 },
  ]);
  return <TierEditor tiers={tiers} onChange={setTiers} idPrefix="ds-tier" />;
}

// StickySaveBar demo (plan 9c.5): the bar returns null until the form is dirty.
// Toggle the switch to preview the save/discard bar.
function StickySaveBarDemo() {
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={dirty} onCheckedChange={setDirty} />
        Mark form as having unsaved changes
      </label>
      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => {
          setSaving(true);
          window.setTimeout(() => {
            setSaving(false);
            setDirty(false);
          }, 800);
        }}
        onDiscard={() => setDirty(false)}
      />
    </div>
  );
}

// TabsBar + ChartRangeMenu demo (plan 9c.3/9c.5): the range control is URL-synced
// in real use; here it drives local state so the gallery stays self-contained.
function RangeControlsDemo() {
  const [range] = React.useState<Range>("30d");
  return (
    <div className="space-y-4">
      <TabsBar value={range} baseQuery="" />
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          ChartCard ⋯ menu (same range, as a dropdown):
        </span>
        <ChartRangeMenu value={range} baseQuery="" />
      </div>
      <p className="text-xs text-muted-foreground">
        Both set <code className="rounded-xs bg-surface-2 px-1">?range=</code>{" "}
        on the current page in production; in this gallery they are inert.
      </p>
    </div>
  );
}

// ChartCard + ChartSkeleton demo (plan 9c.9): the shell wraps a chart, and the
// loading skeleton matches the content height so nothing shifts.
function ChartCardDemo() {
  return (
    <div className="grid gap-4">
      <ChartCard
        title="Orders over time"
        subtitle="Last 30 days"
        info="Confirmed orders, grouped by day."
        height="md"
        footer="Updated just now"
      >
        <SegmentBar
          segments={[
            { label: "Pending", value: 5, color: "var(--chart-2)" },
            { label: "Processing", value: 9, color: "var(--chart-1)" },
            { label: "Delivered", value: 24, color: "var(--chart-3)" },
          ]}
        />
      </ChartCard>
      <ChartCard title="Loading chart" subtitle="Skeleton matches height" height="md">
        <ChartSkeleton height="md" />
      </ChartCard>
    </div>
  );
}

// ActivityFeed demo (plan 9c.7): compact newest-first rows. Entries match the
// DashboardData["activity"] shape the dashboard passes in.
const DEMO_ACTIVITY: DashboardData["activity"] = [
  {
    id: "a1",
    action: "status_change",
    table: "orders",
    recordId: "o-1042",
    actor: "Ayesha Rahman",
    at: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: "a2",
    action: "create",
    table: "products",
    recordId: "p-88",
    actor: "Imran Kabir",
    at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
  },
  {
    id: "a3",
    action: "login",
    table: "profiles",
    recordId: null,
    actor: null,
    at: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
  },
];

// SwatchChip demo (plan 9c.5): decorative round chips, selected vs unselected.
function SwatchChipDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {swatches.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <SwatchChip colorHex={s.colorHex} selected={i === 0} />
          <span className="text-xs text-muted-foreground">{s.name}</span>
        </div>
      ))}
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

        <DemoCard title="Chart card, skeleton and range controls (9c.5 / 9c.9)">
          <div className="space-y-6">
            <ChartCardDemo />
            <RangeControlsDemo />
          </div>
        </DemoCard>

        <DemoCard title="Data table and filters (9c.5)">
          <DataTableDemo />
        </DemoCard>

        <DemoCard title="Detail drawer">
          <DetailDrawerDemo />
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

        <DemoCard title="Swatch chips (9c.5)">
          <SwatchChipDemo />
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

        <DemoCard title="Print sheet parts (9c.5)">
          {/* Paper is always black-on-white (plan print spec), so the demo
              sits on a forced-white block in both themes. The full sheet
              renders outside the shell on the /admin/print/… routes. */}
          <div className="rounded-control bg-white p-4 text-black">
            <PrintSection title="Customer">
              <dl>
                <PrintRow label="Company">Acme Foods Ltd.</PrintRow>
                <PrintRow label="Quantity">1,000 pcs</PrintRow>
              </dl>
            </PrintSection>
            <PrintChecklist
              items={["Artwork proof approved", "Stitching QC passed"]}
            />
          </div>
        </DemoCard>

        <DemoCard title="Color chips (quotes)">
          <div className="flex flex-wrap gap-2">
            <ColorChip label="Body" name="Natural Jute" hex="#c8a86a" />
            <ColorChip label="Handle" name="Ink Canvas" hex="#1c1917" />
          </div>
        </DemoCard>

        <DemoCard title="Tier editor — pricing (9c.5)">
          <TierEditorDemo />
        </DemoCard>

        <DemoCard title="Sticky save bar (9c.5)">
          <StickySaveBarDemo />
        </DemoCard>

        <DemoCard title="Activity feed (9c.7)">
          <div className="rounded-card border">
            <ActivityFeed entries={DEMO_ACTIVITY} />
          </div>
        </DemoCard>
      </div>
    </div>
  );
}
