/**
 * Solver STRESS tests — larger inputs with real mock data.
 *
 * Run manually:  npx jest solver.stress --testTimeout=60000
 *
 * NOT included in the default `npm test` because they can take 10-30s.
 */

import { solve } from "./solver";
import { MOCK_PLACES_MADRID, MOCK_PLACES_PARIS, type MockPlace } from "./mock-data";
import type {
  SolverInput,
  SolverPlace,
  SolverDay,
  SolverConfig,
  TravelMatrix,
  SolverResult,
} from "./types";

// ─── Helpers ────────────────────────────────────────

const MEAL_CATEGORIES = ["restaurante", "café", "cafetería", "bar", "gastro"];
const WALKING_SPEED_KMH = 5;

function isMealCategory(cat: string): boolean {
  return MEAL_CATEGORIES.some((mc) => cat.toLowerCase().includes(mc));
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

function buildTravelMatrix(places: MockPlace[]): TravelMatrix {
  const m: TravelMatrix = {};
  for (const a of places) {
    m[a.id] = {};
    for (const b of places) {
      if (a.id === b.id) m[a.id][b.id] = 0;
      else m[a.id][b.id] = Math.ceil((haversineKm(a.lat, a.lng, b.lat, b.lng) / WALKING_SPEED_KMH) * 60);
    }
  }
  return m;
}

function splitPlaces(mocks: MockPlace[]): { places: SolverPlace[]; mealPlaces: SolverPlace[] } {
  const places: SolverPlace[] = [];
  const mealPlaces: SolverPlace[] = [];
  for (const mp of mocks) {
    const sp: SolverPlace = {
      id: mp.id, name: mp.name,
      durationMinutes: mp.durationMinutes, openingWindows: mp.openingWindows,
    };
    if (isMealCategory(mp.category)) mealPlaces.push(sp);
    else places.push(sp);
  }
  return { places, mealPlaces };
}

/** Validate all structural invariants on a SolverResult. */
function validateStructure(result: SolverResult, config: SolverConfig, activityIds: string[]) {
  for (const day of result.days) {
    for (let i = 1; i < day.items.length; i++) {
      expect(day.items[i].startMinute).toBeGreaterThanOrEqual(day.items[i - 1].endMinute);
    }
    for (const item of day.items) {
      expect(item.startMinute).toBeGreaterThanOrEqual(config.dayStartTime);
      expect(item.endMinute).toBeLessThanOrEqual(config.dayEndTime);
    }
  }

  const placed = new Set<string>();
  for (const d of result.days) {
    for (const item of d.items) {
      if (item.type === "place" && item.placeId) placed.add(item.placeId);
    }
  }
  const unplaced = new Set(result.unplacedPlaces);
  for (const id of activityIds) {
    expect(placed.has(id) || unplaced.has(id)).toBe(true);
  }

  // No activity duplicated across days
  const placeDay = new Map<string, number>();
  for (const day of result.days) {
    for (const item of day.items) {
      if (item.type === "place" && item.placeId && activityIds.includes(item.placeId)) {
        if (placeDay.has(item.placeId)) {
          expect(placeDay.get(item.placeId)).toBe(day.dayIndex);
        }
        placeDay.set(item.placeId, day.dayIndex);
      }
    }
  }
}

// ─── Tests ──────────────────────────────────────────

describe("Solver stress (larger inputs)", () => {
  const longTimeout = 45_000;

  test("Madrid: 6 places + 3 meals across 3 days", () => {
    const selectedIds = ["palacio-real", "plaza-mayor", "prado", "retiro", "reina-sofia", "gran-via"];
    const selectedMocks = MOCK_PLACES_MADRID.filter(
      (p) => selectedIds.includes(p.id) || isMealCategory(p.category)
    );
    const { places, mealPlaces } = splitPlaces(selectedMocks);
    const travelMatrix = buildTravelMatrix(selectedMocks);

    const days: SolverDay[] = [
      { date: "2026-06-12", dayOfWeek: 5 },
      { date: "2026-06-13", dayOfWeek: 6 },
      { date: "2026-06-14", dayOfWeek: 0 },
    ];
    const config: SolverConfig = { dayStartTime: 540, dayEndTime: 1320, mealIntervalMinutes: 240 };
    const input: SolverInput = { places, mealPlaces, days, travelMatrix, config };

    const t0 = Date.now();
    const result = solve(input);
    const elapsed = Date.now() - t0;

    validateStructure(result, config, selectedIds);

    expect(result.score).toBeGreaterThan(0);

    const placedCount = selectedIds.length - result.unplacedPlaces.length;
    expect(placedCount).toBeGreaterThanOrEqual(4);

    // Balance: no day has > 3 activities
    const perDay = days.map((_, di) =>
      result.days[di].items.filter((i) => i.type === "place" && i.placeId && selectedIds.includes(i.placeId)).length
    );
    expect(Math.max(...perDay)).toBeLessThanOrEqual(3);

    // At least one meal inserted
    const totalMeals = result.days.reduce(
      (s, d) => s + d.items.filter((i) => i.type === "place" && i.placeId && !selectedIds.includes(i.placeId)).length, 0
    );
    expect(totalMeals).toBeGreaterThanOrEqual(1);

    expect(elapsed).toBeLessThan(longTimeout);
  }, longTimeout);

  test("Paris: 7 places + 3 meals across 3 days", () => {
    const selectedIds = [
      "tour-eiffel", "notre-dame", "sacre-coeur", "montmartre",
      "champs-elysees", "arc-triomphe", "jardin-luxembourg",
    ];
    const selectedMocks = MOCK_PLACES_PARIS.filter(
      (p) => selectedIds.includes(p.id) || isMealCategory(p.category)
    );
    const { places, mealPlaces } = splitPlaces(selectedMocks);
    const travelMatrix = buildTravelMatrix(selectedMocks);

    const days: SolverDay[] = [
      { date: "2026-06-15", dayOfWeek: 1 },
      { date: "2026-06-16", dayOfWeek: 2 },
      { date: "2026-06-17", dayOfWeek: 3 },
    ];
    const config: SolverConfig = { dayStartTime: 540, dayEndTime: 1320, mealIntervalMinutes: 240 };
    const input: SolverInput = { places, mealPlaces, days, travelMatrix, config };

    const t0 = Date.now();
    const result = solve(input);
    const elapsed = Date.now() - t0;

    validateStructure(result, config, selectedIds);

    expect(result.score).toBeGreaterThan(0);

    const placedCount = selectedIds.length - result.unplacedPlaces.length;
    expect(placedCount).toBeGreaterThanOrEqual(5);

    const perDay = days.map((_, di) =>
      result.days[di].items.filter((i) => i.type === "place" && i.placeId && selectedIds.includes(i.placeId)).length
    );
    expect(Math.max(...perDay) - Math.min(...perDay)).toBeLessThanOrEqual(2);

    // Uses at least 2 distinct meal places
    const mealPlaceIds = new Set<string>();
    for (const d of result.days) {
      for (const i of d.items) {
        if (i.type === "place" && i.placeId && !selectedIds.includes(i.placeId)) {
          mealPlaceIds.add(i.placeId);
        }
      }
    }
    expect(mealPlaceIds.size).toBeGreaterThanOrEqual(2);

    expect(elapsed).toBeLessThan(longTimeout);
  }, longTimeout);

  test("Madrid: 5 places in tight 6-hour days", () => {
    const selectedIds = ["palacio-real", "prado", "retiro", "plaza-mayor", "gran-via"];
    const selectedMocks = MOCK_PLACES_MADRID.filter(
      (p) => selectedIds.includes(p.id) || isMealCategory(p.category)
    );
    const { places, mealPlaces } = splitPlaces(selectedMocks);
    const travelMatrix = buildTravelMatrix(selectedMocks);

    const days: SolverDay[] = [
      { date: "2026-06-16", dayOfWeek: 2 },
      { date: "2026-06-17", dayOfWeek: 3 },
    ];
    const config: SolverConfig = { dayStartTime: 600, dayEndTime: 960, mealIntervalMinutes: 240 };
    const input: SolverInput = { places, mealPlaces, days, travelMatrix, config };

    const t0 = Date.now();
    const result = solve(input);
    const elapsed = Date.now() - t0;

    validateStructure(result, config, selectedIds);

    const placedCount = selectedIds.length - result.unplacedPlaces.length;
    expect(placedCount).toBeGreaterThanOrEqual(3);

    // No single 6h day should have > 3 activities
    const perDay = days.map((_, di) =>
      result.days[di].items.filter((i) => i.type === "place" && i.placeId && selectedIds.includes(i.placeId)).length
    );
    expect(Math.max(...perDay)).toBeLessThanOrEqual(3);

    // All items respect the tight dayEnd
    for (const day of result.days) {
      for (const item of day.items) {
        expect(item.endMinute).toBeLessThanOrEqual(config.dayEndTime);
      }
    }

    expect(elapsed).toBeLessThan(longTimeout);
  }, longTimeout);
});
