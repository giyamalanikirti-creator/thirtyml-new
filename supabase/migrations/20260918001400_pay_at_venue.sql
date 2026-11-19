alter table public.orders add column payment_method text not null default 'online'
  check (payment_method in ('online', 'venue'));

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status in ('pending_payment', 'venue_due', 'paid', 'failed', 'expired',
             'cancelled', 'refunded', 'partially_refunded')
);

-- PostgreSQL supports base64, so translate it to the URL-safe alphabet.
alter table public.tickets alter column qr_token set default
  translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_');

-- Available quantity = capacity − confirmed order items − unexpired holds.
create or replace function public.available_quantity(
  p_product_id uuid,
  p_date date
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    (select capacity_per_night from public.products where id = p_product_id)
    - coalesce((
        select sum(oi.quantity)
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.product_id = p_product_id
          and oi.night_date = p_date
          and (
            o.status in ('paid', 'partially_refunded')
            or (o.status = 'venue_due' and exists (
              select 1 from public.bookings b
              where b.order_id = o.id and b.club_id = oi.club_id
                and b.night_date = oi.night_date and b.status <> 'cancelled'
            ))
          )
      ), 0)
    - coalesce((
        select sum(h.quantity)
        from public.inventory_holds h
        where h.product_id = p_product_id
          and h.night_date = p_date
          and h.expires_at > now()
      ), 0)
  )::int;
$$;

-- Atomically place a hold, preventing overselling under concurrency.
-- Serialises per product+night via advisory xact lock, re-checks
-- availability inside the lock, then inserts the hold. Returns the hold id
-- or raises 'sold_out'.
create or replace function public.place_hold(
  p_product_id uuid,
  p_date date,
  p_quantity int,
  p_order_id uuid,
  p_table_id uuid default null,
  p_hold_minutes int default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available int;
  v_hold_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  -- One lock per product+night: concurrent checkouts for the same inventory
  -- queue here instead of double-selling the last ticket.
  perform pg_advisory_xact_lock(
    hashtext(p_product_id::text || ':' || p_date::text)
  );

  -- Tables are exclusive: any active hold or confirmed booking blocks the table.
  if p_table_id is not null then
    if exists (
      select 1 from public.inventory_holds h
      where h.table_id = p_table_id
        and h.night_date = p_date
        and h.expires_at > now()
    ) or exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.table_id = p_table_id
        and oi.night_date = p_date
        and (
            o.status in ('paid', 'partially_refunded')
            or (o.status = 'venue_due' and exists (
              select 1 from public.bookings b
              where b.order_id = o.id and b.club_id = oi.club_id
                and b.night_date = oi.night_date and b.status <> 'cancelled'
            ))
          )
    ) then
      raise exception 'sold_out';
    end if;
  end if;

  v_available := public.available_quantity(p_product_id, p_date);
  if v_available < p_quantity then
    raise exception 'sold_out';
  end if;

  insert into public.inventory_holds
    (product_id, night_date, table_id, quantity, order_id, expires_at)
  values
    (p_product_id, p_date, p_table_id, p_quantity,
     p_order_id, now() + make_interval(mins => p_hold_minutes))
  returning id into v_hold_id;

  return v_hold_id;
end;
$$;

-- Convert the checkout's existing holds into confirmed bookings in one transaction.
create function public.confirm_venue_order(
  p_order_id uuid,
  p_user_id uuid,
  p_cart_lines jsonb,
  p_site_url text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_order public.orders;
  v_booking public.bookings;
  v_group record;
  v_removed int;
  v_message text := 'Your reservation is confirmed. Pay at the venue and show your QR ticket.';
begin
  select * into strict v_order from public.orders
    where id = p_order_id and user_id = p_user_id for update;
  if v_order.status = 'venue_due' then return; end if;
  if v_order.status <> 'pending_payment' or v_order.payment_method <> 'venue'
    or v_order.wallet_used <> 0
    or v_order.hold_expires_at is null or v_order.hold_expires_at <= now()
    or exists (select 1 from public.payments where order_id = p_order_id)
    or not exists (select 1 from public.order_items where order_id = p_order_id)
    or exists (
      select 1 from public.order_items oi
      where oi.order_id = p_order_id and not exists (
        select 1 from public.inventory_holds h
        where h.order_id = oi.order_id and h.product_id = oi.product_id
          and h.night_date = oi.night_date and h.quantity = oi.quantity
          and h.table_id is not distinct from oi.table_id and h.expires_at > now()
      )
    )
  then
    raise exception 'venue_order_unavailable';
  end if;

  delete from public.cart_items ci
    using public.carts c, jsonb_to_recordset(p_cart_lines) as snapshot(id uuid, quantity int)
    where ci.cart_id = c.id and c.user_id = p_user_id
      and ci.id = snapshot.id and ci.quantity = snapshot.quantity and not ci.saved_for_later;
  get diagnostics v_removed = row_count;
  if v_removed = 0 or v_removed <> jsonb_array_length(p_cart_lines) then
    raise exception 'cart_changed';
  end if;

  update public.orders set status = 'venue_due', hold_expires_at = null where id = p_order_id;

  for v_group in
    select oi.club_id, oi.night_date, c.name,
      sum(oi.quantity * case
        when oi.product_name ilike '%couple%' then 2
        when oi.product_name ilike '%group of 4%' then 4
        else 1 end)::int as guests
    from public.order_items oi join public.clubs c on c.id = oi.club_id
    where oi.order_id = p_order_id
    group by oi.club_id, oi.night_date, c.name
    order by oi.night_date, c.name
  loop
    insert into public.bookings (order_id, user_id, club_id, night_date, status, guest_count)
      values (p_order_id, p_user_id, v_group.club_id, v_group.night_date, 'confirmed', v_group.guests)
      returning * into v_booking;

    insert into public.booking_guests (booking_id, full_name, is_lead)
      values (v_booking.id, v_order.lead_guest_name, true);
    insert into public.tickets (booking_id, guests_total)
      values (v_booking.id, v_group.guests);

    v_message := v_message || E'\n\n' || v_group.name || ' · ' || v_group.night_date
      || ' · Code ' || v_booking.booking_code
      || E'\n' || p_site_url || '/bookings/' || v_booking.id;
  end loop;

  if v_order.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
      values (v_order.coupon_id, p_user_id, p_order_id, v_order.discount);
  end if;

  delete from public.inventory_holds where order_id = p_order_id;

  insert into public.notifications (user_id, category, channel, title, body, payload)
    values
      (p_user_id, 'booking_confirmed', 'in_app', 'Pay at the venue · Booking confirmed',
       'Pay at the venue and show your QR ticket at the door.', jsonb_build_object('order_id', p_order_id)),
      (p_user_id, 'booking_confirmed', 'email', 'Your ThirtyML QR tickets are ready',
       v_message, jsonb_build_object('order_id', p_order_id, 'recipient', v_order.lead_guest_email));
end;
$$;

revoke execute on function public.confirm_venue_order(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.confirm_venue_order(uuid, uuid, jsonb, text) to service_role;
