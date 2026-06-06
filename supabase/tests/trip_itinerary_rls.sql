begin;

do $$
declare
  seed_owner_id uuid;
  visible_count integer;
begin
  select id
  into seed_owner_id
  from auth.users
  where lower(email) = lower('guidoadleredu@gmail.com')
  limit 1;

  if seed_owner_id is null then
    raise exception 'Seed owner is missing';
  end if;

  perform set_config('request.jwt.claim.sub', seed_owner_id::text, true);
  set local role authenticated;

  select count(*)
  into visible_count
  from public.trips
  where id = '10000000-0000-4000-8000-000000000001';

  if visible_count <> 1 then
    raise exception 'Owner should see the seeded trip';
  end if;

  select count(*)
  into visible_count
  from public.itinerary_items
  where itinerary_id in (
    select id
    from public.itineraries
    where trip_id = '10000000-0000-4000-8000-000000000001'
  );

  if visible_count <> 21 then
    raise exception 'Owner should see all 21 itinerary items';
  end if;

  reset role;
  perform set_config(
    'request.jwt.claim.sub',
    '99999999-9999-4999-8999-999999999999',
    true
  );
  set local role authenticated;

  select count(*)
  into visible_count
  from public.trips
  where id = '10000000-0000-4000-8000-000000000001';

  if visible_count <> 0 then
    raise exception 'A different user must not see the seeded trip';
  end if;
end
$$;

rollback;
