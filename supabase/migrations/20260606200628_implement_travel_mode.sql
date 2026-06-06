alter table public.trips
add column if not exists status text not null default 'planned',
add column if not exists copied_from_trip_id uuid references public.trips(id) on delete set null,
add column if not exists current_day_number integer,
add column if not exists current_itinerary_item_id uuid references public.itinerary_items(id) on delete set null,
add column if not exists travel_started_at timestamptz,
add column if not exists travel_completed_at timestamptz;

alter table public.trips
drop constraint if exists trips_status_check,
add constraint trips_status_check
  check (status in ('planned', 'ongoing', 'completed')),
drop constraint if exists trips_current_day_number_check,
add constraint trips_current_day_number_check
  check (current_day_number is null or current_day_number >= 1);

create index if not exists trips_copied_from_trip_id_idx
on public.trips(copied_from_trip_id);

drop index if exists public.itineraries_trip_day_type_idx;
create unique index itineraries_active_trip_day_type_idx
on public.itineraries(trip_id, day_number, coalesce(itinerary_type, 'default'))
where status = 'active';

create or replace function public.start_trip_travel(
  target_trip_id uuid,
  target_item_id uuid
)
returns uuid
set search_path = ''
language plpgsql
security invoker
as $function$
declare
  actor_id uuid := auth.uid();
  source_trip public.trips%rowtype;
  source_item public.itinerary_items%rowtype;
  source_itinerary public.itineraries%rowtype;
  copied_trip_id uuid;
  copied_itinerary_id uuid;
  copied_item_id uuid;
  itinerary_row public.itineraries%rowtype;
  item_row public.itinerary_items%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into source_trip
  from public.trips
  where id = target_trip_id;

  if not found then
    raise exception 'Trip not found';
  end if;

  if source_trip.owner_id = actor_id and source_trip.status = 'ongoing' then
    return source_trip.id;
  end if;

  select item_record, itinerary_record
  into source_item, source_itinerary
  from public.itinerary_items as item_record
  join public.itineraries as itinerary_record
    on itinerary_record.id = item_record.itinerary_id
  where item_record.id = target_item_id
    and itinerary_record.trip_id = source_trip.id
    and itinerary_record.status <> 'draft'
    and not exists (
      select 1
      from public.itineraries as child_itinerary
      where child_itinerary.generated_from_itinerary_id = itinerary_record.id
        and child_itinerary.trip_id = itinerary_record.trip_id
    )
    and item_record.item_type in ('place', 'recommendation');

  if not found then
    raise exception 'The selected item is not a navigable point';
  end if;

  if source_trip.owner_id = actor_id then
    update public.trips
    set
      status = 'ongoing',
      current_day_number = source_itinerary.day_number,
      current_itinerary_item_id = source_item.id,
      travel_started_at = coalesce(travel_started_at, now()),
      travel_completed_at = null,
      updated_at = now()
    where id = source_trip.id;

    return source_trip.id;
  end if;

  insert into public.trips (
    owner_id,
    title,
    country,
    timezone,
    destination_id,
    starts_on,
    ends_on,
    visibility,
    status,
    copied_from_trip_id,
    travel_started_at
  )
  values (
    actor_id,
    source_trip.title,
    source_trip.country,
    source_trip.timezone,
    source_trip.destination_id,
    source_trip.starts_on,
    source_trip.ends_on,
    'private',
    'ongoing',
    coalesce(source_trip.copied_from_trip_id, source_trip.id),
    now()
  )
  returning id into copied_trip_id;

  for itinerary_row in
    select *
    from public.itineraries
    where trip_id = source_trip.id
      and status <> 'draft'
      and not exists (
        select 1
        from public.itineraries as child_itinerary
        where child_itinerary.generated_from_itinerary_id = itineraries.id
          and child_itinerary.trip_id = itineraries.trip_id
      )
    order by day_number
  loop
    insert into public.itineraries (
      trip_id,
      status,
      itinerary_type,
      generated_from_itinerary_id,
      generation_prompt,
      day_number,
      title
    )
    values (
      copied_trip_id,
      'active',
      itinerary_row.itinerary_type,
      itinerary_row.id,
      itinerary_row.generation_prompt,
      itinerary_row.day_number,
      itinerary_row.title
    )
    returning id into copied_itinerary_id;

    for item_row in
      select *
      from public.itinerary_items
      where itinerary_id = itinerary_row.id
      order by position
    loop
      insert into public.itinerary_items (
        itinerary_id,
        place_id,
        item_type,
        title,
        description,
        starts_at,
        ends_at,
        position,
        locked
      )
      values (
        copied_itinerary_id,
        item_row.place_id,
        item_row.item_type,
        item_row.title,
        item_row.description,
        item_row.starts_at,
        item_row.ends_at,
        item_row.position,
        item_row.locked
      )
      returning id into copied_item_id;

      if item_row.id = source_item.id then
        update public.trips
        set
          current_day_number = itinerary_row.day_number,
          current_itinerary_item_id = copied_item_id,
          updated_at = now()
        where id = copied_trip_id;
      end if;
    end loop;
  end loop;

  return copied_trip_id;
end;
$function$;

create or replace function public.advance_trip_travel(target_trip_id uuid)
returns table (
  trip_id uuid,
  status text,
  current_day_number integer,
  current_itinerary_item_id uuid
)
set search_path = ''
language plpgsql
security invoker
as $function$
declare
  actor_id uuid := auth.uid();
  trip_row public.trips%rowtype;
  current_position integer;
  next_day integer;
  next_item_id uuid;
begin
  select *
  into trip_row
  from public.trips
  where id = target_trip_id
    and owner_id = actor_id
  for update;

  if not found then
    raise exception 'Trip not found or not owned by the current user';
  end if;

  if trip_row.status <> 'ongoing' or trip_row.current_itinerary_item_id is null then
    raise exception 'Trip is not ongoing';
  end if;

  select itinerary_items.position
  into current_position
  from public.itinerary_items
  where itinerary_items.id = trip_row.current_itinerary_item_id;

  select itineraries.day_number, itinerary_items.id
  into next_day, next_item_id
  from public.itineraries
  join public.itinerary_items
    on itinerary_items.itinerary_id = itineraries.id
  where itineraries.trip_id = trip_row.id
    and itineraries.status <> 'draft'
    and not exists (
      select 1
      from public.itineraries as child_itinerary
      where child_itinerary.generated_from_itinerary_id = itineraries.id
        and child_itinerary.trip_id = itineraries.trip_id
    )
    and itinerary_items.item_type in ('place', 'recommendation')
    and (
      itineraries.day_number > trip_row.current_day_number
      or (
        itineraries.day_number = trip_row.current_day_number
        and itinerary_items.position > current_position
      )
    )
  order by itineraries.day_number, itinerary_items.position
  limit 1;

  if next_item_id is null then
    update public.trips
    set
      status = 'completed',
      travel_completed_at = now(),
      updated_at = now()
    where id = trip_row.id;
  else
    update public.trips
    set
      current_day_number = next_day,
      current_itinerary_item_id = next_item_id,
      updated_at = now()
    where id = trip_row.id;
  end if;

  return query
  select
    trips.id,
    trips.status,
    trips.current_day_number,
    trips.current_itinerary_item_id
  from public.trips
  where trips.id = trip_row.id;
end;
$function$;

create or replace function public.apply_trip_replan(
  target_trip_id uuid,
  strategy text,
  operations jsonb default '[]'::jsonb
)
returns uuid
set search_path = ''
language plpgsql
security invoker
as $function$
declare
  actor_id uuid := auth.uid();
  trip_row public.trips%rowtype;
  current_item public.itinerary_items%rowtype;
  item_row public.itinerary_items%rowtype;
  new_itinerary_id uuid;
  new_item_id uuid;
  new_current_item_id uuid;
  item_map jsonb := '{}'::jsonb;
  operation jsonb;
  operation_item_id uuid;
  operation_new_item_id uuid;
  operation_duration integer;
  saved_seconds double precision := 0;
  original_seconds double precision;
  reduced_seconds double precision;
  drop_item_id uuid;
  source_itinerary public.itineraries%rowtype;
begin
  if strategy not in ('trim', 'recalculate', 'recommended') then
    raise exception 'Unsupported replanning strategy';
  end if;

  select *
  into trip_row
  from public.trips
  where id = target_trip_id
    and owner_id = actor_id
  for update;

  if not found then
    raise exception 'Trip not found or not owned by the current user';
  end if;

  if trip_row.status <> 'ongoing' or trip_row.current_itinerary_item_id is null then
    raise exception 'Trip is not ongoing';
  end if;

  select *
  into current_item
  from public.itinerary_items
  where id = trip_row.current_itinerary_item_id;

  select itineraries.*
  into source_itinerary
  from public.itineraries
  where itineraries.id = current_item.itinerary_id
    and itineraries.trip_id = trip_row.id
    and itineraries.status <> 'draft'
    and not exists (
      select 1
      from public.itineraries as child_itinerary
      where child_itinerary.generated_from_itinerary_id = itineraries.id
        and child_itinerary.trip_id = itineraries.trip_id
    );

  if not found then
    raise exception 'Current item does not belong to a current itinerary';
  end if;

  update public.itineraries
  set status = 'archived', updated_at = now()
  where id = source_itinerary.id;

  insert into public.itineraries (
    trip_id,
    status,
    itinerary_type,
    generated_from_itinerary_id,
    generation_prompt,
    day_number,
    title
  )
  values (
    trip_row.id,
    'active',
    source_itinerary.itinerary_type,
    source_itinerary.id,
    source_itinerary.generation_prompt,
    source_itinerary.day_number,
    source_itinerary.title
  )
  returning id into new_itinerary_id;

  for item_row in
    select *
    from public.itinerary_items
    where itinerary_id = source_itinerary.id
    order by position
  loop
    insert into public.itinerary_items (
      itinerary_id,
      place_id,
      item_type,
      title,
      description,
      starts_at,
      ends_at,
      position,
      locked
    )
    values (
      new_itinerary_id,
      item_row.place_id,
      item_row.item_type,
      item_row.title,
      item_row.description,
      item_row.starts_at,
      item_row.ends_at,
      item_row.position,
      item_row.locked
    )
    returning id into new_item_id;

    item_map := item_map || jsonb_build_object(item_row.id::text, new_item_id);

    if item_row.id = trip_row.current_itinerary_item_id then
      new_current_item_id := new_item_id;
    end if;
  end loop;

  if new_current_item_id is null then
    raise exception 'Current item could not be remapped';
  end if;

  if strategy = 'trim' then
    saved_seconds := 0;

    for item_row in
      select itinerary_items.*
      from public.itinerary_items
      where itinerary_items.itinerary_id = new_itinerary_id
        and itinerary_items.position > current_item.position
      order by itinerary_items.position
    loop
      update public.itinerary_items
      set
        starts_at = item_row.starts_at - make_interval(secs => saved_seconds),
        ends_at = item_row.ends_at - make_interval(secs => saved_seconds),
        updated_at = now()
      where id = item_row.id;

      if item_row.item_type in ('place', 'recommendation') then
        original_seconds := extract(epoch from (item_row.ends_at - item_row.starts_at));
        reduced_seconds := least(
          original_seconds,
          greatest(1800, round(original_seconds * 0.7))
        );

        update public.itinerary_items
        set
          ends_at = starts_at + make_interval(secs => reduced_seconds),
          updated_at = now()
        where id = item_row.id;

        saved_seconds := saved_seconds + original_seconds - reduced_seconds;
      end if;
    end loop;
  elsif strategy = 'recalculate' then
    select itinerary_items.id
    into drop_item_id
    from public.itinerary_items
    where itinerary_items.itinerary_id = new_itinerary_id
      and itinerary_items.position > current_item.position
      and itinerary_items.item_type in ('place', 'recommendation')
    order by itinerary_items.position desc
    limit 1;

    if drop_item_id is not null then
      delete from public.itinerary_items where id = drop_item_id;
    end if;
  else
    for operation in select value from jsonb_array_elements(operations)
    loop
      operation_item_id := (operation ->> 'itemId')::uuid;
      operation_new_item_id := (item_map ->> operation_item_id::text)::uuid;

      if operation_new_item_id is null then
        raise exception 'Recommended operation references an unknown item';
      end if;

      if operation ->> 'type' = 'remove' then
        if operation_new_item_id = new_current_item_id then
          raise exception 'The current point cannot be removed';
        end if;

        delete from public.itinerary_items where id = operation_new_item_id;
      elsif operation ->> 'type' = 'trim' then
        operation_duration := greatest(30, (operation ->> 'durationMinutes')::integer);

        update public.itinerary_items
        set
          ends_at = starts_at + make_interval(mins => operation_duration),
          updated_at = now()
        where id = operation_new_item_id
          and item_type in ('place', 'recommendation');

        if not found then
          raise exception 'Recommended trim operation is invalid';
        end if;
      else
        raise exception 'Unsupported recommended operation';
      end if;
    end loop;
  end if;

  update public.trips
  set
    current_itinerary_item_id = new_current_item_id,
    updated_at = now()
  where id = trip_row.id;

  return trip_row.id;
end;
$function$;

revoke all on function public.start_trip_travel(uuid, uuid) from public;
revoke all on function public.advance_trip_travel(uuid) from public;
revoke all on function public.apply_trip_replan(uuid, text, jsonb) from public;

grant execute on function public.start_trip_travel(uuid, uuid) to authenticated;
grant execute on function public.advance_trip_travel(uuid) to authenticated;
grant execute on function public.apply_trip_replan(uuid, text, jsonb) to authenticated;
