import { createClient } from "@/lib/supabase/server";
import { solve } from "./solver";
import { enrichRecommendations } from "./enrich-recommendations";
import { scorePlaces } from "@/lib/places/score";
import type { PlaceForScoring, UserPreferencesForScoring } from "@/lib/places/score";
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

const DEFAULT_CONFIG: SolverConfig = {
  dayStartTime: 9 * 60,
  dayEndTime: 22 * 60,
  mealIntervalMinutes: 240,
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
  configOverrides?: Partial<SolverConfig>
): Promise<SolverResult> {
  console.log(`[generateItinerary] Starting for trip ${tripId}. Priorities:`, placeIds);
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

  // Narrow the destination catalog to categories relevant to the effective
  // interests, instead of pulling every active place. User-prioritized places and
  // meal places are always kept; if nothing matches we fall back to the full
  // catalog so we never produce an empty itinerary.
  let placesQuery = supabase
    .from("places")
    .select("id, name, description, category, default_duration_minutes, rating, user_ratings_total, quality_score, popularity, location")
    .eq("status", "active");

  if (tripData.destination_id) {
    const categoryFilter = await buildCategoryFilter(
      supabase,
      tripData.destination_id,
      effectiveInterests
    );

    if (categoryFilter) {
      console.log(
        `[generateItinerary] Querying priorities + ${categoryFilter.categories.length} matched categories ` +
          `(activities: [${categoryFilter.activity.join(", ")}], meals: [${categoryFilter.meal.join(", ")}])`
      );
      const destinationFilter =
        `and(destination_id.eq.${tripData.destination_id},category.in.(${toInList(categoryFilter.categories)}))`;
      placesQuery = placeIds.length > 0
        ? placesQuery.or(`id.in.(${placeIds.join(",")}),${destinationFilter}`)
        : placesQuery.or(destinationFilter);
    } else {
      console.log(`[generateItinerary] No category match; querying priorities + full destination ${tripData.destination_id} catalog`);
      placesQuery = placeIds.length > 0
        ? placesQuery.or(`id.in.(${placeIds.join(",")}),destination_id.eq.${tripData.destination_id}`)
        : placesQuery.eq("destination_id", tripData.destination_id);
    }
  } else {
    console.log(`[generateItinerary] Querying only priorities (no destination ID found)`);
    if (placeIds.length > 0) {
      placesQuery = placesQuery.in("id", placeIds);
    } else {
      throw new Error("Trip destination is missing and no optional places were selected.");
    }
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

  const top30 = scored.slice(0, 30);
  const scoresByPlaceId = new Map(scored.map((s) => [s.id, s.score]));

  const orderedPlaces: SolverPlace[] = [];
  for (const s of top30) {
    const p = places.find((pl) => pl.id === s.id);
    if (p) {
      orderedPlaces.push({ ...p, score: s.score });
    }
  }

  if (orderedPlaces.length > 0) {
    console.log(`[generateItinerary] Scored ${scored.length} places. Top scoring place: ${orderedPlaces[0].name} (Score: ${orderedPlaces[0].score})`);
  } else {
    console.warn(`[generateItinerary] Scored ${scored.length} places but none matched our activity list!`);
  }

  console.log(`[generateItinerary] Sending ${orderedPlaces.length} ordered places to solver`);

  const travelMatrix = buildTravelMatrix(placeRows);

  const input: SolverInput = {
    places: orderedPlaces,
    mealPlaces,
    days,
    travelMatrix,
    config,
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

  await writeToSupabase(
    supabase,
    tripId,
    enrichedResult,
    days,
    scoresByPlaceId,
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

// --- Supabase write ---

async function writeToSupabase(
  supabase: AnySupabase,
  tripId: string,
  result: SolverResult,
  days: SolverDay[],
  scoresByPlaceId: Map<string, number>
) {
  // Clean up existing itineraries for this trip before writing new ones
  await supabase
    .from("itineraries")
    .delete()
    .eq("trip_id", tripId);

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
