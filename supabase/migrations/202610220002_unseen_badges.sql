-- Unseen badges — sidebar Quotes/Orders badges count UNSEEN new quotes and
-- pending orders instead of every row still sitting in those statuses.
--
-- `first_viewed_at` (nullable) is the only new state: NULL means "no staff
-- member has ever opened this record". Opening the detail page calls
-- `mark_seen` once (idempotent, only stamps when NULL), which drops the badge
-- without touching the status workflow at all.
--
-- Admin-created orders (E3 `admin_create_order` / F1 `create_order_bulk`) are
-- written by staff who obviously already know about them, so a BEFORE INSERT
-- trigger stamps every `source = 'admin'` row as seen at creation. Storefront
-- checkout (`place_order`, source 'web') and the public quote form leave it
-- NULL, so those still raise a badge. RLS on both tables is deliberately NOT
-- widened: `mark_seen` is `security definer` and re-checks the staff role
-- internally, mirroring the fulfilment RPCs.

-- ------------------------------------------------------------- columns --
alter table public.quote_requests
  add column if not exists first_viewed_at timestamptz;
alter table public.orders
  add column if not exists first_viewed_at timestamptz;

-- ------------------------------------------------------------ backfill --
-- Rows already past the badge-triggering status are "handled", not unseen —
-- stamp them seen. Rows that are currently new/pending stay NULL so staff
-- still get nudged about them.
update public.quote_requests
  set first_viewed_at = now()
  where status <> 'new' and first_viewed_at is null;

update public.orders
  set first_viewed_at = now()
  where status <> 'pending' and first_viewed_at is null;

-- ------------------------------------------- admin-created orders: born seen --
-- Covers every staff write path (E3 retail walk-in through
-- `create_order_core`, F1 bulk/quote conversion through `create_order_bulk`)
-- without touching their bodies. Web checkout rows (source 'web') and public
-- quote rows keep NULL. Explicit values always win — the trigger only fills
-- the column when the inserter left it NULL.
create or replace function public.orders_admin_created_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source = 'admin' and new.first_viewed_at is null then
    new.first_viewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_admin_created_seen on public.orders;
create trigger orders_admin_created_seen
  before insert on public.orders
  for each row execute function public.orders_admin_created_seen();

-- ----------------------------------------------------------- mark_seen --
create or replace function public.mark_seen(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The definer bypasses RLS, so the staff check lives here (same roles that
  -- can read quote_requests / orders).
  if not public.has_role(array['owner', 'manager', 'sales']) then
    raise exception 'not_allowed';
  end if;

  if p_kind = 'quote' then
    update public.quote_requests
      set first_viewed_at = now()
      where id = p_id and first_viewed_at is null;
  elsif p_kind = 'order' then
    update public.orders
      set first_viewed_at = now()
      where id = p_id and first_viewed_at is null;
  else
    raise exception 'unknown_kind';
  end if;
end;
$$;

-- Staff reach it through the Postgres role; the function refuses anything but
-- owner/manager/sales via has_role(). anon never executes it.
revoke all on function public.mark_seen(text, uuid) from public, anon;
grant execute on function public.mark_seen(text, uuid) to authenticated;
