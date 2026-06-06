import type {
  SolverInput,
  SolverResult,
  SolverPlace,
  SolverDay,
  SolverConfig,
  TravelMatrix,
  ScheduledItem,
  DaySchedule,
  OpeningWindow,
} from "./types";

const TIMEOUT_MS = 30_000;

export function solve(input: SolverInput): SolverResult {
  const { places, days, config } = input;
  const numPlaces = places.length;
  const numDays = days.length;

  if (numPlaces === 0) {
    return {
      days: days.map((_, i) => ({ dayIndex: i, items: [] })),
      score: 0,
      unplacedPlaces: [],
    };
  }

  let bestResult: SolverResult | null = null;
  const startTime = Date.now();
  const dayAssignments = new Array<number>(numPlaces).fill(-1);
  const dayDurationSums = new Array<number>(numDays).fill(0);

  function backtrack(placeIndex: number) {
    if (Date.now() - startTime > TIMEOUT_MS) return;

    if (placeIndex === numPlaces) {
      const result = buildFullSchedule(dayAssignments, input);
      if (result && (!bestResult || result.score > bestResult.score)) {
        bestResult = result;
      }
      return;
    }

    const place = places[placeIndex];
    const availableMinutes = config.dayEndTime - config.dayStartTime;

    for (let d = 0; d < numDays; d++) {
      if (dayDurationSums[d] + place.durationMinutes > availableMinutes) continue;

      if (!hasOpenWindow(place, days[d].dayOfWeek)) continue;

      dayAssignments[placeIndex] = d;
      dayDurationSums[d] += place.durationMinutes;
      backtrack(placeIndex + 1);
      dayDurationSums[d] -= place.durationMinutes;
    }

    dayAssignments[placeIndex] = -1;
    backtrack(placeIndex + 1);
  }

  backtrack(0);

  return (
    bestResult ?? {
      days: days.map((_, i) => ({ dayIndex: i, items: [] })),
      score: 0,
      unplacedPlaces: places.map((p) => p.id),
    }
  );
}

// --- Schedule builder ---

function buildFullSchedule(
  dayAssignments: number[],
  input: SolverInput
): SolverResult | null {
  const { places, mealPlaces, days, travelMatrix, config } = input;

  const dayPlaceLists: SolverPlace[][] = days.map(() => []);
  const skipped: string[] = [];

  for (let i = 0; i < places.length; i++) {
    if (dayAssignments[i] === -1) {
      skipped.push(places[i].id);
    } else {
      dayPlaceLists[dayAssignments[i]].push(places[i]);
    }
  }

  const resultDays: DaySchedule[] = [];
  let totalTravel = 0;
  const usedMealPlaceIds: string[] = [];

  for (let d = 0; d < days.length; d++) {
    const dayResult = findBestDaySchedule(
      dayPlaceLists[d],
      d,
      days[d],
      mealPlaces,
      travelMatrix,
      config,
      usedMealPlaceIds
    );
    if (!dayResult) return null;

    resultDays.push(dayResult.schedule);
    totalTravel += dayResult.totalTravel;
    usedMealPlaceIds.push(...dayResult.mealPlaceIdsUsed);
  }

  let score = 0;
  const placesAssigned = places.length - skipped.length;
  score += placesAssigned * 1000;

  for (let i = 0; i < places.length; i++) {
    if (dayAssignments[i] !== -1) {
      score += (places.length - i) * 10;
    }
  }

  score -= totalTravel;

  const mealCounts: Record<string, number> = {};
  for (const id of usedMealPlaceIds) {
    mealCounts[id] = (mealCounts[id] || 0) + 1;
  }
  for (const id of Object.keys(mealCounts)) {
    if (mealCounts[id] > 1) score -= (mealCounts[id] - 1) * 50;
  }

  // Penalize unbalanced day distribution (squared deviation from mean)
  if (days.length > 1 && placesAssigned > 0) {
    const avg = placesAssigned / days.length;
    let balancePenalty = 0;
    for (const dayPlaces of dayPlaceLists) {
      balancePenalty += (dayPlaces.length - avg) ** 2;
    }
    score -= Math.round(balancePenalty * 150);
  }

  return { days: resultDays, score, unplacedPlaces: skipped };
}

// --- Per-day scheduling ---

function findBestDaySchedule(
  places: SolverPlace[],
  dayIndex: number,
  day: SolverDay,
  mealPlaces: SolverPlace[],
  travelMatrix: TravelMatrix,
  config: SolverConfig,
  usedMealPlaceIds: string[]
): {
  schedule: DaySchedule;
  totalTravel: number;
  mealPlaceIdsUsed: string[];
} | null {
  if (places.length === 0) {
    return {
      schedule: { dayIndex, items: [] },
      totalTravel: 0,
      mealPlaceIdsUsed: [],
    };
  }

  let best: {
    schedule: DaySchedule;
    totalTravel: number;
    mealPlaceIdsUsed: string[];
  } | null = null;

  for (const perm of permutations(places)) {
    const result = scheduleDayInOrder(
      perm,
      dayIndex,
      day,
      mealPlaces,
      travelMatrix,
      config,
      usedMealPlaceIds
    );
    if (result && (!best || result.totalTravel < best.totalTravel)) {
      best = result;
    }
  }

  return best;
}

function scheduleDayInOrder(
  orderedPlaces: SolverPlace[],
  dayIndex: number,
  day: SolverDay,
  mealPlaces: SolverPlace[],
  travelMatrix: TravelMatrix,
  config: SolverConfig,
  globalUsedMealIds: string[]
): {
  schedule: DaySchedule;
  totalTravel: number;
  mealPlaceIdsUsed: string[];
} | null {
  const items: ScheduledItem[] = [];
  let currentTime = config.dayStartTime;
  let lastMealTime = config.dayStartTime;
  let lastPlaceId: string | null = null;
  let totalTravel = 0;
  const mealIdsUsed: string[] = [];

  for (const place of orderedPlaces) {
    if (currentTime - lastMealTime >= config.mealIntervalMinutes) {
      const mealResult = insertMealPlace(
        items,
        currentTime,
        lastPlaceId,
        day,
        mealPlaces,
        travelMatrix,
        config,
        [...globalUsedMealIds, ...mealIdsUsed]
      );
      if (mealResult) {
        currentTime = mealResult.newTime;
        lastMealTime = currentTime;
        lastPlaceId = mealResult.lastPlaceId;
        totalTravel += mealResult.travelMinutes;
        if (mealResult.mealPlaceId) mealIdsUsed.push(mealResult.mealPlaceId);
      }
    }

    const travel = getTravelTime(travelMatrix, lastPlaceId, place.id);
    if (travel > 0) {
      items.push({
        type: "transfer",
        placeId: null,
        title: "Traslado",
        startMinute: currentTime,
        endMinute: currentTime + travel,
      });
      currentTime += travel;
      totalTravel += travel;
    }

    const window = findOpenWindow(place, day.dayOfWeek, currentTime);
    if (!window) return null;

    const placeStart = Math.max(currentTime, window.opensAt);

    if (placeStart > currentTime) {
      items.push({
        type: "recommendation",
        placeId: null,
        title: "Tiempo libre",
        startMinute: currentTime,
        endMinute: placeStart,
      });
      currentTime = placeStart;
    }

    const placeEnd = currentTime + place.durationMinutes;
    if (placeEnd > window.closesAt || placeEnd > config.dayEndTime) return null;

    items.push({
      type: "place",
      placeId: place.id,
      title: place.name,
      startMinute: currentTime,
      endMinute: placeEnd,
    });

    currentTime = placeEnd;
    lastPlaceId = place.id;
  }

  // Fill remaining day with meals at regular intervals
  while (config.dayEndTime - currentTime >= 30) {
    const nextMealDue = lastMealTime + config.mealIntervalMinutes;
    if (nextMealDue >= config.dayEndTime) break;

    if (currentTime < nextMealDue) {
      items.push({
        type: "recommendation",
        placeId: null,
        title: "Tiempo libre",
        startMinute: currentTime,
        endMinute: nextMealDue,
      });
      currentTime = nextMealDue;
    }

    const mealResult = insertMealPlace(
      items,
      currentTime,
      lastPlaceId,
      day,
      mealPlaces,
      travelMatrix,
      config,
      [...globalUsedMealIds, ...mealIdsUsed]
    );
    if (!mealResult) break;

    currentTime = mealResult.newTime;
    lastMealTime = currentTime;
    lastPlaceId = mealResult.lastPlaceId;
    totalTravel += mealResult.travelMinutes;
    if (mealResult.mealPlaceId) mealIdsUsed.push(mealResult.mealPlaceId);
  }

  if (currentTime < config.dayEndTime) {
    items.push({
      type: "recommendation",
      placeId: null,
      title: "Tiempo libre",
      startMinute: currentTime,
      endMinute: config.dayEndTime,
    });
  }

  return {
    schedule: { dayIndex, items },
    totalTravel,
    mealPlaceIdsUsed: mealIdsUsed,
  };
}

// --- Meal insertion ---

function getMealLabel(timeMinutes: number): string {
  if (timeMinutes < 15 * 60) return "Almuerzo";
  if (timeMinutes < 18 * 60 + 30) return "Merienda";
  return "Cena";
}

function insertMealPlace(
  items: ScheduledItem[],
  currentTime: number,
  lastPlaceId: string | null,
  day: SolverDay,
  mealPlaces: SolverPlace[],
  travelMatrix: TravelMatrix,
  config: SolverConfig,
  usedMealIds: string[]
): {
  newTime: number;
  lastPlaceId: string | null;
  travelMinutes: number;
  mealPlaceId: string | null;
} | null {
  let bestPlace: SolverPlace | null = null;
  let bestCost = Infinity;

  for (const mp of mealPlaces) {
    const travel = getTravelTime(travelMatrix, lastPlaceId, mp.id);
    const arrival = currentTime + travel;

    const w = findOpenWindow(mp, day.dayOfWeek, arrival);
    if (!w) continue;

    const start = Math.max(arrival, w.opensAt);
    if (start + mp.durationMinutes > w.closesAt) continue;
    if (start + mp.durationMinutes > config.dayEndTime) continue;

    const usageCount = usedMealIds.filter((id) => id === mp.id).length;
    const cost = travel + usageCount * 30;

    if (cost < bestCost) {
      bestCost = cost;
      bestPlace = mp;
    }
  }

  if (!bestPlace) {
    const label = getMealLabel(currentTime);
    const duration = label === "Merienda" ? 30 : 60;
    if (currentTime + duration > config.dayEndTime) return null;

    items.push({
      type: "recommendation",
      placeId: null,
      title: label,
      startMinute: currentTime,
      endMinute: currentTime + duration,
    });
    return {
      newTime: currentTime + duration,
      lastPlaceId,
      travelMinutes: 0,
      mealPlaceId: null,
    };
  }

  const travel = getTravelTime(travelMatrix, lastPlaceId, bestPlace.id);
  let time = currentTime;

  if (travel > 0) {
    items.push({
      type: "transfer",
      placeId: null,
      title: "Traslado",
      startMinute: time,
      endMinute: time + travel,
    });
    time += travel;
  }

  const w = findOpenWindow(bestPlace, day.dayOfWeek, time)!;
  if (time < w.opensAt) {
    items.push({
      type: "recommendation",
      placeId: null,
      title: "Tiempo libre",
      startMinute: time,
      endMinute: w.opensAt,
    });
    time = w.opensAt;
  }

  const label = getMealLabel(time);
  items.push({
    type: "place",
    placeId: bestPlace.id,
    title: `${label} — ${bestPlace.name}`,
    startMinute: time,
    endMinute: time + bestPlace.durationMinutes,
  });
  time += bestPlace.durationMinutes;

  return {
    newTime: time,
    lastPlaceId: bestPlace.id,
    travelMinutes: travel,
    mealPlaceId: bestPlace.id,
  };
}

// --- Helpers ---

function getTravelTime(
  matrix: TravelMatrix,
  fromId: string | null,
  toId: string
): number {
  if (!fromId) return 0;
  return matrix[fromId]?.[toId] ?? 0;
}

function hasOpenWindow(place: SolverPlace, dayOfWeek: number): boolean {
  if (place.openingWindows.length === 0) return true;
  return place.openingWindows.some((w) => w.dayOfWeek === dayOfWeek);
}

function findOpenWindow(
  place: SolverPlace,
  dayOfWeek: number,
  earliestArrival: number
): OpeningWindow | null {
  if (place.openingWindows.length === 0) {
    return { dayOfWeek, opensAt: 0, closesAt: 24 * 60 };
  }

  const todayWindows = place.openingWindows
    .filter((w) => w.dayOfWeek === dayOfWeek)
    .sort((a, b) => a.opensAt - b.opensAt);

  for (const w of todayWindows) {
    const start = Math.max(earliestArrival, w.opensAt);
    if (start + place.durationMinutes <= w.closesAt) {
      return w;
    }
  }

  return null;
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [[...arr]];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}
