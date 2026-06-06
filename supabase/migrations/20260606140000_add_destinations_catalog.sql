-- create table if not exists public.destinations
create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  external_id text,
  name text not null,
  country text,
  admin_area text,
  description text,
  location extensions.geography(Point, 4326),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destinations_source_check check (source in ('manual', 'google', 'llm', 'partner')),
  constraint destinations_status_check check (status in ('draft', 'active', 'archived'))
);

-- alter table public.places add column if not exists destination_id
alter table public.places add column if not exists destination_id uuid references public.destinations(id) on delete set null;

-- alter table public.trips add column if not exists destination_id
alter table public.trips add column if not exists destination_id uuid references public.destinations(id) on delete set null;

-- Indices
create index if not exists destinations_owner_id_idx on public.destinations(owner_id);
create index if not exists destinations_location_idx on public.destinations using gist(location);
create index if not exists destinations_status_idx on public.destinations(status);
create index if not exists places_destination_id_idx on public.places(destination_id);
create index if not exists trips_destination_id_idx on public.trips(destination_id);

-- RLS
alter table public.destinations enable row level security;

-- Policies (espejo de places)
drop policy if exists "Authenticated users read active destinations" on public.destinations;
create policy "Authenticated users read active destinations"
on public.destinations
for select
to authenticated
using (status = 'active' or owner_id = (select auth.uid()));

drop policy if exists "Destination owners insert destinations" on public.destinations;
create policy "Destination owners insert destinations"
on public.destinations
for insert
to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Destination owners update destinations" on public.destinations;
create policy "Destination owners update destinations"
on public.destinations
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Destination owners delete destinations" on public.destinations;
create policy "Destination owners delete destinations"
on public.destinations
for delete
to authenticated
using (owner_id = (select auth.uid()));
