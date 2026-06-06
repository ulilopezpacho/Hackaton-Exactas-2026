-- Migration: Shared Place Catalog RLS
-- Allows authenticated users to upsert catalog entries (owner_id is null)

-- 1. Places RLS updates
-- Allow upserting global catalog places (owner_id is null)
drop policy if exists "Place owners insert places" on public.places;
create policy "Users and system insert places"
on public.places for insert to authenticated
with check (owner_id = (select auth.uid()) or owner_id is null);

drop policy if exists "Place owners update places" on public.places;
create policy "Users and system update places"
on public.places for update to authenticated
using (owner_id = (select auth.uid()) or owner_id is null)
with check (owner_id = (select auth.uid()) or owner_id is null);

-- 2. Destinations RLS updates
-- Allow upserting global catalog destinations (owner_id is null)
drop policy if exists "Destination owners insert destinations" on public.destinations;
create policy "Users and system insert destinations"
on public.destinations for insert to authenticated
with check (owner_id = (select auth.uid()) or owner_id is null);

drop policy if exists "Destination owners update destinations" on public.destinations;
create policy "Users and system update destinations"
on public.destinations for update to authenticated
using (owner_id = (select auth.uid()) or owner_id is null)
with check (owner_id = (select auth.uid()) or owner_id is null);
