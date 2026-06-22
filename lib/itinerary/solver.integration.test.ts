/**
 * Solver integration tests (fast — small inputs).
 *
 * Run:  npx jest lib/itinerary/solver.integration.test.ts
 */

import { solve } from "./solver";
import type {
  SolverPlace,
  SolverDay,
  SolverConfig,
  TravelMatrix,
  SolverResult,
} from "./types";

// ─── Helpers ────────────────────────────────────────

function constantTravelMatrix(ids: string[], minutes: number): TravelMatrix {
  const m: TravelMatrix = {};
  for (const a of ids) {
    m[a] = {};
    for (const b of ids) {
      m[a][b] = a === b ? 0 : minutes;
    }
  }
  return m;
}

function placedPlaceIds(result: SolverResult): Set<string> {
  const ids = new Set<string>();
  for (const d of result.days) {
    for (const item of d.items) {
      if (item.type === "place" && item.placeId) ids.add(item.placeId);
    }
  }
  return ids;
}

function placesPerDay(result: SolverResult, activityIds: string[]): number[] {
  const set = new Set(activityIds);
  return result.days.map(
    (d) => d.items.filter((i) => i.type === "place" && i.placeId && set.has(i.placeId)).length
  );
}

// ─── Shared fixtures ────────────────────────────────

const baseConfig: SolverConfig = {
  dayStartTime: 9 * 60,
  dayEndTime: 22 * 60,
  mealIntervalMinutes: 240,
};

const twoDays: SolverDay[] = [
  { date: "2026-06-15", dayOfWeek: 1 },
  { date: "2026-06-16", dayOfWeek: 2 },
];

const oneDay: SolverDay[] = [
  { date: "2026-06-15", dayOfWeek: 1 },
];

const alwaysOpen = (id: string, name: string, dur: number): SolverPlace => ({
  id, name, durationMinutes: dur, openingWindows: [],
});

const meal = (id: string, name: string, dur: number): SolverPlace => ({
  id, name, durationMinutes: dur,
  openingWindows: [
    { dayOfWeek: 1, opensAt: 600, closesAt: 1380 },
    { dayOfWeek: 2, opensAt: 600, closesAt: 1380 },
  ],
});

// ─── Tests ──────────────────────────────────────────

describe("Solver integration (small inputs)", () => {
  test("no overlaps or out-of-bounds items", () => {
    const places = [
      alwaysOpen("a", "Place A", 60),
      alwaysOpen("b", "Place B", 90),
      alwaysOpen("c", "Place C", 45),
    ];
    const meals = [meal("m1", "Meal 1", 60)];
    const allIds = [...places, ...meals].map((p) => p.id);
    const result = solve({
      places, mealPlaces: meals, days: twoDays,
      travelMatrix: constantTravelMatrix(allIds, 10),
      config: baseConfig,
    });

    for (const day of result.days) {
      for (let i = 1; i < day.items.length; i++) {
        expect(day.items[i].startMinute).toBeGreaterThanOrEqual(day.items[i - 1].endMinute);
      }
      for (const item of day.items) {
        expect(item.startMinute).toBeGreaterThanOrEqual(baseConfig.dayStartTime);
        expect(item.endMinute).toBeLessThanOrEqual(baseConfig.dayEndTime);
      }
    }
  });

  test("includes travel from the starting place before the first visit", () => {
    const place = alwaysOpen("destination", "Destination", 60);
    const result = solve({
      places: [place],
      mealPlaces: [],
      days: oneDay,
      travelMatrix: {
        origin: { destination: 35 },
        destination: { origin: 35, destination: 0 },
      },
      config: {
        ...baseConfig,
        dayEndTime: 12 * 60,
      },
      startPlaceId: "origin",
    });

    expect(result.days[0].items[0]).toMatchObject({
      type: "transfer",
      startMinute: baseConfig.dayStartTime,
      endMinute: baseConfig.dayStartTime + 35,
    });
    expect(result.days[0].items[1]).toMatchObject({
      placeId: "destination",
      startMinute: baseConfig.dayStartTime + 35,
    });
  });

  test("respects opening windows (Tuesday-only place)", () => {
    const tuesdayOnly: SolverPlace = {
      id: "tue-only", name: "Tuesday Only", durationMinutes: 60,
      openingWindows: [{ dayOfWeek: 2, opensAt: 600, closesAt: 1080 }],
    };
    const filler = alwaysOpen("filler", "Filler", 30);
    const allIds = [tuesdayOnly.id, filler.id];

    const result = solve({
      places: [tuesdayOnly, filler], mealPlaces: [], days: twoDays,
      travelMatrix: constantTravelMatrix(allIds, 5),
      config: baseConfig,
    });

    const placed = placedPlaceIds(result);
    expect(placed.has("tue-only")).toBe(true);

    const dayWithTue = result.days.find((d) =>
      d.items.some((i) => i.placeId === "tue-only")
    );
    expect(dayWithTue?.dayIndex).toBe(1); // Tuesday
  });

  test("balance penalty distributes 4 places evenly across 2 days", () => {
    const places = [
      alwaysOpen("p1", "P1", 60),
      alwaysOpen("p2", "P2", 60),
      alwaysOpen("p3", "P3", 60),
      alwaysOpen("p4", "P4", 60),
    ];
    const allIds = places.map((p) => p.id);

    const result = solve({
      places, mealPlaces: [], days: twoDays,
      travelMatrix: constantTravelMatrix(allIds, 5),
      config: baseConfig,
    });

    const perDay = placesPerDay(result, allIds);
    expect(result.unplacedPlaces).toHaveLength(0);
    expect(Math.abs(perDay[0] - perDay[1])).toBeLessThanOrEqual(1);
  });

  test("schedules mandatory meals anchored to their clock windows", () => {
    const places = [alwaysOpen("x", "Quick Visit", 60)];
    const meals = [meal("lunch", "Lunch Spot", 60), meal("dinner", "Dinner Spot", 60)];
    const allIds = [...places, ...meals].map((p) => p.id);

    const mealConfig: SolverConfig = {
      ...baseConfig,
      meals: [
        { label: "Almuerzo", opensAt: 12 * 60, closesAt: 14 * 60 + 30, durationMinutes: 60 },
        { label: "Cena", opensAt: 20 * 60, closesAt: 21 * 60 + 30, durationMinutes: 60 },
      ],
    };

    const result = solve({
      places, mealPlaces: meals, days: oneDay,
      travelMatrix: constantTravelMatrix(allIds, 5),
      config: mealConfig,
    });

    const mealItems = result.days[0].items.filter(
      (i) => i.type === "place" && i.placeId && i.placeId !== "x"
    );
    // Both mandatory meals are scheduled, each within its window.
    expect(mealItems.length).toBe(2);

    const lunch = result.days[0].items.find((i) => i.title.startsWith("Almuerzo"))!;
    expect(lunch.startMinute).toBeGreaterThanOrEqual(12 * 60);
    expect(lunch.startMinute).toBeLessThanOrEqual(14 * 60 + 30);

    const dinner = result.days[0].items.find((i) => i.title.startsWith("Cena"))!;
    expect(dinner.startMinute).toBeGreaterThanOrEqual(20 * 60);
    expect(dinner.startMinute).toBeLessThanOrEqual(21 * 60 + 30);
  });

  test("returns to the depot before the arrival deadline each day", () => {
    const places = [
      alwaysOpen("p1", "P1", 60),
      alwaysOpen("p2", "P2", 60),
      alwaysOpen("p3", "P3", 60),
    ];
    const allIds = ["hotel", ...places.map((p) => p.id)];

    const result = solve({
      places,
      mealPlaces: [],
      days: twoDays,
      travelMatrix: constantTravelMatrix(allIds, 20),
      config: baseConfig,
      startPlaceId: "hotel",
      endPlaceId: "hotel",
    });

    for (const day of result.days) {
      if (day.items.length === 0) continue;

      // First leg leaves the hotel at the start of the day.
      expect(day.items[0]).toMatchObject({
        type: "transfer",
        startMinute: baseConfig.dayStartTime,
      });

      // Last leg is the return transfer to the hotel, arriving before the deadline.
      const last = day.items[day.items.length - 1];
      expect(last.type).toBe("transfer");
      expect(last.endMinute).toBeLessThanOrEqual(baseConfig.dayEndTime);
    }
  });

  test("empty places returns valid empty result", () => {
    const result = solve({
      places: [], mealPlaces: [], days: twoDays,
      travelMatrix: {},
      config: baseConfig,
    });

    expect(result.days).toHaveLength(2);
    expect(result.score).toBe(0);
    expect(result.unplacedPlaces).toHaveLength(0);
  });

  test("all places accounted for (placed or unplaced)", () => {
    const places = [
      alwaysOpen("a", "A", 60),
      alwaysOpen("b", "B", 120),
      {
        id: "impossible", name: "Impossible", durationMinutes: 30,
        openingWindows: [{ dayOfWeek: 3, opensAt: 600, closesAt: 1200 }],
      } as SolverPlace,
    ];
    const allIds = places.map((p) => p.id);

    const result = solve({
      places, mealPlaces: [], days: twoDays,
      travelMatrix: constantTravelMatrix(allIds, 5),
      config: baseConfig,
    });

    const placed = placedPlaceIds(result);
    const unplaced = new Set(result.unplacedPlaces);
    for (const p of places) {
      expect(placed.has(p.id) || unplaced.has(p.id)).toBe(true);
    }
    expect(unplaced.has("impossible")).toBe(true);
  });

  test("performance: 4 places + 1 meal + 2 days finishes in < 5s", () => {
    const places = [
      alwaysOpen("p1", "P1", 60),
      alwaysOpen("p2", "P2", 90),
      alwaysOpen("p3", "P3", 45),
      alwaysOpen("p4", "P4", 75),
    ];
    const meals = [meal("m1", "M1", 60)];
    const allIds = [...places, ...meals].map((p) => p.id);

    const t0 = Date.now();
    const result = solve({
      places, mealPlaces: meals, days: twoDays,
      travelMatrix: constantTravelMatrix(allIds, 8),
      config: baseConfig,
    });
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(5000);
    expect(result.score).toBeGreaterThan(0);
  });

  test("priority levels: keeps higher-priority places when the day is tight", () => {
    // Scores mirror lib/places/priority.ts bases: must=100000, like=2000, maybe=0.
    const scored = (id: string, score: number): SolverPlace => ({
      id,
      name: id,
      durationMinutes: 120,
      openingWindows: [],
      score,
    });
    const must = scored("must", 100_000);
    const like = scored("like", 2_000);
    const maybe = scored("maybe", 0);
    const allIds = [must.id, like.id, maybe.id];

    const result = solve({
      // Intentionally unordered: the score, not the input order, must decide.
      places: [maybe, like, must],
      mealPlaces: [],
      days: oneDay,
      travelMatrix: constantTravelMatrix(allIds, 30),
      // 09:00–13:30 with 120-min visits + 30-min hops fits exactly two activities.
      config: { ...baseConfig, dayEndTime: 13 * 60 + 30 },
    });

    const placed = placedPlaceIds(result);
    expect(placed.has("must")).toBe(true); // must-go always survives
    expect(placed.has("like")).toBe(true); // like beats maybe for the 2nd slot
    expect(placed.has("maybe")).toBe(false);
    expect(result.unplacedPlaces).toContain("maybe");
  });

  test("meal variety: uses both available meal places", () => {
    const places = [
      alwaysOpen("a", "A", 60),
      alwaysOpen("b", "B", 60),
    ];
    const meals = [
      meal("m1", "Meal A", 60),
      meal("m2", "Meal B", 60),
    ];
    const allIds = [...places, ...meals].map((p) => p.id);

    const result = solve({
      places, mealPlaces: meals, days: twoDays,
      travelMatrix: constantTravelMatrix(allIds, 5),
      config: baseConfig,
    });

    const mealIds = new Set<string>();
    for (const d of result.days) {
      for (const i of d.items) {
        if (i.type === "place" && i.placeId && (i.placeId === "m1" || i.placeId === "m2")) {
          mealIds.add(i.placeId);
        }
      }
    }
    expect(mealIds.size).toBeGreaterThanOrEqual(2);
  });
});
