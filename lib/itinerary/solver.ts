import type {
  SolverInput,
  SolverResult,
  SolverPlace,
  SolverConfig,
  TravelMatrix,
  ScheduledItem,
  DaySchedule,
  OpeningWindow,
  MealWindow,
} from "./types";

/**
 * Itinerary solver — Iterated Local Search for the Team Orienteering Problem
 * with Time Windows (TOPTW), following Vansteenwegen, Souffriau, Vanden Berghe
 * & Van Oudheusden (2009), "Iterated local search for the team orienteering
 * problem with time windows", Computers & OR 36(12):3281-3290.
 *
 * The tourist trip is modelled as one route per day. Every route departs from a
 * depot (the "hotel") at `dayStartTime` and must return to it by `dayEndTime`
 * (TOPTW depot return). Attractions are optional, time-windowed visits selected
 * to maximise collected score. Meals are *mandatory* visits anchored to clock
 * windows (Lin & Yu 2017): the solver always schedules each configured meal and
 * never lets the perturbation remove it.
 *
 * The key to fast feasibility checks is the per-visit `maxShift`: the maximum a
 * visit's start can be delayed without making any later visit — or the depot
 * return — infeasible. With it, testing an insertion is O(1).
 */

const EPS = 1e-6;
const UNKNOWN_TRAVEL_MINUTES = 15;
const PLACED_WEIGHT = 1000; // dominant term: maximise number of attractions placed
const TRAVEL_WEIGHT = 5; // mild penalty on total walking time
const DEFAULT_PLACE_SCORE = 50;

// ILS budget. Inputs are small (≤~30 places, ≤ handful of days), so a few
// hundred milliseconds of iterated local search is plenty.
const ILS_TIME_BUDGET_MS = 400;
const ILS_MAX_ITERATIONS = 600;

// ─── Internal representation ────────────────────────────────────────────────

type VisitKind = "depot-start" | "depot-end" | "place" | "meal";

interface RouteVisit {
  kind: VisitKind;
  placeId: string | null; // null for the virtual depot when no hotel is given, or a placeholder meal
  name: string;
  durationMinutes: number;
  openingWindows: OpeningWindow[];
  score: number; // collected score (attractions only; 0 for depot/meal)
  mealLabel?: string;
  mealWindow?: MealWindow;
  source?: SolverPlace; // original place, so a removed visit can return to `unvisited`
  // Timing, recomputed by updateRoute():
  arrival: number;
  start: number;
  wait: number;
  departure: number;
  latestStart: number; // latest start allowed by this visit's own window
  maxShift: number; // max extra delay of `start` keeping the rest of the route feasible
}

interface Route {
  dayIndex: number;
  visits: RouteVisit[]; // always [depot-start, ...inner, depot-end]
}

interface Solution {
  routes: Route[];
  unvisited: SolverPlace[];
}

interface DayContext {
  dayIndex: number;
  dayOfWeek: number;
  departureTime: number;
  arrivalDeadline: number;
  startPlaceId: string | null;
  endPlaceId: string | null;
  travel: (fromId: string | null, toId: string | null) => number;
}

// ─── Entry point ────────────────────────────────────────────────────────────

export function solve(input: SolverInput): SolverResult {
  const { places, days, config } = input;
  console.log(
    `[solve] ILS-TOPTW start. Places: ${places.length}, Meals: ${input.mealPlaces.length}, Days: ${days.length}`,
  );

  const contexts = days.map<DayContext>((day, dayIndex) => ({
    dayIndex,
    dayOfWeek: day.dayOfWeek,
    departureTime: config.dayStartTime,
    arrivalDeadline: config.dayEndTime,
    startPlaceId: input.startPlaceId ?? null,
    endPlaceId: input.endPlaceId ?? null,
    travel: (from, to) => travelTime(input.travelMatrix, from, to),
  }));

  const mealWindows = resolveMealWindows(config, input.mealPlaces);

  // --- Construction: depot-anchored routes + mandatory meals + greedy insert ---
  const current = buildInitialSolution(input, contexts, mealWindows);
  insertStep(current, contexts);

  console.log(
    `[solve] Greedy placed ${countPlaced(current)}/${places.length} attractions`,
  );

  // --- Iterated Local Search ---
  const best = iteratedLocalSearch(current, contexts);

  console.log(
    `[solve] ILS placed ${countPlaced(best)}/${places.length} attractions`,
  );

  // --- Emit schedule ---
  const resultDays: DaySchedule[] = best.routes.map((route) =>
    extractSchedule(route, contexts[route.dayIndex]),
  );

  const score = objective(best, contexts);
  const unplacedPlaces = best.unvisited.map((p) => p.id);

  console.log(`[solve] Finished. Score: ${score}. Unplaced: ${unplacedPlaces.length}`);

  return { days: resultDays, score, unplacedPlaces };
}

// ─── Construction ─────────────────────────────────────────────────────────────

function buildInitialSolution(
  input: SolverInput,
  contexts: DayContext[],
  mealWindows: MealWindow[],
): Solution {
  const routes: Route[] = contexts.map((ctx) => {
    const route: Route = {
      dayIndex: ctx.dayIndex,
      visits: [makeDepotNode("depot-start", ctx.startPlaceId), makeDepotNode("depot-end", ctx.endPlaceId)],
    };
    updateRoute(route, ctx);
    seedMandatoryMeals(route, ctx, mealWindows, input.mealPlaces);
    return route;
  });

  return { routes, unvisited: [...input.places] };
}

/**
 * Inserts one mandatory meal per configured window. Prefers a real, not-yet-used
 * restaurant with the smallest detour; falls back to a placeholder ("free time"
 * meal) when no candidate fits, so the meal is always present in its window.
 */
function seedMandatoryMeals(
  route: Route,
  ctx: DayContext,
  mealWindows: MealWindow[],
  mealPlaces: SolverPlace[],
): void {
  const usedToday = new Set<string>();

  for (const mw of [...mealWindows].sort((a, b) => a.opensAt - b.opensAt)) {
    const openCandidates = mealPlaces.filter(
      (mp) => !usedToday.has(mp.id) && hasOpenWindow(mp, ctx.dayOfWeek),
    );
    // Variety first (higher score / better detour handled by min-shift), then a
    // guaranteed placeholder so the meal never goes missing.
    const tiers: (SolverPlace | null)[][] = [openCandidates, [null]];

    let placed = false;
    for (const tier of tiers) {
      let bestPos = -1;
      let bestShift = Infinity;
      let bestNode: RouteVisit | null = null;

      for (const candidate of tier) {
        const node = makeMealNode(mw, candidate);
        for (let a = 0; a < route.visits.length - 1; a++) {
          const evaluated = evaluateInsertion(route, a, node, ctx);
          if (evaluated.feasible && evaluated.shift < bestShift) {
            bestShift = evaluated.shift;
            bestPos = a;
            bestNode = makeMealNode(mw, candidate);
          }
        }
      }

      if (bestNode && bestPos >= 0) {
        route.visits.splice(bestPos + 1, 0, bestNode);
        updateRoute(route, ctx);
        if (bestNode.placeId) usedToday.add(bestNode.placeId);
        placed = true;
        break;
      }
    }

    if (!placed) {
      console.warn(`[solve] Could not place meal "${mw.label}" on day ${ctx.dayIndex}`);
    }
  }
}

/**
 * Greedy best-insertion: repeatedly inserts the unvisited attraction with the
 * best score²/shift ratio (Vansteenwegen). The ratio is divided by the route's
 * current attraction count to spread visits across days (tourist-friendly
 * balance) without affecting feasibility.
 */
function insertStep(solution: Solution, contexts: DayContext[]): void {
  for (;;) {
    let bestValue = -Infinity;
    let bestPlaceIdx = -1;
    let bestRoute: Route | null = null;
    let bestPos = -1;

    for (let pi = 0; pi < solution.unvisited.length; pi++) {
      const place = solution.unvisited[pi];
      const node = makePlaceNode(place);

      for (const route of solution.routes) {
        const ctx = contexts[route.dayIndex];
        const attrCount = countAttractions(route);

        for (let a = 0; a < route.visits.length - 1; a++) {
          const evaluated = evaluateInsertion(route, a, node, ctx);
          if (!evaluated.feasible) continue;

          const ratio = (node.score * node.score) / Math.max(evaluated.shift, EPS);
          const value = ratio / (1 + attrCount);
          if (value > bestValue) {
            bestValue = value;
            bestPlaceIdx = pi;
            bestRoute = route;
            bestPos = a;
          }
        }
      }
    }

    if (bestPlaceIdx === -1 || !bestRoute) break;

    const [place] = solution.unvisited.splice(bestPlaceIdx, 1);
    bestRoute.visits.splice(bestPos + 1, 0, makePlaceNode(place));
    updateRoute(bestRoute, contexts[bestRoute.dayIndex]);
  }
}

// ─── Iterated Local Search ────────────────────────────────────────────────────

function iteratedLocalSearch(initial: Solution, contexts: DayContext[]): Solution {
  let current = cloneSolution(initial);
  let best = cloneSolution(initial);
  let bestObjective = objective(best, contexts);

  let removeStart = 0;
  let removeCount = 1;
  const startedAt = Date.now();

  for (let iter = 0; iter < ILS_MAX_ITERATIONS; iter++) {
    if (Date.now() - startedAt > ILS_TIME_BUDGET_MS) break;

    shake(current, removeStart, removeCount, contexts);
    insertStep(current, contexts);

    const candidateObjective = objective(current, contexts);
    if (candidateObjective > bestObjective + EPS) {
      best = cloneSolution(current);
      bestObjective = candidateObjective;
      removeCount = 1;
    } else {
      current = cloneSolution(best);
      removeCount++;
    }

    const maxLen = Math.max(1, ...current.routes.map(countAttractions));
    if (removeCount > maxLen) removeCount = 1;
    removeStart++;
  }

  return best;
}

/**
 * Perturbation: removes `removeCount` consecutive attractions from each route
 * (wrapping), starting at `removeStart`. Depot and meal visits are never
 * removed, so mandatory meals always survive.
 */
function shake(
  solution: Solution,
  removeStart: number,
  removeCount: number,
  contexts: DayContext[],
): void {
  for (const route of solution.routes) {
    const attractionIdx = route.visits
      .map((v, i) => (v.kind === "place" ? i : -1))
      .filter((i) => i >= 0);
    if (attractionIdx.length === 0) continue;

    const start = removeStart % attractionIdx.length;
    const count = Math.min(removeCount, attractionIdx.length);
    const toRemove = new Set<number>();
    for (let k = 0; k < count; k++) {
      toRemove.add(attractionIdx[(start + k) % attractionIdx.length]);
    }

    const kept: RouteVisit[] = [];
    for (let i = 0; i < route.visits.length; i++) {
      if (toRemove.has(i)) {
        const removed = route.visits[i];
        if (removed.source) solution.unvisited.push(removed.source);
      } else {
        kept.push(route.visits[i]);
      }
    }
    route.visits = kept;
    updateRoute(route, contexts[route.dayIndex]);
  }
}

// ─── Route timing & feasibility (MaxShift) ───────────────────────────────────

/**
 * Recomputes arrival/start/wait/departure (forward pass) and maxShift (backward
 * pass) for every visit. Returns false if the route is infeasible.
 */
function updateRoute(route: Route, ctx: DayContext): boolean {
  const v = route.visits;
  const n = v.length;

  // Forward pass.
  const depotStart = v[0];
  depotStart.arrival = ctx.departureTime;
  depotStart.start = ctx.departureTime;
  depotStart.wait = 0;
  depotStart.departure = ctx.departureTime;
  depotStart.latestStart = ctx.departureTime;

  for (let i = 1; i < n; i++) {
    const prev = v[i - 1];
    const node = v[i];
    const arrival = prev.departure + ctx.travel(prev.placeId, node.placeId);

    if (node.kind === "depot-end") {
      node.arrival = arrival;
      node.start = arrival;
      node.wait = 0;
      node.departure = arrival;
      node.latestStart = ctx.arrivalDeadline;
      if (arrival > ctx.arrivalDeadline + EPS) return false;
      continue;
    }

    const window = serviceWindow(node, ctx.dayOfWeek, arrival);
    if (!window) return false;
    const latestStart = window.latestFinish - node.durationMinutes;
    if (window.start > latestStart + EPS) return false;

    node.arrival = arrival;
    node.start = window.start;
    node.wait = window.start - arrival;
    node.departure = window.start + node.durationMinutes;
    node.latestStart = latestStart;
  }

  // Backward pass: maxShift.
  const end = v[n - 1];
  end.maxShift = ctx.arrivalDeadline - end.arrival;
  for (let i = n - 2; i >= 0; i--) {
    const node = v[i];
    const next = v[i + 1];
    const ownSlack = node.latestStart - node.start;
    node.maxShift = Math.min(ownSlack, next.wait + next.maxShift);
    if (node.maxShift < -EPS) return false;
  }

  return true;
}

/**
 * O(1) feasibility/cost of inserting `node` right after visit index `a`.
 * Uses the precomputed maxShift of the following visit.
 */
function evaluateInsertion(
  route: Route,
  a: number,
  node: RouteVisit,
  ctx: DayContext,
): { feasible: boolean; shift: number } {
  const before = route.visits[a];
  const after = route.visits[a + 1];
  if (!after) return { feasible: false, shift: Infinity };

  const travelToNode = ctx.travel(before.placeId, node.placeId);
  const arrival = before.departure + travelToNode;

  const window = serviceWindow(node, ctx.dayOfWeek, arrival);
  if (!window) return { feasible: false, shift: Infinity };

  const latestStart = window.latestFinish - node.durationMinutes;
  if (window.start > latestStart + EPS) return { feasible: false, shift: Infinity };

  const wait = window.start - arrival;
  const travelToAfter = ctx.travel(node.placeId, after.placeId);
  const travelOld = ctx.travel(before.placeId, after.placeId);
  const shift = travelToNode + wait + node.durationMinutes + travelToAfter - travelOld;

  if (shift > after.wait + after.maxShift + EPS) {
    return { feasible: false, shift };
  }
  return { feasible: true, shift };
}

/**
 * Earliest feasible service start and latest finish for a visit arriving at
 * `arrival`. Handles multiple opening windows per day (OPMTW) and the extra
 * clock window of meals.
 */
function serviceWindow(
  node: RouteVisit,
  dayOfWeek: number,
  arrival: number,
): { start: number; latestFinish: number } | null {
  const windows =
    node.openingWindows.length === 0
      ? [{ dayOfWeek, opensAt: 0, closesAt: 24 * 60 }]
      : node.openingWindows
          .filter((w) => w.dayOfWeek === dayOfWeek)
          .sort((a, b) => a.opensAt - b.opensAt);

  if (node.kind === "meal" && node.mealWindow) {
    const mw = node.mealWindow;
    for (const w of windows) {
      const start = Math.max(arrival, mw.opensAt, w.opensAt);
      const latestStart = Math.min(mw.closesAt, w.closesAt - node.durationMinutes);
      if (start <= latestStart) {
        return { start, latestFinish: latestStart + node.durationMinutes };
      }
    }
    return null;
  }

  for (const w of windows) {
    const start = Math.max(arrival, w.opensAt);
    if (start + node.durationMinutes <= w.closesAt) {
      return { start, latestFinish: w.closesAt };
    }
  }
  return null;
}

// ─── Objective & helpers ──────────────────────────────────────────────────────

function objective(solution: Solution, contexts: DayContext[]): number {
  let placed = 0;
  let scoreSum = 0;
  let travel = 0;

  for (const route of solution.routes) {
    const ctx = contexts[route.dayIndex];
    for (const visit of route.visits) {
      if (visit.kind === "place") {
        placed++;
        scoreSum += visit.score;
      }
    }
    for (let i = 1; i < route.visits.length; i++) {
      travel += ctx.travel(route.visits[i - 1].placeId, route.visits[i].placeId);
    }
  }

  return placed * PLACED_WEIGHT + scoreSum - travel * TRAVEL_WEIGHT;
}

function countPlaced(solution: Solution): number {
  return solution.routes.reduce((sum, r) => sum + countAttractions(r), 0);
}

function countAttractions(route: Route): number {
  return route.visits.reduce((sum, v) => sum + (v.kind === "place" ? 1 : 0), 0);
}

function cloneSolution(solution: Solution): Solution {
  return {
    routes: solution.routes.map((route) => ({
      dayIndex: route.dayIndex,
      visits: route.visits.map((v) => ({ ...v })),
    })),
    unvisited: [...solution.unvisited],
  };
}

// ─── Node factories ───────────────────────────────────────────────────────────

function blankTiming(): Pick<
  RouteVisit,
  "arrival" | "start" | "wait" | "departure" | "latestStart" | "maxShift"
> {
  return { arrival: 0, start: 0, wait: 0, departure: 0, latestStart: 0, maxShift: 0 };
}

function makeDepotNode(kind: "depot-start" | "depot-end", placeId: string | null): RouteVisit {
  return {
    kind,
    placeId,
    name: kind === "depot-start" ? "Inicio" : "Fin",
    durationMinutes: 0,
    openingWindows: [],
    score: 0,
    ...blankTiming(),
  };
}

function makePlaceNode(place: SolverPlace): RouteVisit {
  return {
    kind: "place",
    placeId: place.id,
    name: place.name,
    durationMinutes: place.durationMinutes,
    openingWindows: place.openingWindows,
    score: place.score ?? DEFAULT_PLACE_SCORE,
    source: place,
    ...blankTiming(),
  };
}

function makeMealNode(mw: MealWindow, place: SolverPlace | null): RouteVisit {
  return {
    kind: "meal",
    placeId: place?.id ?? null,
    name: place?.name ?? mw.label,
    durationMinutes: mw.durationMinutes,
    openingWindows: place?.openingWindows ?? [],
    score: 0,
    mealLabel: mw.label,
    mealWindow: mw,
    ...blankTiming(),
  };
}

// ─── Meal windows ─────────────────────────────────────────────────────────────

/**
 * Resolves the meal windows to use. Explicit `config.meals` wins. Otherwise, to
 * preserve the behaviour of callers that only pass `mealIntervalMinutes` and
 * meal places, synthesises sensible lunch/dinner windows clipped to the day.
 */
function resolveMealWindows(config: SolverConfig, mealPlaces: SolverPlace[]): MealWindow[] {
  if (config.meals && config.meals.length > 0) return config.meals;
  if (mealPlaces.length === 0) return [];

  const windows: MealWindow[] = [];

  const lunchOpen = Math.max(config.dayStartTime, 12 * 60);
  const lunchClose = Math.min(config.dayEndTime - 60, 15 * 60);
  if (lunchClose >= lunchOpen) {
    windows.push({ label: "Almuerzo", opensAt: lunchOpen, closesAt: lunchClose, durationMinutes: 60 });
  }

  const dinnerOpen = Math.max(config.dayStartTime, 20 * 60);
  const dinnerClose = Math.min(config.dayEndTime - 60, 22 * 60);
  if (config.dayEndTime >= 21 * 60 && dinnerClose >= dinnerOpen) {
    windows.push({ label: "Cena", opensAt: dinnerOpen, closesAt: dinnerClose, durationMinutes: 60 });
  }

  return windows;
}

// ─── Schedule extraction ──────────────────────────────────────────────────────

function getMealLabel(label: string): string {
  return label;
}

function extractSchedule(route: Route, ctx: DayContext): DaySchedule {
  // Ensure timing is current before reading it.
  updateRoute(route, ctx);

  const items: ScheduledItem[] = [];

  for (let i = 1; i < route.visits.length; i++) {
    const prev = route.visits[i - 1];
    const node = route.visits[i];
    const travel = ctx.travel(prev.placeId, node.placeId);

    if (travel > 0) {
      items.push({
        type: "transfer",
        placeId: null,
        title: "Traslado",
        startMinute: prev.departure,
        endMinute: prev.departure + travel,
      });
    }

    if (node.kind === "depot-end") continue;

    if (node.wait > 0) {
      items.push({
        type: "recommendation",
        placeId: null,
        title: "Tiempo libre",
        startMinute: node.arrival,
        endMinute: node.start,
      });
    }

    if (node.kind === "meal") {
      if (node.placeId) {
        items.push({
          type: "place",
          placeId: node.placeId,
          title: `${getMealLabel(node.mealLabel ?? "Comida")} — ${node.name}`,
          startMinute: node.start,
          endMinute: node.departure,
        });
      } else {
        items.push({
          type: "recommendation",
          placeId: null,
          title: node.mealLabel ?? "Comida",
          startMinute: node.start,
          endMinute: node.departure,
        });
      }
    } else {
      items.push({
        type: "place",
        placeId: node.placeId,
        title: node.name,
        startMinute: node.start,
        endMinute: node.departure,
      });
    }
  }

  return { dayIndex: route.dayIndex, items };
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

function travelTime(matrix: TravelMatrix, fromId: string | null, toId: string | null): number {
  if (fromId === null || toId === null) return 0;
  if (fromId === toId) return 0;
  return matrix[fromId]?.[toId] ?? UNKNOWN_TRAVEL_MINUTES;
}

function hasOpenWindow(place: SolverPlace, dayOfWeek: number): boolean {
  if (place.openingWindows.length === 0) return true;
  return place.openingWindows.some((w) => w.dayOfWeek === dayOfWeek);
}
