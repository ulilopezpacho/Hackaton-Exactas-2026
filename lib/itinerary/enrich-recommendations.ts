import {
  searchPlaces,
  type GooglePriceLevel,
  type PlaceCandidate,
  type SearchPlacesOptions,
} from "@/lib/places/google";
import {
  computePopularity,
  computeQualityScore,
} from "@/lib/places/catalog";
import type {
  DaySchedule,
  ScheduledItem,
  SolverResult,
} from "./types";

type Coordinates = {
  lat: number;
  lng: number;
};

type Budget = "under_50" | "50_100" | "100_200" | "over_200" | null;

type SearchPlacesFn = (
  options: SearchPlacesOptions,
) => Promise<PlaceCandidate[]>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

interface EnrichRecommendationsInput {
  supabase: AnySupabase;
  result: SolverResult;
  destinationId: string | null;
  budget: Budget;
  coordinatesByPlaceId: Map<string, Coordinates>;
  searchPlacesFn?: SearchPlacesFn;
  random?: () => number;
}

interface RecommendationMatch {
  dayIndex: number;
  itemIndex: number;
  candidate: PlaceCandidate;
}

interface RecommendationSearch {
  dayIndex: number;
  itemIndex: number;
  kind: "meal" | "activity";
  candidates: PlaceCandidate[];
}

const MEAL_TITLES = new Set(["almuerzo", "merienda", "cena"]);
const FOOD_TYPES = new Set([
  "acai_shop",
  "bagel_shop",
  "bakery",
  "bar",
  "cafe",
  "cafeteria",
  "candy_store",
  "cat_cafe",
  "chocolate_shop",
  "coffee_shop",
  "confectionery",
  "deli",
  "dessert_shop",
  "diner",
  "dog_cafe",
  "donut_shop",
  "food",
  "food_court",
  "ice_cream_shop",
  "juice_shop",
  "meal_delivery",
  "meal_takeaway",
  "pub",
  "restaurant",
  "sandwich_shop",
  "tea_house",
]);

export function isMealRecommendation(title: string): boolean {
  return MEAL_TITLES.has(normalizeText(title));
}

export function budgetToPriceLevels(
  budget: Budget,
): GooglePriceLevel[] | undefined {
  switch (budget) {
    case "under_50":
      return ["PRICE_LEVEL_INEXPENSIVE"];
    case "50_100":
      return ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"];
    case "100_200":
      return ["PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE"];
    case "over_200":
      return ["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"];
    default:
      return undefined;
  }
}

export function geographicMidpoint(
  first: Coordinates,
  second: Coordinates,
): Coordinates {
  const lat1 = degreesToRadians(first.lat);
  const lng1 = degreesToRadians(first.lng);
  const lat2 = degreesToRadians(second.lat);
  const deltaLng = degreesToRadians(second.lng - first.lng);
  const bx = Math.cos(lat2) * Math.cos(deltaLng);
  const by = Math.cos(lat2) * Math.sin(deltaLng);

  const lat = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2),
  );
  const lng = lng1 + Math.atan2(by, Math.cos(lat1) + bx);

  return {
    lat: radiansToDegrees(lat),
    lng: normalizeLongitude(radiansToDegrees(lng)),
  };
}

export function isFoodPlace(candidate: PlaceCandidate): boolean {
  const types = [candidate.primaryType, ...(candidate.types ?? [])].filter(
    (type): type is string => Boolean(type),
  );

  return types.some(
    (type) => FOOD_TYPES.has(type) || type.endsWith("_restaurant"),
  );
}

export function selectBestRated(
  candidates: PlaceCandidate[],
): PlaceCandidate | null {
  return (
    [...candidates].sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (b.userRatingsTotal ?? 0) - (a.userRatingsTotal ?? 0),
    )[0] ?? null
  );
}

export function selectRandomNearbyActivity(
  candidates: PlaceCandidate[],
  random: () => number = Math.random,
): PlaceCandidate | null {
  const topCandidates = candidates
    .filter(
      (candidate) =>
        !isFoodPlace(candidate) && (candidate.rating ?? 0) >= 4,
    )
    .slice(0, 5);

  if (topCandidates.length === 0) return null;

  const index = Math.min(
    topCandidates.length - 1,
    Math.floor(random() * topCandidates.length),
  );
  return topCandidates[index];
}

export async function enrichRecommendations({
  supabase,
  result,
  destinationId,
  budget,
  coordinatesByPlaceId,
  searchPlacesFn = searchPlaces,
  random = Math.random,
}: EnrichRecommendationsInput): Promise<SolverResult> {
  if (!destinationId) return result;

  const searches = result.days.flatMap((day) =>
    day.items.map(async (item, itemIndex) => {
      if (item.type !== "recommendation") return null;

      const center = findRecommendationCenter(
        day,
        itemIndex,
        coordinatesByPlaceId,
      );
      if (!center) return null;

      try {
        const kind = isMealRecommendation(item.title) ? "meal" : "activity";
        const candidates =
          kind === "meal"
            ? await findMealCandidates(center, budget, searchPlacesFn)
            : await findActivityCandidates(center, searchPlacesFn);

        return {
          dayIndex: day.dayIndex,
          itemIndex,
          kind,
          candidates,
        };
      } catch (error) {
        console.warn(
          `[enrichRecommendations] Could not enrich day ${day.dayIndex + 1}, item ${itemIndex}:`,
          error,
        );
        return null;
      }
    }),
  );

  const recommendationSearches = (await Promise.all(searches)).filter(
    (search): search is RecommendationSearch => search !== null,
  );
  const usedExternalIds = new Set<string>();
  const matches: RecommendationMatch[] = [];

  for (const search of recommendationSearches) {
    const availableCandidates = search.candidates.filter(
      (candidate) => !usedExternalIds.has(candidate.externalId),
    );
    const candidate =
      search.kind === "meal"
        ? selectBestRated(availableCandidates)
        : selectRandomNearbyActivity(availableCandidates, random);

    if (!candidate) continue;

    usedExternalIds.add(candidate.externalId);
    matches.push({
      dayIndex: search.dayIndex,
      itemIndex: search.itemIndex,
      candidate,
    });
  }

  if (matches.length === 0) return result;

  const uniqueCandidates = Array.from(
    new Map(
      matches.map((match) => [match.candidate.externalId, match.candidate]),
    ).values(),
  );

  try {
    const rows = uniqueCandidates.map((candidate) => ({
      owner_id: null,
      destination_id: destinationId,
      source: "google",
      external_id: candidate.externalId,
      name: candidate.name,
      description: candidate.summary ?? null,
      category: candidate.primaryType ?? "recommendation",
      address: candidate.address || null,
      location: `SRID=4326;POINT(${candidate.lng} ${candidate.lat})`,
      primary_type: candidate.primaryType ?? null,
      types: candidate.types ?? null,
      summary: candidate.summary ?? null,
      rating: candidate.rating ?? null,
      user_ratings_total: candidate.userRatingsTotal ?? null,
      quality_score:
        computeQualityScore(candidate.rating, candidate.userRatingsTotal) ??
        null,
      popularity: computePopularity(candidate.userRatingsTotal) ?? null,
      status: "active",
    }));

    const { data, error } = await supabase
      .from("places")
      .upsert(rows, {
        onConflict: "destination_id,external_id",
      })
      .select("id,external_id");

    if (error) throw error;

    const placeIdByExternalId = new Map<string, string>(
      (data ?? []).map((place: { id: string; external_id: string }) => [
        place.external_id,
        place.id,
      ]),
    );

    const matchByItem = new Map(
      matches.map((match) => [
        `${match.dayIndex}:${match.itemIndex}`,
        match,
      ]),
    );

    return {
      ...result,
      days: result.days.map((day) => ({
        ...day,
        items: day.items.map((item, itemIndex) => {
          const match = matchByItem.get(`${day.dayIndex}:${itemIndex}`);
          if (!match) return item;

          const placeId = placeIdByExternalId.get(
            match.candidate.externalId,
          );
          if (!placeId) return item;

          return {
            ...item,
            placeId,
            title: match.candidate.name,
            description: buildRecommendationDescription(match.candidate),
          };
        }),
      })),
    };
  } catch (error) {
    console.warn(
      "[enrichRecommendations] Could not persist recommendations:",
      error,
    );
    return result;
  }
}

async function findMealCandidates(
  center: Coordinates,
  budget: Budget,
  searchPlacesFn: SearchPlacesFn,
): Promise<PlaceCandidate[]> {
  const priceLevels = budgetToPriceLevels(budget);
  const options: SearchPlacesOptions = {
    query: "restaurantes",
    latBias: center.lat,
    lngBias: center.lng,
    radiusMeters: 3000,
    includedType: "restaurant",
    strictTypeFiltering: true,
    priceLevels,
    rankPreference: "DISTANCE",
    pageSize: 20,
  };

  let candidates = await searchPlacesFn(options);
  if (candidates.length === 0 && priceLevels) {
    candidates = await searchPlacesFn({
      ...options,
      priceLevels: undefined,
    });
  }

  return candidates;
}

async function findActivityCandidates(
  center: Coordinates,
  searchPlacesFn: SearchPlacesFn,
): Promise<PlaceCandidate[]> {
  return searchPlacesFn({
    query: "lugares para visitar",
    latBias: center.lat,
    lngBias: center.lng,
    radiusMeters: 3000,
    minRating: 4,
    rankPreference: "DISTANCE",
    pageSize: 20,
  });
}

function findRecommendationCenter(
  day: DaySchedule,
  itemIndex: number,
  coordinatesByPlaceId: Map<string, Coordinates>,
): Coordinates | null {
  const previous = findNeighborCoordinates(
    day.items,
    itemIndex,
    -1,
    coordinatesByPlaceId,
  );
  const next = findNeighborCoordinates(
    day.items,
    itemIndex,
    1,
    coordinatesByPlaceId,
  );

  if (previous && next) return geographicMidpoint(previous, next);
  return previous ?? next;
}

function findNeighborCoordinates(
  items: ScheduledItem[],
  itemIndex: number,
  direction: -1 | 1,
  coordinatesByPlaceId: Map<string, Coordinates>,
): Coordinates | null {
  for (
    let index = itemIndex + direction;
    index >= 0 && index < items.length;
    index += direction
  ) {
    const item = items[index];
    if (item.type !== "place" || !item.placeId) continue;

    const coordinates = coordinatesByPlaceId.get(item.placeId);
    if (coordinates) return coordinates;
  }

  return null;
}

function buildRecommendationDescription(candidate: PlaceCandidate): string {
  const details = [];
  if (candidate.address) details.push(candidate.address);
  if (candidate.rating !== undefined) {
    details.push(`Rating ${candidate.rating.toFixed(1)} en Google`);
  }
  return details.join(" | ");
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeLongitude(value: number): number {
  return ((value + 540) % 360) - 180;
}
