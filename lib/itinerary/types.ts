export interface OpeningWindow {
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  opensAt: number; // minutes from midnight (e.g., 540 = 09:00)
  closesAt: number; // minutes from midnight (e.g., 1080 = 18:00)
}

export interface SolverPlace {
  id: string;
  name: string;
  durationMinutes: number;
  openingWindows: OpeningWindow[]; // empty = always open
  score?: number; // 1-100 relevance score
}

export interface SolverDay {
  date: string; // ISO date string e.g. "2026-06-10"
  dayOfWeek: number; // 0-6
}

/**
 * A mandatory meal anchored to a clock window. The meal's *start* must fall
 * within [opensAt, closesAt]; the solver picks the best meal place (from
 * `SolverInput.mealPlaces`) that fits the window with the least detour.
 */
export interface MealWindow {
  label: string; // "Almuerzo" | "Cena" | ...
  opensAt: number; // earliest meal start, minutes from midnight
  closesAt: number; // latest meal start, minutes from midnight
  durationMinutes: number;
}

export interface SolverConfig {
  dayStartTime: number; // minutes from midnight — departure time from the depot
  dayEndTime: number; // minutes from midnight — arrival deadline back at the depot
  /**
   * Mandatory meals anchored to clock windows (TOPTW with mandatory visits).
   * When present, the solver schedules each meal within its window. When
   * absent, it falls back to the legacy interval behaviour below.
   */
  meals?: MealWindow[];
  mealIntervalMinutes?: number; // legacy fallback (~240 = 4h) used only when `meals` is absent
}

export type TravelMatrix = Record<string, Record<string, number>>;

export interface SolverInput {
  places: SolverPlace[]; // ordered by preference (index 0 = most preferred)
  mealPlaces: SolverPlace[];
  days: SolverDay[];
  travelMatrix: TravelMatrix; // placeId -> placeId -> minutes (includes places, mealPlaces and depot)
  config: SolverConfig;
  startPlaceId?: string | null; // depot the trip departs from each day (the "hotel")
  endPlaceId?: string | null; // depot the trip must return to each day before dayEndTime
}

export interface ScheduledItem {
  placeId: string | null;
  type: "place" | "transfer" | "recommendation";
  title: string;
  description?: string | null;
  startMinute: number; // minutes from midnight
  endMinute: number; // minutes from midnight
}

export interface DaySchedule {
  dayIndex: number;
  items: ScheduledItem[];
}

export interface SolverResult {
  days: DaySchedule[];
  score: number;
  unplacedPlaces: string[];
}
