alter table public.trips
add column if not exists route_customization_prompt text;
