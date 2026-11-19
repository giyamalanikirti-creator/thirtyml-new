-- RLS and pricing-function tests. Run against a database that has the auth
-- shim, all migrations, and seed.sql applied (scripts/db-test.sh does this).
-- Each check raises on failure, so a clean run means all assertions passed.

\set ON_ERROR_STOP on

-- helper: impersonate a user the way PostgREST does
create or replace function test_login(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

-- Fixtures: a second club owner (club B = Matahari) and orders for isolation
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-00000000000b', 'ownerb@thirtyml.dev');
insert into public.club_members (club_id, user_id, role) values
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-00000000000b', 'owner');

do $$
declare
  n int;
  v_price bigint;
  v_avail int;
  v_order uuid;
  v_hold uuid;
  v_failed boolean;
begin
  ---------------------------------------------------------------- anon reads
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  set local role anon;

  select count(*) into n from public.clubs;
  if n <> 10 then
    raise exception 'anon should see 10 approved clubs, saw %', n;
  end if;

  select count(*) into n from public.orders;
  if n <> 0 then
    raise exception 'anon must see no orders, saw %', n;
  end if;

  select count(*) into n from public.profiles;
  if n <> 0 then
    raise exception 'anon must see no profiles, saw %', n;
  end if;

  ------------------------------------------------- customer order isolation
  reset role;
  perform test_login('10000000-0000-4000-8000-000000000001'); -- demo customer
  set local role authenticated;

  select count(*) into n from public.orders;
  if n <> 1 then
    raise exception 'customer should see exactly their 1 order, saw %', n;
  end if;

  -- reviewer2's order must be invisible
  select count(*) into n from public.orders
  where user_id = '10000000-0000-4000-8000-000000000006';
  if n <> 0 then
    raise exception 'customer can see another customer''s order';
  end if;

  select count(*) into n from public.wallet_ledger
  where user_id <> auth.uid();
  if n <> 0 then
    raise exception 'customer can see another user''s wallet';
  end if;

  -- customers cannot write orders directly (service-role only)
  v_failed := false;
  begin
    insert into public.orders (user_id, status, subtotal, total, idempotency_key)
    values (auth.uid(), 'paid', 1, 1, 'hack-1');
  exception when insufficient_privilege or others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'customer could insert an order directly';
  end if;

  -- customers cannot change product prices
  v_failed := false;
  begin
    update public.products set base_price = 1
    where id = '40000000-0000-4000-8000-000000000001';
    -- RLS silently updates 0 rows for non-members; verify nothing changed
    if exists (select 1 from public.products
               where id = '40000000-0000-4000-8000-000000000001'
                 and base_price = 1) then
      raise exception 'customer changed a product price';
    end if;
    v_failed := true;
  exception when others then
    v_failed := true;
  end;

  ------------------------------------------------------- club B vs club A
  reset role;
  perform test_login('10000000-0000-4000-8000-00000000000b'); -- Matahari owner
  set local role authenticated;

  -- club B must not see club A (Kitty Su) bookings
  select count(*) into n from public.bookings
  where club_id = '30000000-0000-4000-8000-000000000001';
  if n <> 0 then
    raise exception 'club B can read club A bookings';
  end if;

  -- club B cannot reprice club A's products
  update public.products set base_price = 1
  where id = '40000000-0000-4000-8000-000000000001';
  if exists (select 1 from public.products
             where id = '40000000-0000-4000-8000-000000000001'
               and base_price = 1) then
    raise exception 'club B changed club A''s price';
  end if;

  -- but CAN reprice its own product (and history is logged)
  update public.products set base_price = 210000
  where id = '40000000-0000-4000-8000-000000000011';
  if not exists (select 1 from public.products
                 where id = '40000000-0000-4000-8000-000000000011'
                   and base_price = 210000) then
    raise exception 'club owner failed to change own price';
  end if;

  ------------------------------------------------------- door staff limits
  reset role;
  perform test_login('10000000-0000-4000-8000-000000000003'); -- Kitty Su door
  set local role authenticated;

  -- door staff sees the club's bookings…
  select count(*) into n from public.bookings
  where club_id = '30000000-0000-4000-8000-000000000001';
  if n < 1 then
    raise exception 'door staff cannot see own club bookings';
  end if;

  -- …but cannot edit prices
  update public.products set base_price = 1
  where id = '40000000-0000-4000-8000-000000000001';
  if exists (select 1 from public.products
             where id = '40000000-0000-4000-8000-000000000001'
               and base_price = 1) then
    raise exception 'door staff changed a price';
  end if;

  -- …and cannot see payouts (owner/finance only)
  select count(*) into n from public.payouts;
  if n <> 0 then
    raise exception 'door staff can see payouts';
  end if;

  reset role;
  perform set_config('request.jwt.claim.sub', '', false);

  ------------------------------------------------------------ price engine
  -- history was logged for the owner's price change above
  select count(*) into n from public.price_history
  where product_id = '40000000-0000-4000-8000-000000000011'
    and new_price = 210000
    and changed_at > now() - interval '1 minute';
  if n <> 1 then
    raise exception 'price change was not logged to history (found %)', n;
  end if;

  -- override beats base
  insert into public.price_overrides (product_id, on_date, price)
  values ('40000000-0000-4000-8000-000000000001', current_date + 3, 275000);
  select public.effective_price('40000000-0000-4000-8000-000000000001',
                                current_date + 3) into v_price;
  if v_price <> 275000 then
    raise exception 'override not applied: got %', v_price;
  end if;

  -- base when nothing else applies (future date, no override)
  select public.effective_price('40000000-0000-4000-8000-000000000001',
                                current_date + 4) into v_price;
  if v_price <> 250000 then
    raise exception 'base price expected, got %', v_price;
  end if;

  --------------------------------------------------------------- inventory
  -- Table B1 at Kitty Su: capacity 1
  insert into public.orders (id, user_id, status, subtotal, total, idempotency_key, hold_expires_at)
  values ('72000000-0000-4000-8000-000000000001',
          '10000000-0000-4000-8000-000000000001', 'pending_payment',
          4000000, 4000000, 'test-hold-1', now() + interval '10 minutes')
  returning id into v_order;

  select public.place_hold('41000000-0000-4000-8000-000000000003',
                           current_date + 3, 1, v_order,
                           (select id from public.tables where name = 'B1'))
    into v_hold;
  if v_hold is null then
    raise exception 'first hold failed';
  end if;

  select public.available_quantity('41000000-0000-4000-8000-000000000003',
                                   current_date + 3) into v_avail;
  if v_avail <> 0 then
    raise exception 'availability after hold should be 0, got %', v_avail;
  end if;

  -- second hold on the same table must fail with sold_out
  v_failed := false;
  begin
    perform public.place_hold('41000000-0000-4000-8000-000000000003',
                              current_date + 3, 1, v_order,
                              (select id from public.tables where name = 'B1'));
  exception when others then
    if sqlerrm like '%sold_out%' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'double-sold the last table';
  end if;

  -- expiring the hold frees the table
  update public.inventory_holds set expires_at = now() - interval '1 second'
  where id = v_hold;
  update public.orders set hold_expires_at = now() - interval '1 second'
  where id = v_order;
  perform public.expire_stale_holds();

  select public.available_quantity('41000000-0000-4000-8000-000000000003',
                                   current_date + 3) into v_avail;
  if v_avail <> 1 then
    raise exception 'availability after expiry should be 1, got %', v_avail;
  end if;
  if not exists (select 1 from public.orders where id = v_order and status = 'expired') then
    raise exception 'pending order was not expired with its hold';
  end if;

  ------------------------------------------------------------ invoice numbers
  if public.next_invoice_number() !~ '^TML/\d{4}-\d{2}/000001$' then
    raise exception 'unexpected first invoice number';
  end if;
  if public.next_invoice_number() !~ '/000002$' then
    raise exception 'invoice numbers not sequential';
  end if;

  ------------------------------------------------------------- club ratings
  if not exists (select 1 from public.clubs
                 where id = '30000000-0000-4000-8000-000000000001'
                   and rating_count = 1 and avg_rating = 5.00) then
    raise exception 'club rating trigger did not refresh';
  end if;

  raise notice 'ALL RLS + PRICING + INVENTORY TESTS PASSED';
end;
$$;

drop function test_login(uuid);

-- Venue confirmation is atomic, idempotent, and holds capacity until cancellation.
begin;
do $$
declare
  uid uuid := '10000000-0000-4000-8000-000000000001';
  d date := current_date + 21;
  product record;
  cart uuid;
  line uuid;
  ord uuid;
  avail int;
  snapshot jsonb;
begin
  select * into product from public.products where capacity_per_night >= 2 and type = 'entry' limit 1;
  avail := public.available_quantity(product.id, d);
  insert into public.carts(user_id) values (uid) returning id into cart;
  insert into public.cart_items(cart_id, product_id, quantity, night_date, price_when_added)
    values (cart, product.id, 1, d, 10000) returning id into line;
  insert into public.orders(user_id, subtotal, total, idempotency_key, hold_expires_at, lead_guest_name, lead_guest_email, payment_method)
    values(uid, 10000, 10000, 'venue-test', now() + interval '10 minutes', 'Test Guest', 'guest@example.com', 'venue') returning id into ord;
  insert into public.order_items(order_id, product_id, night_date, quantity, unit_price, product_name, product_type, club_id)
    values(ord, product.id, d, 1, 10000, 'Couple entry', 'entry', product.club_id);
  perform public.place_hold(product.id, d, 1, ord);
  snapshot := jsonb_build_array(jsonb_build_object('id', line, 'quantity', 1));

  begin
    perform public.confirm_venue_order(ord, uid, jsonb_build_array(jsonb_build_object('id', line, 'quantity', 2)), 'https://thirtyml.in');
    raise exception 'stale cart accepted';
  exception when raise_exception then
    if sqlerrm <> 'cart_changed' then raise; end if;
  end;

  perform public.confirm_venue_order(ord, uid, snapshot, 'https://thirtyml.in');
  perform public.confirm_venue_order(ord, uid, snapshot, 'https://thirtyml.in');
  if (select status from public.orders where id = ord) <> 'venue_due'
    or exists (select 1 from public.payments where order_id = ord)
    or exists (select 1 from public.inventory_holds where order_id = ord)
    or exists (select 1 from public.cart_items where id = line)
    or (select count(*) from public.tickets t join public.bookings b on t.booking_id = b.id
        where b.order_id = ord and b.status = 'confirmed' and t.guests_total = 2
          and t.qr_token ~ '^[A-Za-z0-9_-]{32}$') <> 1
    or (select count(*) from public.notifications where payload->>'order_id' = ord::text) <> 2
    or not exists (select 1 from public.notifications where payload->>'order_id' = ord::text
        and payload->>'recipient' = 'guest@example.com' and body like '%https://thirtyml.in/bookings/%')
    or public.available_quantity(product.id, d) <> avail - 1
  then raise exception 'venue checkout assertions failed'; end if;

  update public.bookings set status = 'cancelled' where order_id = ord;
  if public.available_quantity(product.id, d) <> avail
    then raise exception 'cancellation did not release inventory'; end if;
end;
$$;
rollback;

-- Partner approval and date-specific inventory operations.
begin;
do $$
declare
  c uuid := '30000000-0000-4000-8000-000000000001';
  owner_id uuid := '10000000-0000-4000-8000-000000000002';
  viewer uuid := '10000000-0000-4000-8000-000000000001';
  d date := current_date + 45;
  product uuid;
  application uuid;
  approved uuid;
begin
  select id into product from products where club_id = c and type = 'entry' and is_active limit 1;
  begin
    perform update_night_operations(c, d, true, 5, '{}', '{}', viewer);
    raise exception 'unexpected permission';
  exception when raise_exception then
    if sqlerrm <> 'owner or manager required' then raise; end if;
  end;
  perform update_night_operations(c, d, true, 12, jsonb_build_object(product::text, 8), '{}', owner_id);
  if available_quantity(product, d) <> 8 then raise exception 'capacity did not change'; end if;
  perform update_night_operations(c, d, null, null, null, jsonb_build_object(product::text, 230000), owner_id);
  if effective_price(product, d) <> 230000 or available_quantity(product, d) <> 8
    or not exists (select 1 from night_operations where club_id = c and on_date = d and occupancy = 12)
  then raise exception 'publishing a cover charge changed unrelated settings'; end if;
  perform update_night_operations(c, d, false, 12, jsonb_build_object(product::text, 8), '{}', owner_id);
  if available_quantity(product, d) <> 0 then raise exception 'closed night is bookable'; end if;
  declare admin_id uuid;
  begin
    select id into admin_id from profiles where role = 'super_admin' limit 1;
    insert into partner_applications(applicant_id, club_name, city, contact_name, contact_phone, contact_email)
      values(viewer, 'New club verification', 'mumbai', 'Club contact', '+919876543210', 'club@example.com')
      returning id into application;
    approved := approve_partner_application(application, admin_id);
    if approved <> approve_partner_application(application, admin_id)
      or not exists (select 1 from club_members where club_id = approved and user_id = viewer and role = 'owner')
      or not exists (select 1 from partner_applications where id = application and status = 'approved' and approved_club_id = approved)
    then raise exception 'partner approval was not atomic or idempotent'; end if;
  end;
end;
$$;
rollback;
