-- Remove only the original, explicitly unverified demo pins.
update public.clubs
set lat = null, lng = null
where slug in ('beep', 'molecule')
  and not is_claimed
  and address = 'Agra (address to be verified)'
  and lat = 27.1767 and lng = 78.0081;
