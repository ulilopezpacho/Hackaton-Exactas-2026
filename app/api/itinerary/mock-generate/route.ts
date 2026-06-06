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
  } = body as {
    placeIds?: string[];
    city?: string;
    startsOn?: string;
    endsOn?: string;
    config?: Partial<SolverConfig>;
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

  const input: SolverInput = {
    places,
    mealPlaces,
    days,
    travelMatrix,
    config,
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
