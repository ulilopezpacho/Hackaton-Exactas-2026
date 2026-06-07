import { createClient } from "@/lib/supabase/server";
import { solve } from "./solver";
import { scorePlaces } from "@/lib/places/score";
import type { PlaceForScoring } from "@/lib/places/score";
import type {
  SolverPlace,
  SolverDay,
  SolverConfig,
  TravelMatrix,
  SolverInput,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReplanSolverInput {
  tripId: string;
  currentItemId: string;
  currentDayNumber: number;
  excludePlaceIds?: string[];
}

export interface ReplanSolverResult {
  /** New itinerary items to replace the remaining ones for the current day */
  newItems: Array<{
    placeId: string | null;
    itemType: string;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    position: number;
    score: number | null;
  }>;
  /** Items that were dropped because they couldn't fit */
  droppedPlaceIds: string[];
  /** The solver score for the new arrangement */
  score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEAL_CATEGORIES = ["restaurante", "café", "cafetería", "bar", "gastro"];
const WALKING_SPEED_KMH = 5;

const DEFAULT_CONFIG: SolverConfig = {
  dayStartTime: 9 * 60,
  dayEndTime: 22 * 60,
  mealIntervalMinutes: 240,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

interface PlaceRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  default_duration_minutes: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  quality_score: number | null;
  popularity: number | null;
  location: unknown;
}

interface WindowRow {
  place_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
}

interface ItineraryItemRow {
  id: string;
  itinerary_id: string;
  place_id: string | null;
  item_type: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  position: number;
  score: number | null;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Re-plan the remainder of the current day using the solver algorithm.
 *
 * Given the user's current position (`currentItemId`), this function:
 * 1. Gathers every remaining "place" item after that position for the day.
 * 2. Fetches place metadata, opening windows, and meal options.
 * 3. Scores the places and builds a travel matrix.
 * 4. Runs the solver starting from the current item's end time.
 * 5. Returns a list of new items that replace the remainder of the day.
 */
export async function replanWithSolver(
  input: ReplanSolverInput,
): Promise<ReplanSolverResult> {
  const { tripId, currentItemId, currentDayNumber, excludePlaceIds } = input;
  const supabase: AnySupabase = await createClient();

  console.log(
    `[replanWithSolver] Starting replan for trip ${tripId}, item ${currentItemId}, day ${currentDayNumber}`,
  );

  // -----------------------------------------------------------------------
  // 1. Fetch the trip
  // -----------------------------------------------------------------------
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("starts_on, ends_on, owner_id, destination_id")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    throw new Error(`Trip not found: ${tripId}`);
  }

  const tripData = trip as {
    starts_on: string;
    ends_on: string;
    owner_id: string;
    destination_id: string | null;
  };

  // -----------------------------------------------------------------------
  // 2. Fetch the current day's itinerary and its items
  // -----------------------------------------------------------------------
  const { data: itinerary, error: itinError } = await supabase
    .from("itineraries")
    .select("id")
    .eq("trip_id", tripId)
    .eq("day_number", currentDayNumber)
    .eq("status", "active")
    .single();

  if (itinError || !itinerary) {
    throw new Error(
      `Active itinerary for day ${currentDayNumber} not found in trip ${tripId}`,
    );
  }

  const itineraryId = (itinerary as { id: string }).id;

  const { data: allItemsRaw, error: itemsError } = await supabase
    .from("itinerary_items")
    .select(
      "id, itinerary_id, place_id, item_type, title, description, starts_at, ends_at, position, score",
    )
    .eq("itinerary_id", itineraryId)
    .order("position");

  if (itemsError) {
    throw new Error(`Failed to fetch itinerary items: ${itemsError.message}`);
  }

  const allItems = (allItemsRaw ?? []) as ItineraryItemRow[];

  // -----------------------------------------------------------------------
  // 3. Identify the current item and remaining place items
  // -----------------------------------------------------------------------
  const currentItemIndex = allItems.findIndex((i) => i.id === currentItemId);
  if (currentItemIndex === -1) {
    throw new Error(
      `Current item ${currentItemId} not found in itinerary ${itineraryId}`,
    );
  }

  const currentItem = allItems[currentItemIndex];

  // Remaining items are those *after* the current one
  const remainingItems = allItems.slice(currentItemIndex + 1);

  // Extract unique place IDs from remaining "place" items
  let remainingPlaceIds = [
    ...new Set(
      remainingItems
        .filter((i) => i.item_type === "place" && i.place_id != null)
        .map((i) => i.place_id as string),
    ),
  ];

  if (excludePlaceIds && excludePlaceIds.length > 0) {
    remainingPlaceIds = remainingPlaceIds.filter(
      (id) => !excludePlaceIds.includes(id),
    );
  }

  if (remainingPlaceIds.length === 0) {
    console.log("[replanWithSolver] No remaining places to replan");
    return { newItems: [], droppedPlaceIds: [], score: 0 };
  }

  console.log(
    `[replanWithSolver] Found ${remainingPlaceIds.length} remaining places to replan`,
  );

  // -----------------------------------------------------------------------
  // 4. Fetch place data for remaining places + meal places
  // -----------------------------------------------------------------------
  const placeColumns =
    "id, name, description, category, default_duration_minutes, rating, user_ratings_total, quality_score, popularity, location";

  // Fetch the remaining activity places
  const { data: remainingPlacesRaw, error: remainingPlacesError } =
    await supabase
      .from("places")
      .select(placeColumns)
      .in("id", remainingPlaceIds)
      .eq("status", "active");

  if (remainingPlacesError) {
    throw new Error(
      `Failed to fetch remaining places: ${remainingPlacesError.message}`,
    );
  }

  // Fetch meal places from the destination catalog
  let mealPlacesRaw: PlaceRow[] = [];
  if (tripData.destination_id) {
    const { data: mealData, error: mealError } = await supabase
      .from("places")
      .select(placeColumns)
      .eq("destination_id", tripData.destination_id)
      .eq("status", "active");

    if (mealError) {
      console.warn(
        `[replanWithSolver] Failed to fetch meal places: ${mealError.message}`,
      );
    } else {
      mealPlacesRaw = ((mealData ?? []) as PlaceRow[]).filter(
        (p) =>
          p.category != null &&
          MEAL_CATEGORIES.some((mc) =>
            p.category!.toLowerCase().includes(mc.toLowerCase()),
          ),
      );
    }
  }

  const remainingPlaceRows = (remainingPlacesRaw ?? []) as PlaceRow[];

  // Combine all place IDs for opening windows query
  const allRelevantPlaceIds = [
    ...remainingPlaceRows.map((p) => p.id),
    ...mealPlacesRaw.map((p) => p.id),
  ];

  // -----------------------------------------------------------------------
  // 5. Fetch opening windows
  // -----------------------------------------------------------------------
  const windowsByPlace = new Map<string, WindowRow[]>();

  if (allRelevantPlaceIds.length > 0) {
    const { data: windowsRaw, error: windowsError } = await supabase
      .from("place_opening_windows")
      .select("place_id, day_of_week, opens_at, closes_at")
      .in("place_id", allRelevantPlaceIds);

    if (windowsError) {
      console.warn(
        `[replanWithSolver] Failed to fetch opening windows: ${windowsError.message}`,
      );
    } else {
      const windowRows = (windowsRaw ?? []) as WindowRow[];
      for (const w of windowRows) {
        const list = windowsByPlace.get(w.place_id) ?? [];
        list.push(w);
        windowsByPlace.set(w.place_id, list);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 6. Score places
  // -----------------------------------------------------------------------
  const { data: userPrefs } = await supabase
    .from("user_preferences")
    .select("interests, pace, budget, travel_style_prompt")
    .eq("user_id", tripData.owner_id)
    .maybeSingle();

  const placesForScoring: PlaceForScoring[] = remainingPlaceRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    rating: p.rating,
    userRatingsTotal: p.user_ratings_total,
    qualityScore: p.quality_score,
    popularity: p.popularity,
  }));

  const scored = await scorePlaces({
    places: placesForScoring,
    userPreferences: {
      interests: (userPrefs?.interests as string[]) ?? [],
      pace: (userPrefs?.pace as string) ?? null,
      budget: (userPrefs?.budget as string) ?? null,
      travelStylePrompt: (userPrefs?.travel_style_prompt as string) ?? null,
    },
  });

  const scoresByPlaceId = new Map(scored.map((s) => [s.id, s.score]));

  // -----------------------------------------------------------------------
  // 7. Build SolverPlace arrays
  // -----------------------------------------------------------------------
  function toSolverPlace(raw: PlaceRow): SolverPlace {
    return {
      id: raw.id,
      name: raw.name,
      durationMinutes: raw.default_duration_minutes ?? 60,
      openingWindows: (windowsByPlace.get(raw.id) ?? []).map((w) => ({
        dayOfWeek: w.day_of_week,
        opensAt: timeToMinutes(w.opens_at),
        closesAt: timeToMinutes(w.closes_at),
      })),
      score: scoresByPlaceId.get(raw.id),
    };
  }

  const activityPlaces: SolverPlace[] = remainingPlaceRows
    .filter(
      (p) =>
        !(
          p.category != null &&
          MEAL_CATEGORIES.some((mc) =>
            p.category!.toLowerCase().includes(mc.toLowerCase()),
          )
        ),
    )
    .map(toSolverPlace)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const mealSolverPlaces: SolverPlace[] = [
    // Include any remaining meal-type places the user had in their itinerary
    ...remainingPlaceRows.filter(
      (p) =>
        p.category != null &&
        MEAL_CATEGORIES.some((mc) =>
          p.category!.toLowerCase().includes(mc.toLowerCase()),
        ),
    ),
    // Plus destination-wide meal options
    ...mealPlacesRaw,
  ].map(toSolverPlace);

  // Deduplicate meal places
  const seenMealIds = new Set<string>();
  const uniqueMealPlaces = mealSolverPlaces.filter((p) => {
    if (seenMealIds.has(p.id)) return false;
    seenMealIds.add(p.id);
    return true;
  });

  // -----------------------------------------------------------------------
  // 8. Build travel matrix
  // -----------------------------------------------------------------------
  const allPlaceRowsForMatrix = [
    ...remainingPlaceRows,
    ...mealPlacesRaw.filter(
      (mp) => !remainingPlaceRows.some((rp) => rp.id === mp.id),
    ),
  ];

  const travelMatrix = buildTravelMatrix(allPlaceRowsForMatrix);

  // -----------------------------------------------------------------------
  // 9. Determine the day and time window
  // -----------------------------------------------------------------------
  // The solver day starts from where the current item ends
  const currentItemEndsAt = currentItem.ends_at; // ISO string e.g. "2026-06-10T14:30:00"
  const dayStartMinute = isoToMinuteOfDay(currentItemEndsAt);

  // Compute the date and day of week from the trip's starts_on + dayNumber
  const tripStartDate = new Date(tripData.starts_on + "T00:00:00");
  const dayDate = new Date(tripStartDate);
  dayDate.setDate(dayDate.getDate() + (currentDayNumber - 1));

  const solverDay: SolverDay = {
    date: dayDate.toISOString().slice(0, 10),
    dayOfWeek: dayDate.getDay(),
  };

  const config: SolverConfig = {
    dayStartTime: dayStartMinute,
    dayEndTime: DEFAULT_CONFIG.dayEndTime,
    mealIntervalMinutes: DEFAULT_CONFIG.mealIntervalMinutes,
  };

  console.log(
    `[replanWithSolver] Solver window: ${minutesToTime(config.dayStartTime)} - ${minutesToTime(config.dayEndTime)} on ${solverDay.date} (dayOfWeek=${solverDay.dayOfWeek})`,
  );

  // -----------------------------------------------------------------------
  // 10. Run the solver
  // -----------------------------------------------------------------------
  const solverInput: SolverInput = {
    places: activityPlaces,
    mealPlaces: uniqueMealPlaces,
    days: [solverDay],
    travelMatrix,
    config,
    startPlaceId: currentItem.place_id,
  };

  const result = solve(solverInput);

  console.log(
    `[replanWithSolver] Solver finished. Score: ${result.score}. Unplaced: ${result.unplacedPlaces.length}`,
  );

  // -----------------------------------------------------------------------
  // 11. Convert solver result to output format
  // -----------------------------------------------------------------------
  const dayDate_ = solverDay.date;
  const daySchedule = result.days[0];
  if (!daySchedule || daySchedule.items.length === 0) {
    return {
      newItems: [],
      droppedPlaceIds: remainingPlaceIds,
      score: result.score,
    };
  }

  // Starting position = current item's position + 1
  const startPosition = currentItem.position + 1;

  const newItems = daySchedule.items.map((item, index) => ({
    placeId: item.placeId,
    itemType: item.type,
    title: item.title,
    description: item.description ?? null,
    startsAt: `${dayDate_}T${minutesToTime(item.startMinute)}:00`,
    endsAt: `${dayDate_}T${minutesToTime(item.endMinute)}:00`,
    position: startPosition + index,
    score: item.placeId ? scoresByPlaceId.get(item.placeId) ?? null : null,
  }));

  return {
    newItems,
    droppedPlaceIds: result.unplacedPlaces,
    score: result.score,
  };
}

// ---------------------------------------------------------------------------
// Helpers (mirrored from generate.ts for isolation)
// ---------------------------------------------------------------------------

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Extract minute-of-day from an ISO datetime string like "2026-06-10T14:30:00" */
function isoToMinuteOfDay(iso: string): number {
  const timePart = iso.includes("T") ? iso.split("T")[1] : iso;
  return timeToMinutes(timePart);
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractCoords(
  location: unknown,
): { lat: number; lng: number } | null {
  if (!location) return null;
  if (
    typeof location === "object" &&
    location !== null &&
    "coordinates" in location
  ) {
    const coords = (location as { coordinates: number[] }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: coords[0], lat: coords[1] };
    }
  }
  return null;
}

function buildTravelMatrix(places: PlaceRow[]): TravelMatrix {
  const matrix: TravelMatrix = {};
  const coords = new Map<string, { lat: number; lng: number }>();

  for (const p of places) {
    const c = extractCoords(p.location);
    if (c) coords.set(p.id, c);
  }

  for (const a of places) {
    matrix[a.id] = {};
    const ca = coords.get(a.id);
    for (const b of places) {
      if (a.id === b.id) {
        matrix[a.id][b.id] = 0;
        continue;
      }
      const cb = coords.get(b.id);
      if (ca && cb) {
        const km = haversineKm(ca.lat, ca.lng, cb.lat, cb.lng);
        matrix[a.id][b.id] = Math.ceil((km / WALKING_SPEED_KMH) * 60);
      } else {
        matrix[a.id][b.id] = 15;
      }
    }
  }
  return matrix;
}
