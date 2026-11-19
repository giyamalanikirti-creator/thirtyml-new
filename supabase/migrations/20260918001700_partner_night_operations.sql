create table public.night_operations (
  club_id uuid not null references public.clubs(id) on delete cascade,
  on_date date not null,
  occupancy int not null default 0 check (occupancy between 0 and 10000),
  capacity jsonb not null default '{}',
  primary key (club_id, on_date)
);

create table public.venue_intent (
  club_id uuid not null references public.clubs(id) on delete cascade,
  on_date date not null,
  visit_key uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  primary key (club_id, on_date, visit_key)
);

alter table public.night_operations enable row level security;
alter table public.venue_intent enable row level security;
revoke all on public.night_operations, public.venue_intent from anon, authenticated;
grant select, insert, update, delete on public.night_operations, public.venue_intent to service_role;

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
    (select case when not coalesce(n.is_open, true) or not p.is_active then 0
      else coalesce((ops.capacity ->> p.id::text)::int, p.capacity_per_night) end
     from public.products p
     left join public.nights n on n.club_id = p.club_id and n.on_date = p_date
     left join public.night_operations ops on ops.club_id = p.club_id and ops.on_date = p_date
     where p.id = p_product_id)
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

-- Use the same per-product locks as checkout before changing availability.
create function public.update_night_operations(
  p_club_id uuid, p_date date, p_open boolean, p_occupancy int,
  p_capacity jsonb, p_price jsonb, p_actor uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  product record;
begin
  if not exists (select 1 from public.club_members where club_id = p_club_id
      and user_id = p_actor and removed_at is null and role in ('owner', 'manager'))
  then raise exception 'owner or manager required'; end if;

  for product in select id from public.products where club_id = p_club_id order by id
  loop
    perform pg_advisory_xact_lock(hashtext(product.id::text || ':' || p_date::text));
  end loop;

  if exists (
    select 1 from jsonb_object_keys(coalesce(p_capacity, '{}') || p_price) as keys(id)
    where not exists (select 1 from public.products p where p.id::text = keys.id
      and p.club_id = p_club_id and p.is_active)
  ) then raise exception 'unknown or inactive ticket'; end if;

  if p_open is not null then
    insert into public.nights(club_id, on_date, is_open) values(p_club_id, p_date, p_open)
    on conflict (club_id, on_date) do update set is_open = excluded.is_open;
    insert into public.night_operations(club_id, on_date, occupancy, capacity)
      values(p_club_id, p_date, p_occupancy, p_capacity)
      on conflict (club_id, on_date) do update
        set occupancy = excluded.occupancy, capacity = excluded.capacity;
  end if;

  insert into public.price_overrides(product_id, on_date, price, created_by)
    select key::uuid, p_date, value::bigint, p_actor from jsonb_each_text(p_price)
    on conflict (product_id, on_date) do update set price = excluded.price, created_by = excluded.created_by;
end;
$$;
revoke execute on function public.update_night_operations(uuid, date, boolean, int, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.update_night_operations(uuid, date, boolean, int, jsonb, jsonb, uuid)
  to service_role;

alter table public.venue_intent add column viewed_at timestamptz not null default now();
