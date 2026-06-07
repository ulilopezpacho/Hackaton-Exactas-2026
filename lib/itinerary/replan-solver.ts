import { createClient } from "@/lib/supabase/server";
import { scorePlaces } from "@/lib/places/score";
import type { PlaceForScoring } from "@/lib/places/score";

import type { ReplanConstraints } from "./replan-contract";
import { solve } from "./solver";
import type {
  SolverConfig,
  SolverDay,
  SolverInput,
  SolverPlace,
  TravelMatrix,
} from "./types";

const MEAL_CATEGORIES = [
  "restaurante",
  "restaurant",
  "café",
  "cafetería",
  "cafe",
  "bar",
  "gastro",
];
const UNKNOWN_TRAVEL_MINUTES = 15;
const WALKING_SPEED_KMH = 5;

// The generated Supabase types intentionally omit PostGIS and opening-window
// details. Keep the untyped boundary here instead of spreading casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

type ItineraryItemRow = {
  description: string | null;
  ends_at: string;
  id: string;
  item_type: string;
  locked: boolean;
  place_id: string | null;
  position: number;
  starts_at: string;
  title: string;
};

type PlaceRow = {
  category: string | null;
  default_duration_minutes: number | null;
  description: string | null;
  id: string;
  location: unknown;
  name: string;
  popularity: number | null;
  quality_score: number | null;
  rating: number | null;
  user_ratings_total: number | null;
};

type WindowRow = {
  closes_at: string;
  day_of_week: number;
  opens_at: string;
  place_id: string;
};

export type ReplanSolverResult = {
  droppedPlaceIds: string[];
  newItems: Array<{
    description: string | null;
    endsAt: string;
    itemType: string;
    placeId: string | null;
    position: number;
    startsAt: string;
    title: string;
  }>;
  score: number;
};

export async function replanWithSolver(
  tripId: string,
  constraints: ReplanConstraints,
): Promise<ReplanSolverResult> {
  const supabase: SupabaseClient = await createClient();
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("starts_on,owner_id,destination_id,current_day_number")
    .eq("id", tripId)
    .single();

  if (tripError || !trip?.current_day_number) {
    throw new Error("Trip not found or has no current day");
  }

  const { data: itinerary, error: itineraryError } = await supabase
    .from("itineraries")
    .select("id,day_number")
    .eq("id", constraints.sourceItineraryId)
    .eq("trip_id", tripId)
    .eq("status", "active")
    .single();

  if (itineraryError || !itinerary) {
    throw new Error("Source itinerary is no longer active");
  }

  const { data: itemData, error: itemsError } = await supabase
    .from("itinerary_items")
    .select(
      "id,place_id,item_type,title,description,starts_at,ends_at,position,locked",
    )
    .eq("itinerary_id", itinerary.id)
    .order("position");

  if (itemsError) {
    throw new Error(`Failed to load itinerary items: ${itemsError.message}`);
  }

  const allItems = (itemData ?? []) as ItineraryItemRow[];
  const currentIndex = allItems.findIndex(
    (item) => item.id === constraints.currentItemId,
  );
  if (currentIndex < 0) {
    throw new Error("Current item no longer belongs to the source itinerary");
  }

  const currentItem = allItems[currentIndex];
  const remainingItems = allItems
    .slice(currentIndex + 1)
    .filter(
      (item) =>
        item.item_type === "place" &&
        item.place_id &&
        !constraints.excludedPlaceIds.includes(item.place_id),
    );
  const remainingPlaceIds = Array.from(
    new Set(remainingItems.flatMap((item) => item.place_id ?? [])),
  );

  if (remainingPlaceIds.length === 0) {
    return { droppedPlaceIds: [], newItems: [], score: 0 };
  }

  const placeColumns =
    "id,name,description,category,default_duration_minutes,rating,user_ratings_total,quality_score,popularity,location";
  const relevantIds = Array.from(
    new Set([
      ...remainingPlaceIds,
      ...(currentItem.place_id ? [currentItem.place_id] : []),
    ]),
  );

  const [{ data: relevantData, error: placesError }, mealResult] =
    await Promise.all([
      supabase
        .from("places")
        .select(placeColumns)
        .in("id", relevantIds)
        .eq("status", "active"),
      trip.destination_id
        ? supabase
            .from("places")
            .select(placeColumns)
            .eq("destination_id", trip.destination_id)
            .eq("status", "active")
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (placesError) {
    throw new Error(`Failed to load places: ${placesError.message}`);
  }

  const relevantPlaces = (relevantData ?? []) as PlaceRow[];
  const remainingPlaces = relevantPlaces.filter((place) =>
    remainingPlaceIds.includes(place.id),
  );
  const mealPlaces = ((mealResult.data ?? []) as PlaceRow[]).filter(isMealPlace);
  const matrixPlaces = dedupePlaces([...relevantPlaces, ...mealPlaces]);
  const allPlaceIds = matrixPlaces.map((place) => place.id);

  const { data: windowsData, error: windowsError } = await supabase
    .from("place_opening_windows")
    .select("place_id,day_of_week,opens_at,closes_at")
    .in("place_id", allPlaceIds);

  if (windowsError) {
    throw new Error(
      `Failed to load opening windows: ${windowsError.message}`,
    );
  }

  const windowsByPlace = groupWindows((windowsData ?? []) as WindowRow[]);
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("interests,pace,budget,travel_style_prompt")
    .eq("user_id", trip.owner_id)
    .maybeSingle();

  const scoreInput: PlaceForScoring[] = remainingPlaces.map((place) => ({
    category: place.category,
    description: place.description,
    id: place.id,
    name: place.name,
    popularity: place.popularity,
    qualityScore: place.quality_score,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
  }));
  const scored = await scorePlaces({
    places: scoreInput,
    userPreferences: {
      budget: preferences?.budget ?? null,
      interests: preferences?.interests ?? [],
      pace: preferences?.pace ?? null,
      travelStylePrompt: preferences?.travel_style_prompt ?? null,
    },
  });
  const scoresByPlace = new Map(scored.map((place) => [place.id, place.score]));
  const durationByPlace = new Map(
    remainingItems.flatMap((item) =>
      item.place_id
        ? [
            [
              item.place_id,
              constraints.durationMinutesByItemId[item.id] ??
                durationMinutes(item.starts_at, item.ends_at),
            ] as const,
          ]
        : [],
    ),
  );
  const toSolverPlace = (place: PlaceRow): SolverPlace => ({
    durationMinutes:
      durationByPlace.get(place.id) ?? place.default_duration_minutes ?? 60,
    id: place.id,
    name: place.name,
    openingWindows: (windowsByPlace.get(place.id) ?? []).map((window) => ({
      closesAt: timeToMinutes(window.closes_at),
      dayOfWeek: window.day_of_week,
      opensAt: timeToMinutes(window.opens_at),
    })),
    score: scoresByPlace.get(place.id),
  });

  const activities = remainingPlaces
    .filter((place) => !isMealPlace(place))
    .map(toSolverPlace);
  const meals = dedupePlaces([
    ...remainingPlaces.filter(isMealPlace),
    ...mealPlaces,
  ]).map(toSolverPlace);
  const effectiveStart = new Date(constraints.effectiveStartAt);
  const dayDate = dateForDay(trip.starts_on, itinerary.day_number);
  const originalEndMinute = Math.max(
    ...allItems.map((item) => minuteOfDay(item.ends_at)),
  );
  const config: SolverConfig = {
    dayEndTime: originalEndMinute,
    dayStartTime: minuteOfDay(effectiveStart.toISOString()),
    mealIntervalMinutes: 240,
  };
  const solverDay: SolverDay = {
    date: dayDate,
    dayOfWeek: dayOfWeek(dayDate),
  };
  const input: SolverInput = {
    config,
    days: [solverDay],
    mealPlaces: meals,
    places: activities,
    startPlaceId: currentItem.place_id,
    travelMatrix: buildTravelMatrix(matrixPlaces),
  };
  const result = solve(input);
  const schedule = result.days[0]?.items ?? [];
  const firstPosition = currentItem.position + 1;

  return {
    droppedPlaceIds: [
      ...result.unplacedPlaces,
      ...remainingPlaces.filter(isMealPlace).map((place) => place.id),
    ].filter(
      (placeId, index, ids) =>
        !schedule.some((item) => item.placeId === placeId) &&
        ids.indexOf(placeId) === index,
    ),
    newItems: schedule.map((item, index) => ({
      description: item.description ?? null,
      endsAt: localDateTime(solverDay.date, item.endMinute),
      itemType: item.type,
      placeId: item.placeId,
      position: firstPosition + index,
      startsAt: localDateTime(solverDay.date, item.startMinute),
      title: item.title,
    })),
    score: result.score,
  };
}

function buildTravelMatrix(places: PlaceRow[]): TravelMatrix {
  const matrix: TravelMatrix = {};
  const coordinates = new Map(
    places.flatMap((place) => {
      const coordinate = extractCoordinates(place.location);
      return coordinate ? [[place.id, coordinate] as const] : [];
    }),
  );

  for (const from of places) {
    matrix[from.id] = {};
    for (const to of places) {
      if (from.id === to.id) {
        matrix[from.id][to.id] = 0;
        continue;
      }

      const fromCoordinate = coordinates.get(from.id);
      const toCoordinate = coordinates.get(to.id);
      matrix[from.id][to.id] =
        fromCoordinate && toCoordinate
          ? Math.max(
              1,
              Math.ceil(
                (haversineKm(fromCoordinate, toCoordinate) /
                  WALKING_SPEED_KMH) *
                  60,
              ),
            )
          : UNKNOWN_TRAVEL_MINUTES;
    }
  }

  return matrix;
}

function dateForDay(startsOn: string, dayNumber: number) {
  const date = new Date(`${startsOn}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayNumber - 1);
  return date.toISOString().slice(0, 10);
}

function dayOfWeek(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function dedupePlaces(places: PlaceRow[]) {
  return Array.from(new Map(places.map((place) => [place.id, place])).values());
}

function durationMinutes(startsAt: string, endsAt: string) {
  return Math.max(
    1,
    Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000),
  );
}

function extractCoordinates(location: unknown) {
  if (
    !location ||
    typeof location !== "object" ||
    !("coordinates" in location)
  ) {
    return null;
  }

  const coordinates = (location as { coordinates?: unknown }).coordinates;
  return Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    coordinates.every((value) => typeof value === "number")
    ? { latitude: coordinates[1], longitude: coordinates[0] }
    : null;
}

function groupWindows(windows: WindowRow[]) {
  const result = new Map<string, WindowRow[]>();
  for (const window of windows) {
    result.set(window.place_id, [
      ...(result.get(window.place_id) ?? []),
      window,
    ]);
  }
  return result;
}

function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radiusKm = 6371;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function isMealPlace(place: PlaceRow) {
  const category = place.category?.toLocaleLowerCase("es") ?? "";
  return MEAL_CATEGORIES.some((mealCategory) =>
    category.includes(mealCategory),
  );
}

function localDateTime(date: string, minutes: number) {
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${date}T${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function minuteOfDay(iso: string) {
  const time = iso.includes("T") ? iso.split("T")[1] : iso;
  return timeToMinutes(time);
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}
