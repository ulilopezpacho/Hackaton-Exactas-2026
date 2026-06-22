import { NextResponse } from "next/server";
import { solve } from "@/lib/itinerary/solver";
import { buildDays } from "@/lib/itinerary/generate";
import { MOCK_PLACES, MOCK_CITIES, MOCK_TRIP, type MockPlace } from "@/lib/itinerary/mock-data";
import type { SolverInput, SolverPlace, SolverConfig, TravelMatrix } from "@/lib/itinerary/types";

const MEAL_CATEGORIES = ["restaurante", "café", "cafetería", "bar", "gastro"];
const WALKING_SPEED_KMH = 5;

const DEFAULT_CONFIG: SolverConfig = {
  dayStartTime: 9 * 60,
  dayEndTime: 22 * 60,
  mealIntervalMinutes: 240,
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const {
    placeIds,
    city,
    startsOn = MOCK_TRIP.startsOn,
    endsOn = MOCK_TRIP.endsOn,
    config: configOverrides,
    startPlaceId,
    endPlaceId,
    depot,
  } = body as {
    placeIds?: string[];
    city?: string;
    startsOn?: string;
    endsOn?: string;
    config?: Partial<SolverConfig>;
    startPlaceId?: string | null;
    endPlaceId?: string | null;
    depot?: "centroid"; // convenience: anchor every day at the catalog centroid
  };

  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  const cityKey = city?.toLowerCase() ?? "madrid";
  const cityPlaces = MOCK_CITIES[cityKey];
  if (!cityPlaces) {
    return NextResponse.json(
      { error: "Unknown city. Available: " + Object.keys(MOCK_CITIES).join(", ") },
      { status: 400 }
    );
  }

  const filtered: MockPlace[] = placeIds
    ? cityPlaces.filter((p) => placeIds.includes(p.id))
    : cityPlaces;

  if (filtered.length === 0) {
    return NextResponse.json(
      {
        error: "No places matched. Available IDs: " + cityPlaces.map((p) => p.id).join(", "),
      },
      { status: 400 }
    );
  }

  const days = buildDays(startsOn, endsOn);

  const places: SolverPlace[] = [];
  const mealPlaces: SolverPlace[] = [];

  for (const mp of filtered) {
    const sp: SolverPlace = {
      id: mp.id,
      name: mp.name,
      durationMinutes: mp.durationMinutes,
      openingWindows: mp.openingWindows,
    };

    const isMeal = MEAL_CATEGORIES.some((mc) =>
      mp.category.toLowerCase().includes(mc)
    );

    if (isMeal) {
      mealPlaces.push(sp);
    } else {
      places.push(sp);
    }
  }

  const travelMatrix = buildMockTravelMatrix(filtered);

  // Optional depot ("hotel"): either an explicit place id from the request, or
  // the catalog centroid when `depot: "centroid"` is passed.
  let resolvedStart = startPlaceId ?? null;
  let resolvedEnd = endPlaceId ?? null;
  if (depot === "centroid") {
    const depotId = addCentroidDepot(travelMatrix, filtered);
    resolvedStart = depotId;
    resolvedEnd = depotId;
  }

  const input: SolverInput = {
    places,
    mealPlaces,
    days,
    travelMatrix,
    config,
    startPlaceId: resolvedStart,
    endPlaceId: resolvedEnd,
  };

  const t0 = Date.now();
  const result = solve(input);
  const elapsed = Date.now() - t0;

  return NextResponse.json({
    ...result,
    meta: {
      elapsedMs: elapsed,
      placesCount: places.length,
      mealPlacesCount: mealPlaces.length,
      daysCount: days.length,
      config,
      city: cityKey,
      availablePlaceIds: cityPlaces.map((p) => ({ id: p.id, name: p.name, category: p.category })),
    },
  });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

const MOCK_DEPOT_ID = "__depot__";

function addCentroidDepot(matrix: TravelMatrix, places: MockPlace[]): string {
  const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
  const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
  matrix[MOCK_DEPOT_ID] = { [MOCK_DEPOT_ID]: 0 };
  for (const p of places) {
    const minutes = Math.ceil((haversineKm(lat, lng, p.lat, p.lng) / WALKING_SPEED_KMH) * 60);
    matrix[MOCK_DEPOT_ID][p.id] = minutes;
    (matrix[p.id] ??= {})[MOCK_DEPOT_ID] = minutes;
  }
  return MOCK_DEPOT_ID;
}

function buildMockTravelMatrix(places: MockPlace[]): TravelMatrix {
  const matrix: TravelMatrix = {};
  for (const a of places) {
    matrix[a.id] = {};
    for (const b of places) {
      if (a.id === b.id) {
        matrix[a.id][b.id] = 0;
      } else {
        const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
        matrix[a.id][b.id] = Math.ceil((km / WALKING_SPEED_KMH) * 60);
      }
    }
  }
  return matrix;
}
