alter table public.partner_applications
  add column approved_club_id uuid references public.clubs(id) on delete set null;

create function public.approve_partner_application(p_application uuid, p_actor uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  application public.partner_applications%rowtype;
  city_id uuid;
  club_id uuid;
  club_slug text;
begin
  if not exists (select 1 from public.profiles where id = p_actor
      and role = 'super_admin' and deleted_at is null)
  then raise exception 'admin required'; end if;

  select * into strict application from public.partner_applications
    where id = p_application for update;
  if application.approved_club_id is not null then return application.approved_club_id; end if;
  if application.status not in ('pending', 'needs_info') then
    raise exception 'application is not pending';
  end if;
  if application.applicant_id is null then
    raise exception 'applicant must sign in and submit the application again';
  end if;

  select id into city_id from public.cities where is_active and
    (slug = application.city or lower(name) = lower(application.city))
    order by (slug = application.city) desc limit 1;
  if city_id is null then raise exception 'unsupported city'; end if;

  club_slug := left(trim(both '-' from regexp_replace(lower(application.club_name), '[^a-z0-9]+', '-', 'g')), 60);
  if club_slug = '' then club_slug := 'club'; end if;
  perform pg_advisory_xact_lock(hashtext(club_slug));
  if exists (select 1 from public.clubs where slug = club_slug) then
    club_slug := club_slug || '-' || replace(application.id::text, '-', '');
  end if;

  insert into public.clubs(city_id, slug, name, status, is_claimed, phone)
    values(city_id, club_slug, application.club_name, 'approved', true, application.contact_phone)
    returning id into club_id;
  insert into public.club_members(club_id, user_id, role, invited_by)
    values(club_id, application.applicant_id, 'owner', p_actor);
  update public.partner_applications set status = 'approved', approved_club_id = club_id
    where id = p_application;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
    values(p_actor, 'application.approved', 'partner_application', p_application);

  return club_id;
end;
$$;
revoke execute on function public.approve_partner_application(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_partner_application(uuid, uuid) to service_role;
