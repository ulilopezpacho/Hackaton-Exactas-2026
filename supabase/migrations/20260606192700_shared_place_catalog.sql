-- Migration: Shared Place Catalog
-- Based on docs/shared-catalog-schema.md

-- 1. Destinations updates
-- Add unique constraint on external_id to enable idempotent upserts
alter table public.destinations
  add constraint destinations_external_id_key unique (external_id);

-- 2. Places updates
-- Add columns for Google Places signal and scoring
alter table public.places
  add column primary_type text,
  add column types text[],
  add column summary text,
  add column rating numeric,
  add column user_ratings_total int,
  add column quality_score numeric,
  add column popularity numeric;

-- Add dedup constraint: unique place per destination and external source id
alter table public.places
  add constraint places_destination_id_external_id_key unique (destination_id, external_id);

-- 3. RLS updates for places
-- Allow authenticated users to read all active places (including shared catalog rows where owner_id is null)
drop policy if exists "Authenticated users read active places" on public.places;
create policy "Authenticated users read all active places"
on public.places
for select
to authenticated
using (status = 'active');

-- 4. RLS updates for destinations
-- Allow authenticated users to read all active destinations
drop policy if exists "Authenticated users read active destinations" on public.destinations;
create policy "Authenticated users read all active destinations"
on public.destinations
for select
to authenticated
using (status = 'active');

-- 5. Add indices for scoring and ranking
create index if not exists places_quality_score_idx on public.places(quality_score desc);
create index if not exists places_popularity_idx on public.places(popularity desc);
create index if not exists places_primary_type_idx on public.places(primary_type);
