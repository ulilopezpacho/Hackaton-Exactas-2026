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
  const { places, days, config, startPlaceId } = input;
  const numPlaces = places.length;
  const numDays = days.length;

  console.log(`[solve] Starting. Places: ${numPlaces}, Days: ${numDays}`);

  if (numPlaces === 0) {
    return {
      days: days.map((_, i) => ({ dayIndex: i, items: [] })),
      score: 0,
      unplacedPlaces: [],
    };
  }

  // --- Phase 1: Greedy Construction ---
  const dayPlaceLists: SolverPlace[][] = days.map(() => []);
  const skipped: string[] = [];
  const globalUsedMealIds: string[] = [];

  const sortedPlaces = [...places].sort((a, b) => (b.score || 0) - (a.score || 0));

  for (const place of sortedPlaces) {
    let bestDay = -1;
    let bestDayScore = -Infinity;

    for (let d = 0; d < numDays; d++) {
      if (!hasOpenWindow(place, days[d].dayOfWeek)) continue;

      dayPlaceLists[d].push(place);

      const dayResult = findBestDaySchedule(
        dayPlaceLists[d],
        d,
        days[d],
        input.mealPlaces,
        input.travelMatrix,
        config,
        globalUsedMealIds,
        d === 0 ? startPlaceId : null,
      );

      dayPlaceLists[d].pop();

      if (dayResult) {
        const travelIncrease = dayResult.totalTravel;
        const balancePenalty = dayPlaceLists[d].length * 15;
        const score = (place.score || 50) - travelIncrease * 2 - balancePenalty;

        if (score > bestDayScore) {
          bestDayScore = score;
          bestDay = d;
        }
      }
    }

    if (bestDay !== -1) {
      dayPlaceLists[bestDay].push(place);
    } else {
      skipped.push(place.id);
    }
  }

  console.log(`[solve] Greedy: assigned ${numPlaces - skipped.length}/${numPlaces}`);

  // --- Phase 2: Inter-day Local Search ---
  interDayLocalSearch(dayPlaceLists, skipped, input);

  console.log(`[solve] Local search: assigned ${numPlaces - skipped.length}/${numPlaces}`);

  // --- Phase 3: Held-Karp DP per day (inside findBestDaySchedule) ---
  // (applied automatically when findBestDaySchedule calls heldKarpOrder)

  // --- Phase 4: Final Scheduling ---
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
      finalUsedMealIds,
      d === 0 ? startPlaceId : null,
    );

    if (dayResult) {
      resultDays.push(dayResult.schedule);
      totalTravel += dayResult.totalTravel;
      finalUsedMealIds.push(...dayResult.mealPlaceIdsUsed);
    } else {
      resultDays.push({ dayIndex: d, items: [] });
    }
  }

  let finalScore = (numPlaces - skipped.length) * 1000;
  for (const dayList of dayPlaceLists) {
    for (const p of dayList) finalScore += p.score || 50;
  }
  finalScore -= totalTravel * 5;

  console.log(`[solve] Finished. Assigned: ${numPlaces - skipped.length}/${numPlaces}. Score: ${finalScore}`);

  return { days: resultDays, score: finalScore, unplacedPlaces: skipped };
}

// --- Held-Karp DP for optimal intra-day ordering ---

function heldKarpOrder(
  places: SolverPlace[],
  day: SolverDay,
  travelMatrix: TravelMatrix,
  config: SolverConfig,
  startPlaceId?: string | null,
): SolverPlace[] | null {
  const n = places.length;
  if (n <= 1) return places.length === 0 ? null : [...places];
  if (n > 20) return nearestNeighborOrder(places, travelMatrix, startPlaceId);

  const FULL = (1 << n) - 1;
  const dp: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(Infinity));
  const parent: (number[] | null)[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(null));

  for (let v = 0; v < n; v++) {
    const travel = getTravelTime(
      travelMatrix,
      startPlaceId ?? null,
      places[v].id,
    );
    const arrival = config.dayStartTime + travel;
    const w = findOpenWindow(places[v], day.dayOfWeek, arrival);
    if (!w) continue;
    const start = Math.max(arrival, w.opensAt);
    const end = start + places[v].durationMinutes;
    if (end > w.closesAt || end > config.dayEndTime) continue;
    dp[1 << v][v] = end;
  }

  for (let S = 1; S <= FULL; S++) {
    for (let v = 0; v < n; v++) {
      if (!(S & (1 << v))) continue;
      if (dp[S][v] === Infinity) continue;

      for (let w = 0; w < n; w++) {
        if (S & (1 << w)) continue;
        const travel = getTravelTime(travelMatrix, places[v].id, places[w].id);
        const arrival = dp[S][v] + travel;
        const window = findOpenWindow(places[w], day.dayOfWeek, arrival);
        if (!window) continue;
        const start = Math.max(arrival, window.opensAt);
        const end = start + places[w].durationMinutes;
        if (end > window.closesAt || end > config.dayEndTime) continue;
        const nextS = S | (1 << w);
        if (end < dp[nextS][w]) {
          dp[nextS][w] = end;
          parent[nextS][w] = [S, v];
        }
      }
    }
  }

  let bestEnd = Infinity;
  let bestLast = -1;
  for (let v = 0; v < n; v++) {
    if (dp[FULL][v] < bestEnd) {
      bestEnd = dp[FULL][v];
      bestLast = v;
    }
  }

  if (bestLast === -1) {
    return nearestNeighborOrder(places, travelMatrix, startPlaceId);
  }

  const order: number[] = [];
  let S = FULL;
  let v = bestLast;
  while (true) {
    order.push(v);
    const p = parent[S][v];
    if (!p) break;
    S = p[0];
    v = p[1];
  }
  order.reverse();

  return order.map((i) => places[i]);
}

// --- Extracted nearest-neighbor ordering ---

function nearestNeighborOrder(
  places: SolverPlace[],
  travelMatrix: TravelMatrix,
  startPlaceId?: string | null,
): SolverPlace[] {
  if (places.length <= 1) return [...places];

  const unvisited = [...places];
  const ordered: SolverPlace[] = [];
  let currentId: string | null = startPlaceId ?? null;

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

  return ordered;
}

// --- Inter-day Local Search ---

function canScheduleDay(
  places: SolverPlace[],
  dayIndex: number,
  day: SolverDay,
  mealPlaces: SolverPlace[],
  travelMatrix: TravelMatrix,
  config: SolverConfig,
  startPlaceId?: string | null,
): boolean {
  return (
    findBestDaySchedule(
      places,
      dayIndex,
      day,
      mealPlaces,
      travelMatrix,
      config,
      [],
      startPlaceId,
    ) !== null
  );
}

function interDayLocalSearch(
  dayPlaceLists: SolverPlace[][],
  skipped: string[],
  input: SolverInput
): void {
  const { places, mealPlaces, days, travelMatrix, config, startPlaceId } =
    input;
  const numDays = days.length;

  let currentScore = computeSolutionScore(
    dayPlaceLists,
    travelMatrix,
    startPlaceId,
  );
  let improved = true;
  let iteration = 0;
  const MAX_ITERATIONS = 50;

  while (improved && iteration < MAX_ITERATIONS) {
    improved = false;
    iteration++;

    // --- Relocate moves ---
    for (let d1 = 0; d1 < numDays && !improved; d1++) {
      for (let pi = 0; pi < dayPlaceLists[d1].length && !improved; pi++) {
        const place = dayPlaceLists[d1][pi];

        for (let d2 = 0; d2 < numDays; d2++) {
          if (d2 === d1) continue;
          if (!hasOpenWindow(place, days[d2].dayOfWeek)) continue;

          const candidateD2 = [...dayPlaceLists[d2], place];
          if (
            !canScheduleDay(
              candidateD2,
              d2,
              days[d2],
              mealPlaces,
              travelMatrix,
              config,
              d2 === 0 ? startPlaceId : null,
            )
          )
            continue;

          const candidateD1 = dayPlaceLists[d1].filter((_, i) => i !== pi);
          if (
            !canScheduleDay(
              candidateD1,
              d1,
              days[d1],
              mealPlaces,
              travelMatrix,
              config,
              d1 === 0 ? startPlaceId : null,
            )
          )
            continue;

          const saved = [dayPlaceLists[d1], dayPlaceLists[d2]];
          dayPlaceLists[d1] = candidateD1;
          dayPlaceLists[d2] = candidateD2;

          const candidateScore = computeSolutionScore(
            dayPlaceLists,
            travelMatrix,
            startPlaceId,
          );

          if (candidateScore > currentScore) {
            currentScore = candidateScore;
            improved = true;
          } else {
            dayPlaceLists[d1] = saved[0];
            dayPlaceLists[d2] = saved[1];
          }
          if (improved) break;
        }
      }
    }

    if (improved) continue;

    // --- Swap moves ---
    for (let d1 = 0; d1 < numDays - 1 && !improved; d1++) {
      for (let d2 = d1 + 1; d2 < numDays && !improved; d2++) {
        for (let pi = 0; pi < dayPlaceLists[d1].length && !improved; pi++) {
          for (let pj = 0; pj < dayPlaceLists[d2].length && !improved; pj++) {
            const placeA = dayPlaceLists[d1][pi];
            const placeB = dayPlaceLists[d2][pj];

            if (!hasOpenWindow(placeA, days[d2].dayOfWeek)) continue;
            if (!hasOpenWindow(placeB, days[d1].dayOfWeek)) continue;

            const candidateD1 = [...dayPlaceLists[d1]];
            const candidateD2 = [...dayPlaceLists[d2]];
            candidateD1[pi] = placeB;
            candidateD2[pj] = placeA;

            if (
              !canScheduleDay(
                candidateD1,
                d1,
                days[d1],
                mealPlaces,
                travelMatrix,
                config,
                d1 === 0 ? startPlaceId : null,
              )
            )
              continue;
            if (
              !canScheduleDay(
                candidateD2,
                d2,
                days[d2],
                mealPlaces,
                travelMatrix,
                config,
                d2 === 0 ? startPlaceId : null,
              )
            )
              continue;

            const saved = [dayPlaceLists[d1], dayPlaceLists[d2]];
            dayPlaceLists[d1] = candidateD1;
            dayPlaceLists[d2] = candidateD2;

            const candidateScore = computeSolutionScore(
              dayPlaceLists,
              travelMatrix,
              startPlaceId,
            );

            if (candidateScore > currentScore) {
              currentScore = candidateScore;
              improved = true;
            } else {
              dayPlaceLists[d1] = saved[0];
              dayPlaceLists[d2] = saved[1];
            }
          }
        }
      }
    }
  }

  // --- Recovery: try to insert skipped places ---
  const allPlaces = new Map(places.map((p) => [p.id, p]));
  for (let i = skipped.length - 1; i >= 0; i--) {
    const place = allPlaces.get(skipped[i]);
    if (!place) continue;

    let bestDay = -1;
    let bestScore = currentScore;

    for (let d = 0; d < numDays; d++) {
      if (!hasOpenWindow(place, days[d].dayOfWeek)) continue;

      const candidate = [...dayPlaceLists[d], place];
      if (
        !canScheduleDay(
          candidate,
          d,
          days[d],
          mealPlaces,
          travelMatrix,
          config,
          d === 0 ? startPlaceId : null,
        )
      )
        continue;

      const saved = dayPlaceLists[d];
      dayPlaceLists[d] = candidate;
      const candidateScore = computeSolutionScore(
        dayPlaceLists,
        travelMatrix,
        startPlaceId,
      );
      dayPlaceLists[d] = saved;

      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestDay = d;
      }
    }

    if (bestDay !== -1) {
      dayPlaceLists[bestDay].push(place);
      skipped.splice(i, 1);
      currentScore = bestScore;
    }
  }
}

// --- Quick feasibility check (no meals, optimistic) ---

function quickFeasibilityCheck(
  places: SolverPlace[],
  day: SolverDay,
  travelMatrix: TravelMatrix,
  config: SolverConfig
): boolean {
  for (const p of places) {
    if (!hasOpenWindow(p, day.dayOfWeek)) return false;
  }

  const ordered = nearestNeighborOrder(places, travelMatrix);
  let time = config.dayStartTime;
  let lastId: string | null = null;

  for (const p of ordered) {
    time += getTravelTime(travelMatrix, lastId, p.id);
    const w = findOpenWindow(p, day.dayOfWeek, time);
    if (!w) return false;
    time = Math.max(time, w.opensAt) + p.durationMinutes;
    if (time > config.dayEndTime) return false;
    lastId = p.id;
  }

  return true;
}

// --- Solution scoring for local search ---

function computeSolutionScore(
  dayPlaceLists: SolverPlace[][],
  travelMatrix: TravelMatrix,
  startPlaceId?: string | null,
): number {
  let score = 0;
  let placedCount = 0;

  for (const dayList of dayPlaceLists) {
    for (const p of dayList) {
      score += 1000 + (p.score || 50);
      placedCount++;
    }
  }

  for (let dayIndex = 0; dayIndex < dayPlaceLists.length; dayIndex++) {
    const dayList = dayPlaceLists[dayIndex];
    if (dayList.length < 2) continue;
    const dayStartPlaceId = dayIndex === 0 ? startPlaceId : null;
    const ordered = nearestNeighborOrder(
      dayList,
      travelMatrix,
      dayStartPlaceId,
    );
    let lastId: string | null = dayStartPlaceId ?? null;
    for (const p of ordered) {
      score -= getTravelTime(travelMatrix, lastId, p.id) * 5;
      lastId = p.id;
    }
  }

  if (dayPlaceLists.length > 0 && placedCount > 0) {
    const avg = placedCount / dayPlaceLists.length;
    for (const dayList of dayPlaceLists) {
      score -= Math.abs(dayList.length - avg) * 50;
    }
  }

  return score;
}

// --- Per-day scheduling ---

function findBestDaySchedule(
  places: SolverPlace[],
  dayIndex: number,
  day: SolverDay,
  mealPlaces: SolverPlace[],
  travelMatrix: TravelMatrix,
  config: SolverConfig,
  usedMealPlaceIds: string[],
  startPlaceId?: string | null,
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

  // Use Held-Karp DP for optimal ordering, fallback to nearest-neighbor
  const ordered =
    heldKarpOrder(places, day, travelMatrix, config, startPlaceId) ??
    nearestNeighborOrder(places, travelMatrix, startPlaceId);

  const result = scheduleDayInOrder(
    ordered,
    dayIndex,
    day,
    mealPlaces,
    travelMatrix,
    config,
    usedMealPlaceIds,
    startPlaceId,
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
  globalUsedMealIds: string[],
  startPlaceId?: string | null,
): {
  schedule: DaySchedule;
  totalTravel: number;
  mealPlaceIdsUsed: string[];
} | null {
  const items: ScheduledItem[] = [];
  let currentTime = config.dayStartTime;
  let lastMealTime = config.dayStartTime;
  let lastPlaceId: string | null = startPlaceId ?? null;
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

    if (usedMealIds.includes(mp.id)) continue;

    if (travel < bestCost) {
      bestCost = travel;
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
  return matrix[fromId]?.[toId] ?? 15;
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
