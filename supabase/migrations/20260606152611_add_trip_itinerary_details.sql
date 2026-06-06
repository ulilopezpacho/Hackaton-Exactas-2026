alter table public.trips
add column if not exists country text not null default '',
add column if not exists timezone text not null default 'UTC';

alter table public.itineraries
add column if not exists title text not null default '';

create or replace function public.get_trip_place_coordinates(target_trip_id uuid)
returns table (
  itinerary_item_id uuid,
  place_id uuid,
  latitude double precision,
  longitude double precision
)
set search_path = ''
language sql
security invoker
as $$
  select
    itinerary_items.id as itinerary_item_id,
    places.id as place_id,
    extensions.st_y(places.location::extensions.geometry) as latitude,
    extensions.st_x(places.location::extensions.geometry) as longitude
  from public.itinerary_items
  join public.itineraries
    on itineraries.id = itinerary_items.itinerary_id
  join public.places
    on places.id = itinerary_items.place_id
  where itineraries.trip_id = target_trip_id
    and places.location is not null;
$$;

revoke all on function public.get_trip_place_coordinates(uuid) from public;
grant execute on function public.get_trip_place_coordinates(uuid) to authenticated;
