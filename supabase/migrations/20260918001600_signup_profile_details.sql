create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dob date;
  dob_input text := new.raw_user_meta_data ->> 'date_of_birth';
  city_id uuid;
begin
  if dob_input ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      dob := dob_input::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      dob := null;
    end;
  end if;
  if dob > ((now() at time zone 'Asia/Kolkata')::date - interval '18 years') then
    dob := null;
  end if;

  select id into city_id from public.cities
  where slug = new.raw_user_meta_data ->> 'home_city' and is_active;

  insert into public.profiles (id, email, phone, full_name, date_of_birth, home_city_id)
  values (
    new.id,
    new.email,
    new.phone,
    nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 80), ''),
    dob,
    city_id
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
