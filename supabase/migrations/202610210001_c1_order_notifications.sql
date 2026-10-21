-- Plan 15.2 C1 — new-order notifications share the order transaction.
--
-- A row in `orders` (web checkout via place_order, or a staff order via
-- admin_create_order) enqueues two outbox rows in the SAME transaction:
--   * admin_alert / template new_order — the topbar bell (pending = unread)
--   * email / template new_order — to settings.company.email, left pending
--     for the scheduled sender. The sender is the app cron (Resend is HTTP);
--     this migration only claims a batch so two workers cannot double-send.
--
-- Idempotent replays do not insert a second order row, so they do not
-- enqueue again. A raised error before the insert rolls the notifications
-- back with the order. The payload stores the order id, number, source,
-- channel, customer name and total — never the phone or the address.

create or replace function public.enqueue_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'order_id', new.id,
    'order_no', new.order_no,
    'source', new.source,
    'channel', new.channel,
    'customer_name', new.customer_name,
    'total', new.total
  );

  insert into public.notifications (
    channel, recipient, template, payload, status, attempts
  )
  values (
    'admin_alert', 'admin', 'new_order', v_payload, 'pending', 0
  );

  select nullif(btrim(s.value ->> 'email'), '')
    into v_email
    from public.settings as s
    where s.key = 'company';

  if v_email is not null then
    insert into public.notifications (
      channel, recipient, template, payload, status, attempts
    )
    values (
      'email', v_email, 'new_order', v_payload, 'pending', 0
    );
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_order_notifications() from public, anon, authenticated;

drop trigger if exists orders_enqueue_notifications on public.orders;
create trigger orders_enqueue_notifications
  after insert on public.orders
  for each row
  execute function public.enqueue_order_notifications();

-- Claim a batch of pending order emails and bump `attempts` before the HTTP
-- send. A crash after the claim leaves the row pending, so the next run
-- retries. `skip locked` lets two cron ticks run without sending one row
-- twice. Five attempts is the cap the sender treats as `failed`.
create or replace function public.claim_pending_emails(p_limit integer default 20)
returns setof public.notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_claim_limit';
  end if;

  return query
  with picked as (
    select q.id
      from public.notifications as q
      where q.channel = 'email'
        and q.template = 'new_order'
        and q.status = 'pending'
        and q.attempts < 5
      order by q.created_at
      limit p_limit
      for update skip locked
  )
  update public.notifications as n
    set attempts = n.attempts + 1
    from picked
    where n.id = picked.id
    returning n.*;
end;
$$;

revoke all on function public.claim_pending_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_emails(integer) to service_role;
