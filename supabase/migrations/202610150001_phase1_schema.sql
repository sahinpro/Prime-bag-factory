create extension if not exists pgcrypto;

create type public.user_role as enum ('owner', 'manager', 'sales', 'inventory', 'customer');

create type public.product_type as enum ('buy_now', 'quote_only');
create type public.product_stock_mode as enum ('tracked', 'made_to_order');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.product_custom_input_type as enum ('swatch', 'select', 'dimensions', 'file', 'text');
create type public.order_type as enum ('retail', 'bulk');
create type public.order_status as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded');
create type public.payment_method as enum ('cod', 'bkash_manual', 'nagad_manual', 'bank_transfer', 'cash');
create type public.quote_source as enum ('form', 'builder');
create type public.quote_status as enum ('new', 'contacted', 'quoted', 'won', 'lost');
create type public.notification_channel as enum ('email', 'sms', 'whatsapp', 'admin_alert');
create type public.notification_status as enum ('pending', 'sent', 'failed');
create type public.movement_reason as enum ('opening', 'purchase', 'sale', 'return', 'adjustment', 'damage', 'cancel_release');
create type public.blocked_contact_type as enum ('phone', 'ip_hash');
create type public.shipping_zone_status as enum ('active', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  name_en text not null,
  name_bn text,
  description_en text,
  description_bn text,
  image_path text,
  seo_title_en text,
  seo_title_bn text,
  seo_description_en text,
  seo_description_bn text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_bn text,
  description_en text,
  description_bn text,
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  type public.product_type not null default 'buy_now',
  title_en text not null,
  title_bn text,
  short_description_en text,
  short_description_bn text,
  description_en text,
  description_bn text,
  specs jsonb not null default '{}'::jsonb,
  material text,
  moq integer not null default 1 check (moq >= 1),
  lead_time_days integer,
  stock_mode public.product_stock_mode not null default 'tracked',
  customization_enabled boolean not null default false,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  seo_title_en text,
  seo_title_bn text,
  seo_description_en text,
  seo_description_bn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, category_id)
);

create table public.product_collections (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (product_id, collection_id)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid,
  path text not null,
  alt_en text,
  alt_bn text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  swatch_id uuid,
  color_name text,
  color_hex text,
  size text,
  price_delta numeric(12,2) not null default 0,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  reserved_qty integer not null default 0 check (reserved_qty >= 0),
  low_stock_threshold integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty integer not null check (min_qty >= 1),
  max_qty integer,
  unit_price numeric(12,2) not null check (unit_price > 0),
  created_at timestamptz not null default now(),
  unique (product_id, min_qty),
  check (max_qty is null or max_qty > min_qty)
);

create table public.swatch_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_en text not null,
  name_bn text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.swatches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.swatch_groups(id) on delete cascade,
  name_en text not null,
  name_bn text,
  code text,
  color_hex text,
  texture_image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_custom_parts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  key text not null,
  label_en text not null,
  label_bn text,
  input_type public.product_custom_input_type not null,
  swatch_group_id uuid references public.swatch_groups(id) on delete set null,
  is_required boolean not null default false,
  price_delta numeric(12,2) not null default 0,
  config jsonb not null default '{}'::jsonb,
  help_text_en text,
  help_text_bn text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, key)
);

create table public.product_part_swatches (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.product_custom_parts(id) on delete cascade,
  swatch_id uuid not null references public.swatches(id) on delete cascade,
  is_default boolean not null default false,
  price_delta numeric(12,2),
  created_at timestamptz not null default now(),
  unique (part_id, swatch_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta integer not null,
  reason public.movement_reason not null,
  ref_type text,
  ref_id text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_bn text,
  fee numeric(12,2) not null default 0 check (fee >= 0),
  free_over numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  type public.order_type not null default 'retail',
  status public.order_status not null default 'pending',
  payment_method public.payment_method not null default 'cod',
  payment_status public.payment_status not null default 'unpaid',
  production_status text,
  idempotency_key text unique,
  courier_name text,
  tracking_code text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  vat_amount numeric(12,2) not null default 0,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  division text,
  district text,
  area text,
  address_line text,
  shipping_zone_id uuid references public.shipping_zones(id),
  subtotal numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  customer_note text,
  admin_note text,
  source_quote_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id),
  title_snapshot text not null,
  sku_snapshot text,
  color_snapshot text,
  size_snapshot text,
  unit_price numeric(12,2) not null,
  qty integer not null check (qty > 0),
  line_total numeric(12,2) not null,
  tier_min_qty integer,
  customization jsonb,
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null,
  reference text,
  received_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  channel public.notification_channel not null,
  recipient text not null,
  template text,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  window_start timestamptz not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blocked_contacts (
  id uuid primary key default gen_random_uuid(),
  type public.blocked_contact_type not null,
  value text not null,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (type, value)
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  source public.quote_source not null default 'form',
  company_name text,
  contact_name text not null,
  phone text not null,
  email text,
  product_id uuid references public.products(id),
  category_id uuid references public.categories(id),
  quantity integer,
  custom_size text,
  custom_color text,
  needs_logo_print boolean not null default false,
  customization jsonb,
  estimated_unit_price numeric(12,2),
  estimated_total numeric(12,2),
  needed_by date,
  message text,
  attachment_path text,
  status public.quote_status not null default 'new',
  quoted_amount numeric(12,2),
  valid_until date,
  assigned_to uuid references public.profiles(id),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_sections (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  key text not null,
  content jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page, key)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  rating integer not null default 5 check (rating between 1 and 5),
  body_en text,
  body_bn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question_en text not null,
  question_bn text,
  answer_en text not null,
  answer_bn text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_bn text,
  body_en text,
  body_bn text,
  cover_path text,
  status text not null default 'draft',
  published_at timestamptz,
  seo_title_en text,
  seo_title_bn text,
  seo_description_en text,
  seo_description_bn text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  number text,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  status_code integer not null default 308,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_product_variants_product_id on public.product_variants(product_id);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_product_images_product_id on public.product_images(product_id);
create index if not exists idx_order_status on public.orders(status);
create index if not exists idx_quote_status on public.quote_requests(status);
create index if not exists idx_notifications_status on public.notifications(status);
create index if not exists idx_inventory_movements_variant_id on public.inventory_movements(variant_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger collections_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

create trigger products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger product_variants_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

create trigger swatches_updated_at
before update on public.swatches
for each row execute function public.set_updated_at();

create trigger shipping_zones_updated_at
before update on public.shipping_zones
for each row execute function public.set_updated_at();

create trigger orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger quote_requests_updated_at
before update on public.quote_requests
for each row execute function public.set_updated_at();

create trigger site_sections_updated_at
before update on public.site_sections
for each row execute function public.set_updated_at();

create trigger clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger gallery_items_updated_at
before update on public.gallery_items
for each row execute function public.set_updated_at();

create trigger testimonials_updated_at
before update on public.testimonials
for each row execute function public.set_updated_at();

create trigger faqs_updated_at
before update on public.faqs
for each row execute function public.set_updated_at();

create trigger posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create trigger legal_documents_updated_at
before update on public.legal_documents
for each row execute function public.set_updated_at();

create trigger redirects_updated_at
before update on public.redirects
for each row execute function public.set_updated_at();

create trigger settings_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
as $$
  select coalesce(
    auth.uid() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role::text = any(roles)
    ),
    false
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_collections enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.price_tiers enable row level security;
alter table public.swatch_groups enable row level security;
alter table public.swatches enable row level security;
alter table public.product_custom_parts enable row level security;
alter table public.product_part_swatches enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.rate_limits enable row level security;
alter table public.blocked_contacts enable row level security;
alter table public.quote_requests enable row level security;
alter table public.site_sections enable row level security;
alter table public.clients enable row level security;
alter table public.gallery_items enable row level security;
alter table public.testimonials enable row level security;
alter table public.faqs enable row level security;
alter table public.posts enable row level security;
alter table public.legal_documents enable row level security;
alter table public.redirects enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "Public can read visible catalog rows" on public.categories
for select
using (is_active = true);

create policy "Public can read visible catalog rows" on public.collections
for select
using (is_active = true);

create policy "Public can read published product rows" on public.products
for select
using (status = 'published');

create policy "Public can read published product joins" on public.product_categories
for select
using (true);

create policy "Public can read published product joins" on public.product_collections
for select
using (true);

create policy "Public can read product images" on public.product_images
for select
using (true);

create policy "Public can read active variants" on public.product_variants
for select
using (is_active = true);

create policy "Public can read product tiers" on public.price_tiers
for select
using (true);

create policy "Public can read swatch library" on public.swatches
for select
using (is_active = true);

create policy "Public can read custom parts for published products" on public.product_custom_parts
for select
using (exists (
  select 1 from public.products p
  where p.id = product_custom_parts.product_id
    and p.status = 'published'
));

create policy "Public can read product part swatches" on public.product_part_swatches
for select
using (true);

create policy "Public can read active shipping zones" on public.shipping_zones
for select
using (is_active = true);

create policy "Public can read published content" on public.site_sections
for select
using (is_active = true);

create policy "Public can read active clients" on public.clients
for select
using (is_active = true);

create policy "Public can read gallery" on public.gallery_items
for select
using (true);

create policy "Public can read testimonials" on public.testimonials
for select
using (true);

create policy "Public can read FAQs" on public.faqs
for select
using (true);

create policy "Public can read published posts" on public.posts
for select
using (status = 'published');

create policy "Public can read legal documents" on public.legal_documents
for select
using (true);

create policy "Public can read redirects" on public.redirects
for select
using (true);

create policy "Public can read settings" on public.settings
for select
using (true);

create policy "Staff can manage profiles" on public.profiles
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Owner and manager can manage catalog" on public.categories
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Owner and manager can manage collections" on public.collections
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Owner and manager can manage products" on public.products
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Owner and manager can manage product relations" on public.product_categories
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Owner and manager can manage product relations" on public.product_collections
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Owner and manager can manage images" on public.product_images
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Owner and manager can manage variants" on public.product_variants
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Owner and manager can manage price tiers" on public.price_tiers
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Staff can manage swatches" on public.swatches
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Staff can manage custom parts" on public.product_custom_parts
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Staff can manage part swatches" on public.product_part_swatches
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Inventory staff can read/write movement ledger" on public.inventory_movements
for all
using (public.has_role(array['owner', 'manager', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'inventory']));

create policy "Owner and manager can manage shipping zones" on public.shipping_zones
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Sales and management can manage quotes and orders" on public.orders
for all
using (public.has_role(array['owner', 'manager', 'sales', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'sales', 'inventory']));

create policy "Sales and management can manage order items" on public.order_items
for all
using (public.has_role(array['owner', 'manager', 'sales', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'sales', 'inventory']));

create policy "Sales and management can manage order status history" on public.order_status_history
for all
using (public.has_role(array['owner', 'manager', 'sales', 'inventory']))
with check (public.has_role(array['owner', 'manager', 'sales', 'inventory']));

create policy "Sales and management can manage payments" on public.payments
for all
using (public.has_role(array['owner', 'manager', 'sales']))
with check (public.has_role(array['owner', 'manager', 'sales']));

create policy "Management can manage notifications" on public.notifications
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage rate limits" on public.rate_limits
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage blocked contacts" on public.blocked_contacts
for all
using (public.has_role(array['owner', 'manager', 'sales']))
with check (public.has_role(array['owner', 'manager', 'sales']));

create policy "Sales and management can manage quote requests" on public.quote_requests
for all
using (public.has_role(array['owner', 'manager', 'sales']))
with check (public.has_role(array['owner', 'manager', 'sales']));

create policy "Management can manage site content" on public.site_sections
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage clients" on public.clients
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage gallery" on public.gallery_items
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage testimonials" on public.testimonials
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage FAQs" on public.faqs
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage posts" on public.posts
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage legal docs" on public.legal_documents
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage redirects" on public.redirects
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage settings" on public.settings
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create policy "Management can manage audit logs" on public.audit_logs
for all
using (public.has_role(array['owner', 'manager']))
with check (public.has_role(array['owner', 'manager']));

create or replace function public.place_order(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_count integer := 0;
  order_total numeric(12,2) := 0;
  shipping_fee numeric(12,2) := 0;
  subtotal numeric(12,2) := 0;
  order_id uuid;
  variant_id uuid;
  qty integer;
  product_id uuid;
  tier record;
  unit_price numeric(12,2);
  current_stock integer;
  reserved integer;
  order_no text;
  next_no integer;
  item_title text;
  item_color text;
  item_size text;
  variant_row record;
  customer_name text := coalesce(payload->>'customer_name', '');
  customer_phone text := coalesce(payload->>'customer_phone', '');
  customer_email text := coalesce(payload->>'customer_email', '');
  division text := coalesce(payload->>'division', '');
  district text := coalesce(payload->>'district', '');
  area text := coalesce(payload->>'area', '');
  address_line text := coalesce(payload->>'address_line', '');
  shipping_zone_id uuid := nullif(payload->>'shipping_zone_id', '')::uuid;
  customer_note text := payload->>'customer_note';
  idempotency_key text := payload->>'idempotency_key';
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Invalid checkout payload';
  end if;

  if customer_name = '' or customer_phone = '' then
    raise exception 'Customer name and phone are required';
  end if;

  if idempotency_key is not null and exists (select 1 from public.orders where idempotency_key = idempotency_key) then
    raise exception 'Duplicate order request';
  end if;

  if not jsonb_exists(payload, 'items') then
    raise exception 'Order items are required';
  end if;

  for item in select * from jsonb_array_elements(payload->'items')
  loop
    item_count := item_count + 1;
    variant_id := nullif(item->>'variant_id', '')::uuid;
    qty := coalesce((item->>'qty')::integer, 0);

    if variant_id is null or qty <= 0 then
      raise exception 'Each item requires a valid variant_id and positive quantity';
    end if;

    select v.id, v.product_id, v.stock_qty, v.reserved_qty, p.moq, p.status
      into variant_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and v.is_active = true;

    if variant_row is null then
      raise exception 'Variant not found';
    end if;

    if variant_row.status <> 'published' then
      raise exception 'Variant product is not published';
    end if;

    if qty < variant_row.moq then
      raise exception 'Quantity below MOQ';
    end if;

    select p.unit_price, p.min_qty
      into tier
      from public.price_tiers p
      where p.product_id = variant_row.product_id
        and p.min_qty <= qty
      order by p.min_qty desc
      limit 1;

    if tier is null then
      raise exception 'No valid price tier for quantity';
    end if;

    unit_price := tier.unit_price;
    current_stock := variant_row.stock_qty - variant_row.reserved_qty;
    if variant_row.status = 'published' and current_stock < qty then
      raise exception 'Insufficient stock';
    end if;

    item_title := coalesce(item->>'title', 'Product');
    item_color := item->>'color';
    item_size := item->>'size';

    subtotal := subtotal + (unit_price * qty);
  end loop;

  if item_count = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  shipping_fee := coalesce((payload->>'shipping_fee')::numeric(12,2), 0);
  order_total := subtotal + shipping_fee;

  next_no := coalesce((select max((right(order_no, 4))::int) from public.orders where order_no like 'PBF-%' and created_at >= date_trunc('month', now())), 0) + 1;
  order_no := 'PBF-' || to_char(now(), 'YYMMDD') || '-' || lpad(next_no::text, 4, '0');

  insert into public.orders (
    order_no, type, status, payment_method, payment_status, customer_name, customer_phone,
    customer_email, division, district, area, address_line, shipping_zone_id, subtotal,
    shipping_fee, total, customer_note, idempotency_key
  ) values (
    order_no, coalesce((payload->>'type')::public.order_type, 'retail'),
    'pending',
    coalesce((payload->>'payment_method')::public.payment_method, 'cod'),
    'unpaid',
    customer_name, customer_phone, customer_email, division, district, area, address_line,
    shipping_zone_id, subtotal, shipping_fee, order_total, customer_note, idempotency_key
  ) returning id into order_id;

  for item in select * from jsonb_array_elements(payload->'items')
  loop
    variant_id := nullif(item->>'variant_id', '')::uuid;
    qty := coalesce((item->>'qty')::integer, 0);

    select v.id, v.product_id, v.stock_qty, v.reserved_qty, v.swatch_id, p.title_en into variant_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id;

    select p.unit_price into tier
      from public.price_tiers p
      where p.product_id = variant_row.product_id and p.min_qty <= qty
      order by p.min_qty desc
      limit 1;

    insert into public.order_items (
      order_id, variant_id, title_snapshot, sku_snapshot, color_snapshot, size_snapshot, unit_price, qty, line_total, tier_min_qty, customization
    ) values (
      order_id,
      variant_id,
      coalesce(item->>'title', variant_row.title_en),
      item->>'sku',
      item->>'color',
      item->>'size',
      tier.unit_price,
      qty,
      tier.unit_price * qty,
      variant_row.moq,
      item->'customization'
    );

    update public.product_variants
      set reserved_qty = reserved_qty + qty
      where id = variant_id;

    insert into public.inventory_movements (variant_id, delta, reason, ref_type, ref_id, note, created_by)
    values (variant_id, -qty, 'sale', 'order', order_no, 'Reserved stock for order', null);
  end loop;

  return order_no;
end;
$$;

create policy "Anonymous users can submit quote requests" on public.quote_requests
for insert
with check (true);

create policy "Anonymous users can submit orders via RPC" on public.orders
for insert
with check (false);

create policy "Anonymous users can submit order items via RPC" on public.order_items
for insert
with check (false);

create policy "No anonymous writes to payments" on public.payments
for insert
with check (false);

create policy "No anonymous writes to settings" on public.settings
for update
using (false);

create policy "No anonymous writes to profiles" on public.profiles
for insert
with check (false);
