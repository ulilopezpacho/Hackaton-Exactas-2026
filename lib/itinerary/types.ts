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

export interface SolverConfig {
  dayStartTime: number; // minutes from midnight
  dayEndTime: number; // minutes from midnight
  mealIntervalMinutes: number; // ~240 (4 hours)
}

export type TravelMatrix = Record<string, Record<string, number>>;

export interface SolverInput {
  places: SolverPlace[]; // ordered by preference (index 0 = most preferred)
  mealPlaces: SolverPlace[];
  days: SolverDay[];
  travelMatrix: TravelMatrix; // placeId -> placeId -> minutes (includes both places and mealPlaces)
  config: SolverConfig;
  startPlaceId?: string | null;
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
