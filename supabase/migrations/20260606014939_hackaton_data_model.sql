create extension if not exists pgcrypto;
create extension if not exists postgis with schema extensions;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interests text[] not null default '{}',
  pace text,
  budget text,
  travel_style_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_pace_check check (
    pace is null or pace in ('relaxed', 'balanced', 'intense')
  ),
  constraint user_preferences_budget_check check (
    budget is null or budget in ('low', 'medium', 'high')
  )
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  starts_on date not null,
  ends_on date not null,
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_check check (starts_on <= ends_on),
  constraint trips_visibility_check check (visibility in ('private', 'unlisted', 'public'))
);

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  status text not null default 'draft',
  itinerary_type text,
  generated_from_itinerary_id uuid references public.itineraries(id) on delete set null,
  generation_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itineraries_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  external_id text,
  name text not null,
  description text,
  category text,
  address text,
  location extensions.geography(Point, 4326),
  default_duration_minutes integer,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_source_check check (source in ('manual', 'google', 'llm', 'partner')),
  constraint places_status_check check (status in ('draft', 'active', 'archived')),
  constraint places_default_duration_check check (
    default_duration_minutes is null or default_duration_minutes > 0
  )
);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  place_id uuid references public.places(id) on delete set null,
  item_type text not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  position integer not null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itinerary_items_type_check check (
    item_type in ('destination', 'place', 'transfer', 'free_slot', 'note', 'recommendation')
  ),
  constraint itinerary_items_time_check check (starts_at < ends_at),
  constraint itinerary_items_position_check check (position >= 0)
);

create table if not exists public.place_promotions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  title text not null,
  description text,
  strategy text,
  discount_percent numeric(5, 2),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_promotions_discount_check check (
    discount_percent is null or discount_percent between 0 and 100
  ),
  constraint place_promotions_time_check check (
    starts_at is null or ends_at is null or starts_at < ends_at
  )
);

create table if not exists public.place_opening_windows (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  day_of_week integer not null,
  opens_at time not null,
  closes_at time not null,
  constraint place_opening_windows_day_check check (day_of_week between 0 and 6),
  constraint place_opening_windows_time_check check (opens_at < closes_at)
);

create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);
create index if not exists trips_owner_id_idx on public.trips(owner_id);
create index if not exists trips_owner_created_at_idx on public.trips(owner_id, created_at desc);
create index if not exists itineraries_trip_id_idx on public.itineraries(trip_id);
create index if not exists itineraries_trip_created_at_idx on public.itineraries(trip_id, created_at desc);
create index if not exists itineraries_generated_from_idx on public.itineraries(generated_from_itinerary_id);
create index if not exists places_owner_id_idx on public.places(owner_id);
create index if not exists places_location_idx on public.places using gist(location);
create index if not exists places_status_idx on public.places(status);
create index if not exists itinerary_items_itinerary_id_idx on public.itinerary_items(itinerary_id);
create index if not exists itinerary_items_itinerary_position_idx on public.itinerary_items(itinerary_id, position);
create index if not exists itinerary_items_place_id_idx on public.itinerary_items(place_id);
create index if not exists place_promotions_place_id_idx on public.place_promotions(place_id);
create index if not exists place_promotions_active_idx on public.place_promotions(place_id, active);
create index if not exists place_opening_windows_place_id_idx on public.place_opening_windows(place_id);

alter table public.user_preferences enable row level security;
alter table public.trips enable row level security;
alter table public.itineraries enable row level security;
alter table public.places enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.place_promotions enable row level security;
alter table public.place_opening_windows enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.user_preferences,
  public.trips,
  public.itineraries,
  public.places,
  public.itinerary_items,
  public.place_promotions,
  public.place_opening_windows
to authenticated;

drop policy if exists "Users manage their preferences" on public.user_preferences;
create policy "Users manage their preferences"
on public.user_preferences
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Trip owners manage trips" on public.trips;
create policy "Trip owners manage trips"
on public.trips
for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Trip owners manage itineraries" on public.itineraries;
create policy "Trip owners manage itineraries"
on public.itineraries
for all
to authenticated
using (
  exists (
    select 1
    from public.trips
    where trips.id = itineraries.trip_id
      and trips.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.trips
    where trips.id = itineraries.trip_id
      and trips.owner_id = (select auth.uid())
  )
);

drop policy if exists "Authenticated users read active places" on public.places;
create policy "Authenticated users read active places"
on public.places
for select
to authenticated
using (status = 'active' or owner_id = (select auth.uid()));

drop policy if exists "Place owners insert places" on public.places;
create policy "Place owners insert places"
on public.places
for insert
to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Place owners update places" on public.places;
create policy "Place owners update places"
on public.places
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "Place owners delete places" on public.places;
create policy "Place owners delete places"
on public.places
for delete
to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "Trip owners manage itinerary items" on public.itinerary_items;
create policy "Trip owners manage itinerary items"
on public.itinerary_items
for all
to authenticated
using (
  exists (
    select 1
    from public.itineraries
    join public.trips on trips.id = itineraries.trip_id
    where itineraries.id = itinerary_items.itinerary_id
      and trips.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.itineraries
    join public.trips on trips.id = itineraries.trip_id
    where itineraries.id = itinerary_items.itinerary_id
      and trips.owner_id = (select auth.uid())
  )
);

drop policy if exists "Authenticated users read active place promotions" on public.place_promotions;
create policy "Authenticated users read active place promotions"
on public.place_promotions
for select
to authenticated
using (
  active
  and exists (
    select 1
    from public.places
    where places.id = place_promotions.place_id
      and places.status = 'active'
  )
);

drop policy if exists "Place owners manage place promotions" on public.place_promotions;
create policy "Place owners manage place promotions"
on public.place_promotions
for all
to authenticated
using (
  exists (
    select 1
    from public.places
    where places.id = place_promotions.place_id
      and places.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.places
    where places.id = place_promotions.place_id
      and places.owner_id = (select auth.uid())
  )
);

drop policy if exists "Authenticated users read active place opening windows" on public.place_opening_windows;
create policy "Authenticated users read active place opening windows"
on public.place_opening_windows
for select
to authenticated
using (
  exists (
    select 1
    from public.places
    where places.id = place_opening_windows.place_id
      and places.status = 'active'
  )
);

drop policy if exists "Place owners manage place opening windows" on public.place_opening_windows;
create policy "Place owners manage place opening windows"
on public.place_opening_windows
for all
to authenticated
using (
  exists (
    select 1
    from public.places
    where places.id = place_opening_windows.place_id
      and places.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.places
    where places.id = place_opening_windows.place_id
      and places.owner_id = (select auth.uid())
  )
);
