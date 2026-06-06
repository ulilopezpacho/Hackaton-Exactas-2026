alter table public.itineraries
add column if not exists day_number integer not null default 1;

alter table public.itineraries
add constraint itineraries_day_number_check check (day_number >= 1);

create unique index if not exists itineraries_trip_day_type_idx
on public.itineraries(trip_id, day_number, coalesce(itinerary_type, 'default'));
