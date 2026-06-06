import "server-only";

import { cache } from "react";

import { createClient } from "@/utils/supabase/server";

export type TripPlaceDto = {
  address: string | null;
  category: string | null;
  defaultDurationMinutes: number | null;
  description: string | null;
  id: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
};

export type ItineraryItemDto = {
  description: string | null;
  durationMinutes: number;
  endTime: string;
  id: string;
  itemType: string;
  place: TripPlaceDto | null;
  position: number;
  startTime: string;
  title: string;
};

export type ItineraryDayDto = {
  date: string;
  dateLabel: string;
  dayNumber: number;
  id: string;
  items: ItineraryItemDto[];
  title: string;
};

export type TripDto = {
  country: string;
  dayCount: number;
  days: ItineraryDayDto[];
  endsOn: string;
  id: string;
  placeCount: number;
  startsOn: string;
  timezone: string;
  title: string;
};

function formatDateLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: timezone,
    weekday: "short",
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function differenceInCalendarDays(startsOn: string, endsOn: string) {
  const start = Date.parse(`${startsOn}T00:00:00Z`);
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export const getTrip = cache(async (tripId: string): Promise<TripDto | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id,title,country,timezone,starts_on,ends_on")
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (tripError) {
    throw tripError;
  }

  if (!trip) {
    return null;
  }

  const { data: itineraries, error: itineraryError } = await supabase
    .from("itineraries")
    .select("id,day_number,title,status")
    .eq("trip_id", trip.id)
    .eq("status", "active")
    .order("day_number");

  if (itineraryError) {
    throw itineraryError;
  }

  const itineraryIds = itineraries.map((itinerary) => itinerary.id);
  const itemRequest = itineraryIds.length
    ? supabase
        .from("itinerary_items")
        .select(
          "id,itinerary_id,place_id,item_type,title,description,starts_at,ends_at,position",
        )
        .in("itinerary_id", itineraryIds)
        .order("position")
    : Promise.resolve({ data: [], error: null });

  const [itemsResult, coordinatesResult] = await Promise.all([
    itemRequest,
    supabase.rpc("get_trip_place_coordinates", {
      target_trip_id: trip.id,
    }),
  ]);

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  if (coordinatesResult.error) {
    throw coordinatesResult.error;
  }

  const items = itemsResult.data ?? [];
  const placeIds = Array.from(
    new Set(
      items
        .map((item) => item.place_id)
        .filter((placeId): placeId is string => Boolean(placeId)),
    ),
  );
  const placesResult = placeIds.length
    ? await supabase
        .from("places")
        .select(
          "id,name,description,category,address,default_duration_minutes",
        )
        .in("id", placeIds)
    : { data: [], error: null };

  if (placesResult.error) {
    throw placesResult.error;
  }

  const coordinateByItem = new Map(
    (coordinatesResult.data ?? []).map((coordinate) => [
      coordinate.itinerary_item_id,
      coordinate,
    ]),
  );
  const placeById = new Map(
    (placesResult.data ?? []).map((place) => [place.id, place]),
  );
  const itemByItinerary = new Map<string, ItineraryItemDto[]>();

  for (const item of items) {
    const place = item.place_id ? placeById.get(item.place_id) : null;
    const coordinate = coordinateByItem.get(item.id);
    const startsAt = new Date(item.starts_at);
    const endsAt = new Date(item.ends_at);
    const itineraryItems = itemByItinerary.get(item.itinerary_id) ?? [];

    itineraryItems.push({
      description: item.description,
      durationMinutes: Math.max(
        1,
        Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000),
      ),
      endTime: formatTime(item.ends_at, trip.timezone),
      id: item.id,
      itemType: item.item_type,
      place: place
        ? {
            address: place.address,
            category: place.category,
            defaultDurationMinutes: place.default_duration_minutes,
            description: place.description,
            id: place.id,
            latitude: coordinate?.latitude ?? null,
            longitude: coordinate?.longitude ?? null,
            name: place.name,
          }
        : null,
      position: item.position,
      startTime: formatTime(item.starts_at, trip.timezone),
      title: item.title,
    });
    itemByItinerary.set(item.itinerary_id, itineraryItems);
  }

  const days = itineraries.map((itinerary) => {
    const date = new Date(`${trip.starts_on}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + itinerary.day_number - 1);
    const dateValue = date.toISOString().slice(0, 10);

    return {
      date: dateValue,
      dateLabel: formatDateLabel(dateValue, trip.timezone),
      dayNumber: itinerary.day_number,
      id: itinerary.id,
      items: itemByItinerary.get(itinerary.id) ?? [],
      title: itinerary.title,
    };
  });

  return {
    country: trip.country,
    dayCount: differenceInCalendarDays(trip.starts_on, trip.ends_on),
    days,
    endsOn: trip.ends_on,
    id: trip.id,
    placeCount: placeIds.length,
    startsOn: trip.starts_on,
    timezone: trip.timezone,
    title: trip.title,
  };
});
