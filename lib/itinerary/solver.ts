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

export function solve(input: SolverInput): SolverResult {
  const { places, days, config } = input;
  const numPlaces = places.length;
  const numDays = days.length;

  console.log(`[solve] Starting Greedy Constructive. Places: ${numPlaces}, Days: ${numDays}`);

  if (numPlaces === 0) {
    return {
      days: days.map((_, i) => ({ dayIndex: i, items: [] })),
      score: 0,
      unplacedPlaces: [],
    };
  }

  const dayPlaceLists: SolverPlace[][] = days.map(() => []);
  const skipped: string[] = [];
  const globalUsedMealIds: string[] = [];

  // Sort places by score descending (they usually are, but let's be safe)
  const sortedPlaces = [...places].sort((a, b) => (b.score || 0) - (a.score || 0));

  for (const place of sortedPlaces) {
    let bestDay = -1;
    let bestDayScore = -Infinity;
    let bestDayResult: { totalTravel: number; mealPlaceIdsUsed: string[] } | null = null;

    for (let d = 0; d < numDays; d++) {
      // 1. Basic opening window prune
      if (!hasOpenWindow(place, days[d].dayOfWeek)) continue;

      // 2. Try adding to this day
      dayPlaceLists[d].push(place);
      
      // We simulate the day's schedule
      const dayResult = findBestDaySchedule(
        dayPlaceLists[d],
        d,
        days[d],
        input.mealPlaces,
        input.travelMatrix,
        config,
        globalUsedMealIds
      );
      
      dayPlaceLists[d].pop(); // Backtrack

      if (dayResult) {
        // Heuristic: favor higher place scores, lower travel time, and balanced distribution
        const travelIncrease = dayResult.totalTravel;
        const balancePenalty = dayPlaceLists[d].length * 15; // Penalize crowded days
        
        const score = (place.score || 50) - (travelIncrease / 10) - balancePenalty;

        if (score > bestDayScore) {
          bestDayScore = score;
          bestDay = d;
          bestDayResult = dayResult;
        }
      }
    }

    if (bestDay !== -1 && bestDayResult) {
      dayPlaceLists[bestDay].push(place);
    } else {
      skipped.push(place.id);
    }
  }

  // Final assembly
  const resultDays: DaySchedule[] = [];
  let totalTravel = 0;
  const finalUsedMealIds: string[] = [];

  for (let d = 0; d < numDays; d++) {
    const dayResult = findBestDaySchedule(
      dayPlaceLists[d],
      d,
      days[d],
      input.mealPlaces,
      input.travelMatrix,
      config,
      finalUsedMealIds
    );
    
    if (dayResult) {
      resultDays.push(dayResult.schedule);
      totalTravel += dayResult.totalTravel;
      finalUsedMealIds.push(...dayResult.mealPlaceIdsUsed);
    } else {
      resultDays.push({ dayIndex: d, items: [] });
    }
  }

  // Calculate final score
  let finalScore = (numPlaces - skipped.length) * 1000;
  for (const dayList of dayPlaceLists) {
    for (const p of dayList) finalScore += p.score || 50;
  }
  finalScore -= totalTravel;

  console.log(`[solve] Finished. Assigned: ${numPlaces - skipped.length}/${numPlaces}. Score: ${finalScore}`);

  return { days: resultDays, score: finalScore, unplacedPlaces: skipped };
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

  // Use a greedy nearest-neighbor approach instead of exhaustive permutations
  const unvisited = [...places];
  const ordered: SolverPlace[] = [];
  let currentId: string | null = null;

  while (unvisited.length > 0) {
    let bestNextIndex = -1;
    let minTravel = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const travel = getTravelTime(travelMatrix, currentId, unvisited[i].id);
      if (travel < minTravel) {
        minTravel = travel;
        bestNextIndex = i;
      }
    }

    const nextPlace = unvisited.splice(bestNextIndex, 1)[0];
    ordered.push(nextPlace);
    currentId = nextPlace.id;
  }

  const result = scheduleDayInOrder(
    ordered,
    dayIndex,
    day,
    mealPlaces,
    travelMatrix,
    config,
    usedMealPlaceIds
  );

  if (!result) return null;

  return result;
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

  // Fill remaining day with meals
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
