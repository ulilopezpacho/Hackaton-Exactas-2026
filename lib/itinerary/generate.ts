import { createClient } from "@/lib/supabase/server";
import { solve } from "./solver";
import { enrichRecommendations } from "./enrich-recommendations";
import { scorePlaces } from "@/lib/places/score";
import type { PlaceForScoring, UserPreferencesForScoring } from "@/lib/places/score";
import {
  DEFAULT_PLACE_PRIORITY,
  PLACE_PRIORITY_BASE,
  type PlacePriority,
} from "@/lib/places/priority";
import { extractSearchInterestsCached } from "@/lib/places/extract-preferences";
import { matchCatalogCategories } from "@/lib/places/preference-interests";
import type {
  SolverInput,
  SolverPlace,
  SolverDay,
  SolverConfig,
  TravelMatrix,
  SolverResult,
} from "./types";

const MEAL_CATEGORIES = ["restaurante", "café", "cafetería", "bar", "gastro"];
const WALKING_SPEED_KMH = 5;
const DEPOT_ID = "__depot__";

const DEFAULT_CONFIG: SolverConfig = {
  dayStartTime: 9 * 60,
  dayEndTime: 22 * 60,
  mealIntervalMinutes: 240,
  // Mandatory meals anchored to clock windows. Closing times leave a buffer so
  // the route can still return to the depot before dayEndTime.
  meals: [
    { label: "Almuerzo", opensAt: 13 * 60, closesAt: 14 * 60 + 30, durationMinutes: 60 },
    { label: "Cena", opensAt: 20 * 60, closesAt: 20 * 60 + 30, durationMinutes: 75 },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

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

export async function generateItinerary(
  tripId: string,
  placeIds: string[],
  priorities?: Record<string, PlacePriority>,
  configOverrides?: Partial<SolverConfig>
): Promise<SolverResult> {
  console.log(`[generateItinerary] Starting for trip ${tripId}. Place ids:`, placeIds);
  console.log(`[generateItinerary] Priorities:`, priorities ?? "(none — defaulting all)");
  const supabase: AnySupabase = await createClient();
  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("starts_on, ends_on, owner_id, route_customization_prompt, destination_id")
    .eq("id", tripId)
    .single();
  if (tripError || !trip) throw new Error(`Trip not found: ${tripId}`);

  const tripData = trip as {
    starts_on: string;
    ends_on: string;
    owner_id: string;
    route_customization_prompt: string | null;
    destination_id: string | null;
  };
  console.log(`[generateItinerary] Trip dates: ${tripData.starts_on} to ${tripData.ends_on}. Destination ID: ${tripData.destination_id}`);
  const days = buildDays(tripData.starts_on, tripData.ends_on);

  // Resolve the user's preferences once, then derive the effective interests.
  // The route customization prompt takes precedence: global preference interests
  // are only used as a fallback when the prompt yields no specific interests.
  const { data: userPrefs } = await supabase
    .from("user_preferences")
    .select("interests, pace, budget, travel_style_prompt")
    .eq("user_id", tripData.owner_id)
    .maybeSingle();

  const savedInterests = (userPrefs?.interests as string[]) ?? [];
  const extractedInterests = await extractSearchInterestsCached(
    tripData.route_customization_prompt
  );
  const effectiveInterests =
    extractedInterests.length > 0 ? extractedInterests : savedInterests;
  console.log(
    `[generateItinerary] Using ${effectiveInterests.length} interests from ${
      extractedInterests.length > 0 ? "route customization prompt" : "global user preferences"
    }`
  );

  // The itinerary is built strictly from the places the user loaded into their
  // list (manual + AI-suggested). When a list is present we query ONLY those
  // places — `destination_id` is still used afterwards to enrich meal/free slots
  // with nearby Google results, but it must NOT pull the whole destination
  // catalog, which would outscore and drop the user's own picks.
  let placesQuery = supabase
    .from("places")
    .select("id, name, description, category, default_duration_minutes, rating, user_ratings_total, quality_score, popularity, location")
    .eq("status", "active");

  if (placeIds.length > 0) {
    console.log(`[generateItinerary] List-driven: querying only the ${placeIds.length} user-selected places`);
    placesQuery = placesQuery.in("id", placeIds);
  } else if (tripData.destination_id) {
    // No user list: fall back to the destination catalog so we never produce an
    // empty itinerary. Narrow to categories relevant to the effective interests.
    const categoryFilter = await buildCategoryFilter(
      supabase,
      tripData.destination_id,
      effectiveInterests
    );

    if (categoryFilter) {
      console.log(
        `[generateItinerary] No list; querying ${categoryFilter.categories.length} matched categories ` +
          `(activities: [${categoryFilter.activity.join(", ")}], meals: [${categoryFilter.meal.join(", ")}])`
      );
      placesQuery = placesQuery.or(
        `and(destination_id.eq.${tripData.destination_id},category.in.(${toInList(categoryFilter.categories)}))`
      );
    } else {
      console.log(`[generateItinerary] No list and no category match; querying full destination ${tripData.destination_id} catalog`);
      placesQuery = placesQuery.eq("destination_id", tripData.destination_id);
    }
  } else {
    throw new Error("Trip destination is missing and no optional places were selected.");
  }

  const { data: placesRaw, error: placesError } = await placesQuery;
  if (placesError) throw new Error(`Failed to fetch places: ${placesError.message}`);

  console.log(`[generateItinerary] Fetched ${placesRaw?.length ?? 0} total places from DB`);

  const placeRows = (placesRaw ?? []) as PlaceRow[];
  const allPlaceIds = placeRows.map((p) => p.id);

  const { data: windowsRaw, error: windowsError } = await supabase
    .from("place_opening_windows")
    .select("place_id, day_of_week, opens_at, closes_at")
    .in("place_id", allPlaceIds);
  if (windowsError)
    throw new Error(`Failed to fetch opening windows: ${windowsError.message}`);

  const windowRows = (windowsRaw ?? []) as WindowRow[];
  console.log(`[generateItinerary] Fetched ${windowRows.length} opening windows`);
  const windowsByPlace = new Map<string, WindowRow[]>();
  for (const w of windowRows) {
    const list = windowsByPlace.get(w.place_id) ?? [];
    list.push(w);
    windowsByPlace.set(w.place_id, list);
  }

  const places: SolverPlace[] = [];
  const mealPlaces: SolverPlace[] = [];

  for (const raw of placeRows) {
    const sp: SolverPlace = {
      id: raw.id,
      name: raw.name,
      durationMinutes: raw.default_duration_minutes ?? 60,
      openingWindows: (windowsByPlace.get(raw.id) ?? []).map((w) => ({
        dayOfWeek: w.day_of_week,
        opensAt: timeToMinutes(w.opens_at),
        closesAt: timeToMinutes(w.closes_at),
      })),
    };

    const isMeal =
      raw.category != null &&
      MEAL_CATEGORIES.some((mc) =>
        raw.category!.toLowerCase().includes(mc.toLowerCase())
      );

    if (isMeal) {
      mealPlaces.push(sp);
    } else {
      places.push(sp);
    }
  }

  console.log(`[generateItinerary] Categorized: ${places.length} activities, ${mealPlaces.length} meal spots`);

  // --- Score places ---
  // Interests follow the route-over-global precedence resolved above; pace, budget
  // and travel style have no per-route equivalent, so they always come from the
  // global profile.
  const prefsForScoring: UserPreferencesForScoring = {
    interests: effectiveInterests,
    pace: (userPrefs?.pace as string) ?? null,
    budget: (userPrefs?.budget as string) ?? null,
    travelStylePrompt: (userPrefs?.travel_style_prompt as string) ?? null,
  };

  const placesForScoring: PlaceForScoring[] = placeRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    rating: p.rating,
    userRatingsTotal: p.user_ratings_total,
    qualityScore: p.quality_score,
    popularity: p.popularity,
  }));

  console.log(`[generateItinerary] Scoring ${placesForScoring.length} places...`);
  const scored = await scorePlaces({
    places: placesForScoring,
    userPreferences: prefsForScoring,
    tripCustomizationPrompt: tripData.route_customization_prompt ?? undefined,
  });

  // Keep the raw Google quality score (0–100) for display purposes (stored on
  // itinerary items below).
  const scoresByPlaceId = new Map(scored.map((s) => [s.id, s.score]));

  // The score the solver optimises combines the user's per-place priority level
  // (the dominant term) with the Google quality score (a within-level tie-breaker).
  // The large gaps between levels make the solver keep the places the user cares
  // about most. See lib/places/priority.ts.
  const tierScoreFor = (id: string): number => {
    const priority = priorities?.[id] ?? DEFAULT_PLACE_PRIORITY;
    return PLACE_PRIORITY_BASE[priority] + (scoresByPlaceId.get(id) ?? 0);
  };

  // Rank activities by tier-aware score (not raw quality) before capping at 30,
  // so "must go" places are never cut from what we send to the solver.
  const orderedPlaces: SolverPlace[] = places
    .map((p) => ({ ...p, score: tierScoreFor(p.id) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 30);

  if (orderedPlaces.length > 0) {
    console.log(`[generateItinerary] Scored ${scored.length} places. Top scoring place: ${orderedPlaces[0].name} (Score: ${orderedPlaces[0].score})`);
  } else {
    console.warn(`[generateItinerary] Scored ${scored.length} places but none matched our activity list!`);
  }

  console.log(`[generateItinerary] Sending ${orderedPlaces.length} ordered places to solver`);

  const travelMatrix = buildTravelMatrix(placeRows);
  // Anchor every day at a depot ("hotel"). We have no real hotel yet, so we use
  // the catalog centroid as a stand-in: each day departs from and returns to it.
  const depotId = addCentroidDepot(travelMatrix, placeRows);

  const input: SolverInput = {
    places: orderedPlaces,
    mealPlaces,
    days,
    travelMatrix,
    config,
    startPlaceId: depotId,
    endPlaceId: depotId,
  };

  const result = solve(input);
  console.log(`[generateItinerary] Solver finished. Days scheduled: ${result.days.filter(d => d.items.length > 0).length}. Score: ${result.score}`);

  const coordinatesByPlaceId = new Map(
    placeRows.flatMap((place) => {
      const coordinates = extractCoords(place.location);
      return coordinates ? [[place.id, coordinates] as const] : [];
    }),
  );
  const enrichedResult = await enrichRecommendations({
    supabase,
    result,
    destinationId: tripData.destination_id,
    budget: prefsForScoring.budget as
      | "under_50"
      | "50_100"
      | "100_200"
      | "over_200"
      | null,
    coordinatesByPlaceId,
  });

  // Figure out which of the user's selected activities didn't make it into the
  // schedule (they didn't fit in the day's time budget) so we can surface them.
  const scheduledPlaceIds = new Set<string>();
  for (const day of enrichedResult.days) {
    for (const item of day.items) {
      if (item.placeId) scheduledPlaceIds.add(item.placeId);
    }
  }
  const skippedPlaces = places
    .filter((p) => !scheduledPlaceIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }));
  if (skippedPlaces.length > 0) {
    console.log(
      `[generateItinerary] ${skippedPlaces.length} selected places left out: ${skippedPlaces.map((p) => p.name).join(", ")}`
    );
  }

  await writeToSupabase(
    supabase,
    tripId,
    enrichedResult,
    days,
    scoresByPlaceId,
    skippedPlaces,
  );

  return enrichedResult;
}

// --- Helpers ---

interface CategoryFilter {
  activity: string[];
  meal: string[];
  categories: string[]; // activity + meal, the set passed to `category.in.(...)`
}

/**
 * Resolves which catalog categories to keep for a destination, based on the
 * already-resolved effective `interests` (route customization taking precedence
 * over global preferences). Returns `null` when the caller should fall back to
 * the full catalog (no interests or no activity category matched).
 */
async function buildCategoryFilter(
  supabase: AnySupabase,
  destinationId: string,
  interests: string[]
): Promise<CategoryFilter | null> {
  if (interests.length === 0) return null;

  const { data: categoryRows, error } = await supabase
    .from("places")
    .select("category")
    .eq("status", "active")
    .eq("destination_id", destinationId)
    .not("category", "is", null);
  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);

  const distinctCategories = Array.from(
    new Set(
      ((categoryRows ?? []) as { category: string | null }[])
        .map((r) => r.category)
        .filter((c): c is string => c != null)
    )
  );

  const { activity, meal } = matchCatalogCategories(
    distinctCategories,
    interests,
    MEAL_CATEGORIES
  );

  // Only filter when at least one activity category matched; otherwise keeping
  // just meal categories would yield a meal-only itinerary.
  if (activity.length === 0) return null;

  return { activity, meal, categories: [...activity, ...meal] };
}

// Builds a PostgREST `in.(...)` value list, double-quoting each entry so values
// containing spaces or punctuation (e.g. "Aire libre") parse correctly.
function toInList(values: string[]): string {
  return values
    .map((v) => `"${v.replace(/"/g, '\\"')}"`)
    .join(",");
}

export function buildDays(startsOn: string, endsOn: string): SolverDay[] {
  const days: SolverDay[] = [];
  const start = new Date(startsOn + "T00:00:00");
  const end = new Date(endsOn + "T00:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({
      date: d.toISOString().slice(0, 10),
      dayOfWeek: d.getDay(),
    });
  }
  return days;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
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
  location: unknown
): { lat: number; lng: number } | null {
  if (!location) return null;

  // GeoJSON object: { type: "Point", coordinates: [lng, lat] }
  if (typeof location === "object" && location !== null && "coordinates" in location) {
    const coords = (location as { coordinates: number[] }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: coords[0], lat: coords[1] };
    }
  }

  // EWKB hex string — what Supabase/PostgREST actually returns for geography columns
  if (typeof location === "string") {
    return parseEwkbPoint(location);
  }

  return null;
}

function parseEwkbPoint(hex: string): { lat: number; lng: number } | null {
  try {
    // Minimum: 1B order + 4B type + 4B SRID + 8B x + 8B y = 25 bytes = 50 hex chars
    if (hex.length < 50) return null;

    const isLE = hex.slice(0, 2).toLowerCase() === "01";

    const readUint32 = (offset: number): number => {
      const s = hex.slice(offset, offset + 8);
      const ordered = isLE ? (s.match(/../g) ?? []).reverse().join("") : s;
      return parseInt(ordered, 16);
    };

    const readDouble = (offset: number): number => {
      const s = hex.slice(offset, offset + 16);
      const bytes = (isLE ? (s.match(/../g) ?? []).reverse() : (s.match(/../g) ?? [])).map(
        (b) => parseInt(b, 16),
      );
      const buf = new ArrayBuffer(8);
      const view = new DataView(buf);
      bytes.forEach((b, i) => view.setUint8(i, b));
      return view.getFloat64(0); // big-endian after byte reversal
    };

    const geomType = readUint32(2);
    const hasSrid = (geomType & 0x20000000) !== 0;
    if ((geomType & 0xffff) !== 1) return null; // Not a Point

    const coordOffset = 2 + 8 + (hasSrid ? 8 : 0); // hex char offset
    const lng = readDouble(coordOffset);
    const lat = readDouble(coordOffset + 16);

    if (!isFinite(lng) || !isFinite(lat)) return null;
    return { lng, lat };
  } catch {
    return null;
  }
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

/**
 * Adds a depot node to the travel matrix located at the centroid of the place
 * catalog, with walking times to/from every place. Returns the depot id, or
 * null if no place has coordinates (in which case the solver runs without a
 * depot, i.e. no daily return leg).
 */
function addCentroidDepot(matrix: TravelMatrix, places: PlaceRow[]): string | null {
  const coords = places
    .map((p) => extractCoords(p.location))
    .filter((c): c is { lat: number; lng: number } => c != null);
  if (coords.length === 0) return null;

  const lat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
  const lng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length;

  matrix[DEPOT_ID] = { [DEPOT_ID]: 0 };
  for (const p of places) {
    const c = extractCoords(p.location);
    const minutes = c
      ? Math.ceil((haversineKm(lat, lng, c.lat, c.lng) / WALKING_SPEED_KMH) * 60)
      : 15;
    matrix[DEPOT_ID][p.id] = minutes;
    (matrix[p.id] ??= {})[DEPOT_ID] = minutes;
  }
  return DEPOT_ID;
}

// --- Supabase write ---

async function writeToSupabase(
  supabase: AnySupabase,
  tripId: string,
  result: SolverResult,
  days: SolverDay[],
  scoresByPlaceId: Map<string, number>,
  skippedPlaces: { id: string; name: string }[] = []
) {
  // Clean up existing itineraries for this trip before writing new ones
  await supabase
    .from("itineraries")
    .delete()
    .eq("trip_id", tripId);

  let firstItineraryId: string | null = null;
  let firstDayDate: string | null = null;

  for (const daySchedule of result.days) {
    const { data: itinerary, error: itinError } = await supabase
      .from("itineraries")
      .insert({
        trip_id: tripId,
        day_number: daySchedule.dayIndex + 1,
        status: "active",
        itinerary_type: "smart_generated",
        title: `Día ${daySchedule.dayIndex + 1}`,
      })
      .select("id")
      .single();

    if (itinError || !itinerary) {
      throw new Error(
        `Failed to create itinerary for day ${daySchedule.dayIndex + 1}: ${itinError?.message}`
      );
    }

    const dayDate = days[daySchedule.dayIndex].date;
    if (firstItineraryId === null) {
      firstItineraryId = itinerary.id;
      firstDayDate = dayDate;
    }

    const itemRows = daySchedule.items.map((item, position) => ({
      itinerary_id: itinerary.id,
      place_id: item.placeId,
      item_type: item.type,
      title: item.title,
      description: item.description ?? null,
      starts_at: `${dayDate}T${minutesToTime(item.startMinute)}:00`,
      ends_at: `${dayDate}T${minutesToTime(item.endMinute)}:00`,
      position,
      score: item.placeId ? scoresByPlaceId.get(item.placeId) ?? null : null,
    }));

    if (itemRows.length > 0) {
      const { error: itemsError } = await supabase
        .from("itinerary_items")
        .insert(itemRows);

      if (itemsError) {
        throw new Error(
          `Failed to create itinerary items: ${itemsError.message}`
        );
      }
    }
  }

  // Record the user's selected places that didn't fit so the itinerary view can
  // list them. They're stored as `note` items (an allowed item_type) on the
  // first day, outside the visible timeline, and ignored by travel/replan which
  // only act on `place`/`recommendation` items. Times are a placeholder window
  // at the end of the day to satisfy the starts_at < ends_at constraint.
  if (skippedPlaces.length > 0 && firstItineraryId && firstDayDate) {
    const skippedRows = skippedPlaces.map((place, index) => ({
      itinerary_id: firstItineraryId,
      place_id: place.id,
      item_type: "note",
      title: place.name,
      description: "No entró en el plan: no había tiempo suficiente en el día.",
      starts_at: `${firstDayDate}T23:58:00`,
      ends_at: `${firstDayDate}T23:59:00`,
      position: 1000 + index,
      score: scoresByPlaceId.get(place.id) ?? null,
    }));

    const { error: skippedError } = await supabase
      .from("itinerary_items")
      .insert(skippedRows);

    if (skippedError) {
      // Non-fatal: the itinerary itself is valid without the "left out" list.
      console.warn(
        `[generateItinerary] Could not persist left-out places: ${skippedError.message}`
      );
    }
  }

  const { error: tripStatusError } = await supabase
    .from("trips")
    .update({ status: "planned" })
    .eq("id", tripId);

  if (tripStatusError) {
    throw new Error(
      `Failed to finish trip generation: ${tripStatusError.message}`
    );
  }
}
