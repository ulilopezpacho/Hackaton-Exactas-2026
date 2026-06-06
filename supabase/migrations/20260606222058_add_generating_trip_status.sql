alter table public.trips
drop constraint if exists trips_status_check,
add constraint trips_status_check
  check (status in ('planned', 'generating', 'ongoing', 'completed'));
