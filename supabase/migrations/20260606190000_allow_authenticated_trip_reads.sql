drop policy if exists "Authenticated users read trips" on public.trips;
create policy "Authenticated users read trips"
on public.trips
for select
to authenticated
using (true);

drop policy if exists "Authenticated users read itineraries" on public.itineraries;
create policy "Authenticated users read itineraries"
on public.itineraries
for select
to authenticated
using (true);

drop policy if exists "Authenticated users read itinerary items" on public.itinerary_items;
create policy "Authenticated users read itinerary items"
on public.itinerary_items
for select
to authenticated
using (true);
