/**
 * User-declared priority for a place within a trip.
 *
 * The level drives the per-place `score` sent to the itinerary solver. Bases are
 * chosen with large gaps so the solver's objective
 * (`placed × PLACED_WEIGHT(1000) + Σscore − travel × 5`) prioritises the levels
 * the user cares about:
 *  - `must`  ("Tengo que ir")     → effectively guaranteed (dominates everything)
 *  - `like`  ("Me gustaría ir")    → always beats `maybe` (gap > PLACED_WEIGHT)
 *  - `maybe` ("Si queda tiempo voy") → filler, ranked by Google quality
 *
 * The Google quality/popularity score (0–100) is added on top as a within-level
 * tie-breaker. See `lib/itinerary/generate.ts`.
 */
export type PlacePriority = "must" | "like" | "maybe";

export const PLACE_PRIORITY_BASE: Record<PlacePriority, number> = {
  must: 100_000,
  like: 2_000,
  maybe: 0,
};

export const DEFAULT_PLACE_PRIORITY: PlacePriority = "like";

export const PLACE_PRIORITY_OPTIONS: { value: PlacePriority; label: string }[] = [
  { value: "must", label: "Tengo que ir" },
  { value: "like", label: "Me gustaría ir" },
  { value: "maybe", label: "Si queda tiempo voy" },
];

export function isPlacePriority(value: unknown): value is PlacePriority {
  return value === "must" || value === "like" || value === "maybe";
}
