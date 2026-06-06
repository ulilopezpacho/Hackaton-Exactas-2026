import "server-only";

import { createClient } from "@/utils/supabase/server";
import type { TripOverview, TripsOverview, TripStatus } from "@/lib/trips/overview-types";

type ItineraryOverview = {
  generation_prompt: string | null;
  id: string;
  itinerary_type: string | null;
  status: string;
  trip_id: string;
};

const stripeClasses = [
  "from-[#A9C3D6] to-[#577E96]",
  "from-[#C7D4B2] to-[#6E8C56]",
  "from-[#E7CBA1] to-[#BC8A52]",
  "from-[#D7B5AA] to-[#A6685D]",
];

const itineraryTypeLabels: Record<string, string> = {
  balanced: "Itinerario equilibrado",
  relaxed: "Ritmo tranquilo",
  intense: "Mucho por descubrir",
};

function calendarDay(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function dayCount(startsOn: string, endsOn: string) {
  return Math.round((calendarDay(endsOn) - calendarDay(startsOn)) / 86_400_000) + 1;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

function formatDateRange(startsOn: string, endsOn: string) {
  if (startsOn === endsOn) {
    return formatShortDate(startsOn);
  }

  const start = new Date(`${startsOn}T12:00:00Z`);
  const end = new Date(`${endsOn}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("es-AR", {
    month: "short",
    timeZone: "UTC",
  });

  if (formatter.format(start) === formatter.format(end)) {
    return `${start.getUTCDate()} - ${formatShortDate(endsOn)}`;
  }

  return `${formatShortDate(startsOn)} - ${formatShortDate(endsOn)}`;
}

function tripStatus(
  activeItineraries: ItineraryOverview[],
  endsOn: string,
): TripStatus {
  if (activeItineraries.length === 0) {
    return "draft";
  }

  const today = new Date().toISOString().slice(0, 10);

  return calendarDay(endsOn) < calendarDay(today) ? "completed" : "upcoming";
}

function tripTone(activeItineraries: ItineraryOverview[]) {
  const prompt = activeItineraries.find((itinerary) => itinerary.generation_prompt)?.generation_prompt;

  if (prompt) {
    return prompt.replace(/\.$/, "");
  }

  const itineraryType = activeItineraries.find((itinerary) => itinerary.itinerary_type)?.itinerary_type;

  if (itineraryType && itineraryTypeLabels[itineraryType]) {
    return itineraryTypeLabels[itineraryType];
  }

  return "Listo para seguir armando";
}

function placesLabel(status: TripStatus, placeCount: number, tripDayCount: number) {
  if (status === "completed") {
    return `${tripDayCount} ${tripDayCount === 1 ? "día completo" : "días completos"}`;
  }

  return `${placeCount} ${placeCount === 1 ? "lugar" : "lugares"}`;
}

function sortTrips(trips: TripOverview[]) {
  const statusOrder: Record<TripStatus, number> = {
    upcoming: 0,
    completed: 1,
    draft: 2,
  };

  return trips.toSorted((first, second) => {
    const statusDifference = statusOrder[first.status] - statusOrder[second.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return calendarDay(first.startsOn) - calendarDay(second.startsOn);
  });
}

export async function getTripsOverview(): Promise<TripsOverview> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return {
      recentTrips: [],
      stats: { drafts: 0, places: 0, trips: 0 },
      trips: [],
      upcomingTrip: null,
    };
  }

  const { data: tripRows, error: tripsError } = await supabase
    .from("trips")
    .select("id,title,country,starts_on,ends_on,updated_at")
    .eq("owner_id", user.id)
    .order("starts_on", { ascending: true });

  if (tripsError) {
    throw tripsError;
  }

  const tripIds = tripRows.map((trip) => trip.id);

  if (tripIds.length === 0) {
    return {
      recentTrips: [],
      stats: { drafts: 0, places: 0, trips: 0 },
      trips: [],
      upcomingTrip: null,
    };
  }

  const { data: itineraries, error: itinerariesError } = await supabase
    .from("itineraries")
    .select("id,trip_id,status,itinerary_type,generation_prompt")
    .in("trip_id", tripIds);

  if (itinerariesError) {
    throw itinerariesError;
  }

  const itineraryIds = itineraries.map((itinerary) => itinerary.id);
  const { data: itineraryItems, error: itemsError } = itineraryIds.length
    ? await supabase
        .from("itinerary_items")
        .select("itinerary_id,place_id")
        .in("itinerary_id", itineraryIds)
    : { data: [], error: null };

  if (itemsError) {
    throw itemsError;
  }

  const itinerariesByTrip = new Map<string, ItineraryOverview[]>();

  for (const itinerary of itineraries) {
    const tripItineraries = itinerariesByTrip.get(itinerary.trip_id) ?? [];
    tripItineraries.push(itinerary);
    itinerariesByTrip.set(itinerary.trip_id, tripItineraries);
  }
  const tripIdByItineraryId = new Map(
    itineraries.map((itinerary) => [itinerary.id, itinerary.trip_id]),
  );
  const placeIdsByTrip = new Map<string, Set<string>>();

  for (const item of itineraryItems) {
    if (!item.place_id) {
      continue;
    }

    const tripId = tripIdByItineraryId.get(item.itinerary_id);

    if (!tripId) {
      continue;
    }

    const placeIds = placeIdsByTrip.get(tripId) ?? new Set<string>();
    placeIds.add(item.place_id);
    placeIdsByTrip.set(tripId, placeIds);
  }

  const trips = sortTrips(
    tripRows.map((trip, index) => {
      const activeItineraries = (itinerariesByTrip.get(trip.id) ?? []).filter(
        (itinerary) => itinerary.status === "active",
      );
      const status = tripStatus(activeItineraries, trip.ends_on);
      const tripDayCount = dayCount(trip.starts_on, trip.ends_on);
      const placeCount = placeIdsByTrip.get(trip.id)?.size ?? 0;

      return {
        city: trip.title,
        country: trip.country || "Destino",
        dates: formatDateRange(trip.starts_on, trip.ends_on),
        days: `${tripDayCount} ${tripDayCount === 1 ? "día" : "días"}`,
        href: `/app/trips/${trip.id}`,
        id: trip.id,
        places: placesLabel(status, placeCount, tripDayCount),
        placeCount,
        startsOn: trip.starts_on,
        status,
        stripeClass: stripeClasses[index % stripeClasses.length],
        tone: tripTone(activeItineraries),
        updatedAt: trip.updated_at,
      };
    }),
  );

  return {
    recentTrips: trips.toSorted(
      (first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt),
    ).slice(0, 3),
    stats: {
      drafts: trips.filter((trip) => trip.status === "draft").length,
      places: trips.reduce((total, trip) => total + trip.placeCount, 0),
      trips: trips.length,
    },
    trips,
    upcomingTrip: trips.find((trip) => trip.status === "upcoming") ?? null,
  };
}
