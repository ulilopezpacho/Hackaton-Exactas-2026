import { createClient } from "@/lib/supabase/server";
import { solve } from "./solver";
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
  category: string | null;
  default_duration_minutes: number | null;
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
  const supabase: AnySupabase = await createClient();
  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("starts_on, ends_on")
    .eq("id", tripId)
    .single();
  if (tripError || !trip) throw new Error(`Trip not found: ${tripId}`);

  const tripData = trip as { starts_on: string; ends_on: string };
  const days = buildDays(tripData.starts_on, tripData.ends_on);

  const { data: placesRaw, error: placesError } = await supabase
    .from("places")
    .select("id, name, category, default_duration_minutes, location")
    .in("id", placeIds)
    .eq("status", "active");
  if (placesError) throw new Error(`Failed to fetch places: ${placesError.message}`);

  const placeRows = (placesRaw ?? []) as PlaceRow[];
  const allPlaceIds = placeRows.map((p) => p.id);

  const { data: windowsRaw, error: windowsError } = await supabase
    .from("place_opening_windows")
    .select("place_id, day_of_week, opens_at, closes_at")
    .in("place_id", allPlaceIds);
  if (windowsError)
    throw new Error(`Failed to fetch opening windows: ${windowsError.message}`);

  const windowRows = (windowsRaw ?? []) as WindowRow[];
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

  const orderedPlaces = placeIds
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is SolverPlace => p != null);

  const travelMatrix = buildTravelMatrix(placeRows);

  const input: SolverInput = {
    places: orderedPlaces,
    mealPlaces,
    days,
    travelMatrix,
    config,
  };

  const result = solve(input);

  await writeToSupabase(supabase, tripId, result, days);

  return result;
}

// --- Helpers ---

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

// --- Supabase write ---

async function writeToSupabase(
  supabase: AnySupabase,
  tripId: string,
  result: SolverResult,
  days: SolverDay[]
) {
  for (const daySchedule of result.days) {
    const { data: itinerary, error: itinError } = await supabase
      .from("itineraries")
      .insert({
        trip_id: tripId,
        day_number: daySchedule.dayIndex + 1,
        status: "draft",
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
      starts_at: `${dayDate}T${minutesToTime(item.startMinute)}:00`,
      ends_at: `${dayDate}T${minutesToTime(item.endMinute)}:00`,
      position,
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
}
