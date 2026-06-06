-- This seed is intentionally self-contained so it can be pasted directly into
-- the Supabase SQL Editor after the base data-model migration.
alter table public.trips
add column if not exists country text not null default '',
add column if not exists timezone text not null default 'UTC';

alter table public.itineraries
add column if not exists day_number integer not null default 1,
add column if not exists title text not null default '';

create or replace function public.get_trip_place_coordinates(target_trip_id uuid)
returns table (
  itinerary_item_id uuid,
  place_id uuid,
  latitude double precision,
  longitude double precision
)
set search_path = ''
language sql
security invoker
as $function$
  select
    itinerary_items.id as itinerary_item_id,
    places.id as place_id,
    extensions.st_y(places.location::extensions.geometry) as latitude,
    extensions.st_x(places.location::extensions.geometry) as longitude
  from public.itinerary_items
  join public.itineraries
    on itineraries.id = itinerary_items.itinerary_id
  join public.places
    on places.id = itinerary_items.place_id
  where itineraries.trip_id = target_trip_id
    and places.location is not null;
$function$;

revoke all on function public.get_trip_place_coordinates(uuid) from public;
grant execute on function public.get_trip_place_coordinates(uuid) to authenticated;

do $$
declare
  seed_owner_id uuid;
begin
  select id
  into seed_owner_id
  from auth.users
  where lower(email) = lower('guidoadleredu@gmail.com')
  limit 1;

  if seed_owner_id is null then
    raise exception 'Seed user guidoadleredu@gmail.com does not exist in auth.users';
  end if;

  insert into public.trips (
    id, owner_id, title, country, timezone, starts_on, ends_on, visibility
  )
  values (
    '10000000-0000-4000-8000-000000000001',
    seed_owner_id,
    'Madrid',
    'España',
    'Europe/Madrid',
    '2026-06-12',
    '2026-06-14',
    'private'
  )
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    title = excluded.title,
    country = excluded.country,
    timezone = excluded.timezone,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    visibility = excluded.visibility,
    updated_at = now();

  insert into public.itineraries (
    id, trip_id, status, itinerary_type, day_number, title, generation_prompt
  )
  values
    (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'active',
      'balanced',
      1,
      'Madrid de los Austrias',
      'Historia, clásicos y arte con ritmo equilibrado.'
    ),
    (
      '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      'active',
      'balanced',
      2,
      'Arte y atardecer',
      'Museos, barrios caminables y vistas al final del día.'
    ),
    (
      '20000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'active',
      'balanced',
      3,
      'Antes del vuelo',
      'Una mañana corta y una recomendación gastronómica.'
    )
  on conflict (id) do update set
    status = excluded.status,
    itinerary_type = excluded.itinerary_type,
    day_number = excluded.day_number,
    title = excluded.title,
    generation_prompt = excluded.generation_prompt,
    updated_at = now();

  insert into public.places (
    id, owner_id, source, external_id, name, description, category, address,
    location, default_duration_minutes, status
  )
  values
    ('30000000-0000-4000-8000-000000000001', seed_owner_id, 'manual', 'rumbo-palacio-real', 'Palacio Real', 'El palacio más grande de Europa occidental.', 'Historia', 'C. de Bailén, s/n, Centro, Madrid', extensions.st_point(-3.714312, 40.417955)::extensions.geography, 120, 'active'),
    ('30000000-0000-4000-8000-000000000002', seed_owner_id, 'manual', 'rumbo-plaza-mayor', 'Plaza Mayor', 'Plaza porticada del siglo XVII.', 'Clásico', 'Plaza Mayor, Centro, Madrid', extensions.st_point(-3.707399, 40.415511)::extensions.geography, 60, 'active'),
    ('30000000-0000-4000-8000-000000000003', seed_owner_id, 'manual', 'rumbo-san-miguel', 'Mercado de San Miguel', 'Tapas bajo una estructura histórica de hierro.', 'Gastro', 'Pl. de San Miguel, s/n, Centro, Madrid', extensions.st_point(-3.708973, 40.415397)::extensions.geography, 60, 'active'),
    ('30000000-0000-4000-8000-000000000004', seed_owner_id, 'manual', 'rumbo-prado', 'Museo del Prado', 'Velázquez, Goya y El Bosco.', 'Arte', 'C. de Ruiz de Alarcón, 23, Retiro, Madrid', extensions.st_point(-3.692127, 40.413782)::extensions.geography, 180, 'active'),
    ('30000000-0000-4000-8000-000000000005', seed_owner_id, 'manual', 'rumbo-retiro', 'Parque del Retiro', 'El jardín en el corazón de Madrid.', 'Aire libre', 'Plaza de la Independencia, 7, Retiro, Madrid', extensions.st_point(-3.684649, 40.415260)::extensions.geography, 90, 'active'),
    ('30000000-0000-4000-8000-000000000006', seed_owner_id, 'manual', 'rumbo-reina-sofia', 'Museo Reina Sofía', 'Arte moderno y el Guernica de Picasso.', 'Arte', 'C. de Sta. Isabel, 52, Centro, Madrid', extensions.st_point(-3.694431, 40.407912)::extensions.geography, 120, 'active'),
    ('30000000-0000-4000-8000-000000000007', seed_owner_id, 'manual', 'rumbo-letras', 'Barrio de las Letras', 'Calles de Cervantes y Lope de Vega.', 'Paseo', 'Barrio de las Letras, Centro, Madrid', extensions.st_point(-3.697644, 40.414041)::extensions.geography, 90, 'active'),
    ('30000000-0000-4000-8000-000000000008', seed_owner_id, 'manual', 'rumbo-debod', 'Templo de Debod', 'Templo egipcio con vistas al atardecer.', 'Vistas', 'C. de Ferraz, 1, Moncloa, Madrid', extensions.st_point(-3.717769, 40.424021)::extensions.geography, 60, 'active'),
    ('30000000-0000-4000-8000-000000000009', seed_owner_id, 'manual', 'rumbo-gran-via', 'Gran Vía', 'La avenida que nunca duerme.', 'Paseo', 'Gran Vía, Centro, Madrid', extensions.st_point(-3.701807, 40.420043)::extensions.geography, 60, 'active'),
    ('30000000-0000-4000-8000-000000000010', seed_owner_id, 'manual', 'rumbo-bernabeu', 'Estadio Santiago Bernabéu', 'Tour por el estadio del Real Madrid.', 'Fútbol', 'Av. de Concha Espina, 1, Chamartín, Madrid', extensions.st_point(-3.688344, 40.453054)::extensions.geography, 120, 'active')
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    address = excluded.address,
    location = excluded.location,
    default_duration_minutes = excluded.default_duration_minutes,
    status = excluded.status,
    updated_at = now();

  insert into public.itinerary_items (
    id, itinerary_id, place_id, item_type, title, description,
    starts_at, ends_at, position, locked
  )
  values
    ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'place', 'Palacio Real', null, '2026-06-12 10:00:00+02', '2026-06-12 12:00:00+02', 0, true),
    ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', null, 'transfer', '8 min a pie', 'Por Plaza de Oriente', '2026-06-12 12:00:00+02', '2026-06-12 12:08:00+02', 1, false),
    ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'place', 'Plaza Mayor', null, '2026-06-12 12:10:00+02', '2026-06-12 13:10:00+02', 2, true),
    ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', null, 'transfer', '4 min a pie', null, '2026-06-12 13:10:00+02', '2026-06-12 13:14:00+02', 3, false),
    ('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'place', 'Mercado de San Miguel', 'Almuerzo', '2026-06-12 13:15:00+02', '2026-06-12 14:15:00+02', 4, true),
    ('40000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', null, 'transfer', '18 min a pie', 'Por Paseo del Prado', '2026-06-12 14:15:00+02', '2026-06-12 14:33:00+02', 5, false),
    ('40000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'place', 'Museo del Prado', null, '2026-06-12 15:00:00+02', '2026-06-12 18:00:00+02', 6, true),
    ('40000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', null, 'transfer', '6 min a pie', null, '2026-06-12 18:00:00+02', '2026-06-12 18:06:00+02', 7, false),
    ('40000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', 'place', 'Parque del Retiro', null, '2026-06-12 18:10:00+02', '2026-06-12 19:40:00+02', 8, true),
    ('40000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', null, 'recommendation', 'Tablao flamenco en Cardamomo', 'Tenés la noche libre. Quedan entradas para la sesión de las 21:00.', '2026-06-12 20:00:00+02', '2026-06-12 21:30:00+02', 9, false),
    ('40000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006', 'place', 'Museo Reina Sofía', null, '2026-06-13 10:30:00+02', '2026-06-13 12:30:00+02', 0, true),
    ('40000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000002', null, 'transfer', '12 min a pie', null, '2026-06-13 12:30:00+02', '2026-06-13 12:42:00+02', 1, false),
    ('40000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000007', 'place', 'Barrio de las Letras', 'Comida de tapas', '2026-06-13 12:45:00+02', '2026-06-13 14:15:00+02', 2, true),
    ('40000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000002', null, 'transfer', '15 min en metro', null, '2026-06-13 14:15:00+02', '2026-06-13 14:30:00+02', 3, false),
    ('40000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000008', 'place', 'Templo de Debod', null, '2026-06-13 17:30:00+02', '2026-06-13 18:30:00+02', 4, true),
    ('40000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000002', null, 'recommendation', 'Rooftop del Círculo de Bellas Artes', 'Hueco antes de la cena: uno de los mejores atardeceres de Madrid.', '2026-06-13 19:00:00+02', '2026-06-13 19:45:00+02', 5, false),
    ('40000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000002', null, 'transfer', '10 min a pie', null, '2026-06-13 19:45:00+02', '2026-06-13 19:55:00+02', 6, false),
    ('40000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000009', 'place', 'Gran Vía', null, '2026-06-13 20:00:00+02', '2026-06-13 21:00:00+02', 7, true),
    ('40000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000010', 'place', 'Estadio Santiago Bernabéu', null, '2026-06-14 11:00:00+02', '2026-06-14 13:00:00+02', 0, true),
    ('40000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000003', null, 'transfer', '20 min en metro', null, '2026-06-14 13:00:00+02', '2026-06-14 13:20:00+02', 1, false),
    ('40000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000003', null, 'recommendation', 'Vermut en el Mercado de la Cebada', 'Te queda media tarde libre antes de salir al aeropuerto.', '2026-06-14 13:30:00+02', '2026-06-14 15:00:00+02', 2, false)
  on conflict (id) do update set
    itinerary_id = excluded.itinerary_id,
    place_id = excluded.place_id,
    item_type = excluded.item_type,
    title = excluded.title,
    description = excluded.description,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    position = excluded.position,
    locked = excluded.locked,
    updated_at = now();
end
$$;
