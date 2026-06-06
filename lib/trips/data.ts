import "server-only";

import { cache } from "react";

import { selectCurrentItineraryLeaves } from "@/lib/trips/itinerary-versions";
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
  endsAt: string;
  endTime: string;
  id: string;
  itemType: string;
  place: TripPlaceDto | null;
  position: number;
  startsAt: string;
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
  isOwner: boolean;
  copiedFromTripId: string | null;
  currentDayNumber: number | null;
  currentItineraryItemId: string | null;
  placeCount: number;
  startsOn: string;
  timezone: string;
  title: string;
  travelCompletedAt: string | null;
  travelStartedAt: string | null;
  travelStatus: "planned" | "ongoing" | "completed";
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

  let { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id,owner_id,title,country,timezone,starts_on,ends_on,status,copied_from_trip_id,current_day_number,current_itinerary_item_id,travel_started_at,travel_completed_at",
    )
    .eq("id", tripId)
    .maybeSingle();

  if (tripError?.code === "42703") {
    const fallbackResult = await supabase
      .from("trips")
      .select("id,owner_id,title,country,timezone,starts_on,ends_on")
      .eq("id", tripId)
      .maybeSingle();

    tripError = fallbackResult.error;
    trip = fallbackResult.data
      ? {
          ...fallbackResult.data,
          copied_from_trip_id: null,
          current_day_number: null,
          current_itinerary_item_id: null,
          status: "planned",
          travel_completed_at: null,
          travel_started_at: null,
        }
      : null;
  }

  if (tripError) {
    throw tripError;
  }

  if (!trip) {
    return null;
  }

  const { data: itineraryVersions, error: itineraryError } = await supabase
    .from("itineraries")
    .select(
      "id,day_number,title,status,itinerary_type,generated_from_itinerary_id,created_at",
    )
    .eq("trip_id", trip.id)
    .order("day_number");

  if (itineraryError) {
    throw itineraryError;
  }

  const itineraries = selectCurrentItineraryLeaves(itineraryVersions);
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
      endsAt: item.ends_at,
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
      startsAt: item.starts_at,
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
    isOwner: trip.owner_id === user.id,
    copiedFromTripId: trip.copied_from_trip_id,
    currentDayNumber: trip.current_day_number,
    currentItineraryItemId: trip.current_itinerary_item_id,
    placeCount: placeIds.length,
    startsOn: trip.starts_on,
    timezone: trip.timezone,
    title: trip.title,
    travelCompletedAt: trip.travel_completed_at,
    travelStartedAt: trip.travel_started_at,
    travelStatus: trip.status as TripDto["travelStatus"],
  };
});
