begin;

do $$
declare
  seed_owner_id uuid;
  visitor_id uuid;
  first_item_id uuid;
  copied_trip_id uuid;
  active_count integer;
  archived_count integer;
  archived_count_before integer;
  leaf_count integer;
  copied_item_count integer;
  day_one_itinerary_id uuid;
  day_three_itinerary_id uuid;
  current_item_before_replan uuid;
  current_item_after_replan uuid;
begin
  select id
  into seed_owner_id
  from auth.users
  where lower(email) = lower('guidoadleredu@gmail.com')
  limit 1;

  if seed_owner_id is null then
    raise exception 'Seed owner is missing';
  end if;

  select itinerary_items.id
  into first_item_id
  from public.itinerary_items
  join public.itineraries
    on itineraries.id = itinerary_items.itinerary_id
  where itineraries.trip_id = '10000000-0000-4000-8000-000000000001'
    and itineraries.status = 'active'
    and itineraries.day_number = 2
    and itinerary_items.item_type in ('place', 'recommendation')
  order by itinerary_items.position
  limit 1;

  select id
  into day_one_itinerary_id
  from public.itineraries
  where trip_id = '10000000-0000-4000-8000-000000000001'
    and day_number = 1
    and status = 'active';

  select id
  into day_three_itinerary_id
  from public.itineraries
  where trip_id = '10000000-0000-4000-8000-000000000001'
    and day_number = 3
    and status = 'active';

  select count(*)
  into archived_count_before
  from public.itineraries
  where trip_id = '10000000-0000-4000-8000-000000000001'
    and status = 'archived';

  perform set_config('request.jwt.claim.sub', seed_owner_id::text, true);
  set local role authenticated;

  if public.start_trip_travel(
    '10000000-0000-4000-8000-000000000001',
    first_item_id
  ) <> '10000000-0000-4000-8000-000000000001' then
    raise exception 'Owner start should keep the original trip id';
  end if;

  if not exists (
    select 1
    from public.trips
    where id = '10000000-0000-4000-8000-000000000001'
      and status = 'ongoing'
      and current_day_number = 2
      and current_itinerary_item_id = first_item_id
  ) then
    raise exception 'Trip start state was not persisted';
  end if;

  perform public.advance_trip_travel(
    '10000000-0000-4000-8000-000000000001'
  );

  if (
    select current_itinerary_item_id
    from public.trips
    where id = '10000000-0000-4000-8000-000000000001'
  ) = first_item_id then
    raise exception 'Advance did not move to the next navigable point';
  end if;

  select current_itinerary_item_id
  into current_item_before_replan
  from public.trips
  where id = '10000000-0000-4000-8000-000000000001';

  perform public.apply_trip_replan(
    '10000000-0000-4000-8000-000000000001',
    'trim',
    '[]'::jsonb
  );

  select count(*) filter (where status = 'active'),
         count(*) filter (where status = 'archived')
  into active_count, archived_count
  from public.itineraries
  where trip_id = '10000000-0000-4000-8000-000000000001';

  if active_count <> 3 or archived_count <> archived_count_before + 1 then
    raise exception 'Replanning should version only the current itinerary';
  end if;

  if not exists (
    select 1
    from public.itineraries
    where id = day_one_itinerary_id
      and status = 'active'
  ) or not exists (
    select 1
    from public.itineraries
    where id = day_three_itinerary_id
      and status = 'active'
  ) then
    raise exception 'Replanning changed an itinerary from another day';
  end if;

  select current_itinerary_item_id
  into current_item_after_replan
  from public.trips
  where id = '10000000-0000-4000-8000-000000000001';

  if current_item_after_replan = current_item_before_replan then
    raise exception 'Current item was not remapped to the new itinerary version';
  end if;

  perform public.apply_trip_replan(
    '10000000-0000-4000-8000-000000000001',
    'trim',
    '[]'::jsonb
  );

  select count(*) filter (where status = 'active'),
         count(*) filter (where status = 'archived')
  into active_count, archived_count
  from public.itineraries
  where trip_id = '10000000-0000-4000-8000-000000000001';

  select count(*)
  into leaf_count
  from public.itineraries as itinerary
  where itinerary.trip_id = '10000000-0000-4000-8000-000000000001'
    and itinerary.status <> 'draft'
    and not exists (
      select 1
      from public.itineraries as child
      where child.trip_id = itinerary.trip_id
        and child.generated_from_itinerary_id = itinerary.id
    );

  if active_count <> 3
    or archived_count <> archived_count_before + 2
    or leaf_count <> 3 then
    raise exception 'A second replan should expose only the newest leaf per day';
  end if;

  select itinerary_items.id
  into first_item_id
  from public.itinerary_items
  join public.itineraries
    on itineraries.id = itinerary_items.itinerary_id
  where itineraries.trip_id = '10000000-0000-4000-8000-000000000001'
    and itineraries.status = 'active'
    and itinerary_items.item_type in ('place', 'recommendation')
  order by itineraries.day_number, itinerary_items.position
  limit 1;

  reset role;

  select id
  into visitor_id
  from auth.users
  where id <> seed_owner_id
  limit 1;

  if visitor_id is not null then
    perform set_config('request.jwt.claim.sub', visitor_id::text, true);
    set local role authenticated;

    copied_trip_id := public.start_trip_travel(
      '10000000-0000-4000-8000-000000000001',
      first_item_id
    );

    if copied_trip_id = '10000000-0000-4000-8000-000000000001' then
      raise exception 'Visitor start must create a personal copy';
    end if;

    select count(*)
    into copied_item_count
    from public.itinerary_items
    where itinerary_id in (
      select id
      from public.itineraries
      where trip_id = copied_trip_id
        and status = 'active'
    );

    if copied_item_count <> 21 then
      raise exception 'Visitor copy did not preserve all itinerary items';
    end if;
  end if;
end
$$;

rollback;
