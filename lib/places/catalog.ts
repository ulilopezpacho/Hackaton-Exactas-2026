import type { PlaceCandidate } from "./google";

export interface CuratedPlace {
  name: string;
  description: string;
  category: string;
  address: string;
  externalId: string;
  lat: number;
  lng: number;
  defaultDurationMinutes?: number;
  // Metadata joined back from Google Places API
  primaryType?: string;
  types?: string[];
  summary?: string;
  rating?: number;
  userRatingsTotal?: number;
  qualityScore?: number;
  popularity?: number;
}

/**
 * Bayesian shrinkage average for quality_score.
 * quality_score = (v / (v + m)) * R + (m / (v + m)) * C
 * R = avg rating, v = review count, C = mean rating (~3.5), m = confidence threshold (~50)
 */
export function computeQualityScore(rating?: number, total?: number): number | undefined {
  if (rating === undefined || total === undefined) return undefined;
  const m = 50;
  const C = 3.5;
  return (total / (total + m)) * rating + (m / (total + m)) * C;
}

/**
 * Log-dampened popularity score.
 * popularity = log10(user_ratings_total + 1)
 */
export function computePopularity(total?: number): number | undefined {
  if (total === undefined) return undefined;
  return Math.log10(total + 1);
}

/**
 * Normalizes a place name for fuzzy matching: lowercased, diacritics stripped,
 * non-alphanumerics removed. Used to recover metadata when the model returns a
 * mangled externalId but a recognizable name.
 */
export function normalizeName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Joins the model's curated selection back to the cached Google candidates.
 *
 * The cached candidate is the source of truth for identity and metadata; the
 * model's curation (description/category/duration) is preserved. Matching tries
 * the exact (trimmed) externalId first, then falls back to a normalized-name
 * lookup to recover real picks whose externalId the model garbled. Anything
 * that matches no searched result is dropped (it can't be a real, persistable
 * place) and reported in `dropped` as "name (externalId)".
 */
export function buildCuratedPlaces(
  rawSelection: CuratedPlace[],
  foundPlaces: Map<string, PlaceCandidate>,
): { curated: CuratedPlace[]; dropped: string[] } {
  const byName = new Map<string, PlaceCandidate>();
  for (const candidate of foundPlaces.values()) {
    const key = normalizeName(candidate.name);
    if (key && !byName.has(key)) byName.set(key, candidate);
  }

  const curated: CuratedPlace[] = [];
  const dropped: string[] = [];
  for (const p of rawSelection) {
    const meta =
      foundPlaces.get(p.externalId?.trim()) ?? byName.get(normalizeName(p.name));

    if (!meta) {
      dropped.push(`${p.name} (${p.externalId})`);
      continue;
    }

    curated.push({
      ...p,
      externalId: meta.externalId,
      name: meta.name || p.name,
      address: meta.address || p.address,
      lat: meta.lat ?? p.lat,
      lng: meta.lng ?? p.lng,
      primaryType: meta.primaryType,
      types: meta.types,
      summary: meta.summary,
      rating: meta.rating,
      userRatingsTotal: meta.userRatingsTotal,
      qualityScore: computeQualityScore(meta.rating, meta.userRatingsTotal),
      popularity: computePopularity(meta.userRatingsTotal),
    });
  }

  return { curated, dropped };
}

/**
 * A place the model picked during curation. Identity comes from `ref` (a short
 * token we assigned to each searched candidate); the model only authors the
 * curation fields. The bulky `description` is filled in by a separate parallel
 * pass — see generateDescriptions in generate.ts.
 */
export interface PlaceSelection {
  ref: string;
  category: string;
  defaultDurationMinutes?: number;
  description?: string;
}

/**
 * Ref-based variant of {@link buildCuratedPlaces}.
 *
 * Instead of having the model re-type opaque Google place IDs (and the name,
 * address, lat, lng we already cached) into the save tool, each searched
 * candidate is echoed back with a short `ref` like "p42". The model saves by
 * ref, so its output shrinks to just the fields it actually authors — which is
 * the single biggest lever on generation latency. Identity and all metadata are
 * read back here from `refToPlace`. A ref that matches nothing is dropped.
 *
 * `description` falls back to Google's editorial summary, then empty string,
 * when the description pass produced nothing for that ref.
 *
 * Duplicate picks (the same place selected under two refs, or the same ref
 * twice) are collapsed to the first occurrence — the catalog upsert is keyed on
 * (destination_id, external_id), so emitting the same place twice would crash
 * the batch with a Postgres ON CONFLICT error.
 */
export function buildCuratedFromRefs(
  selections: PlaceSelection[],
  refToPlace: Map<string, PlaceCandidate>,
): { curated: CuratedPlace[]; dropped: string[] } {
  const curated: CuratedPlace[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  for (const sel of selections) {
    const meta = refToPlace.get(sel.ref?.trim());

    if (!meta) {
      dropped.push(sel.ref);
      continue;
    }

    if (seen.has(meta.externalId)) continue;
    seen.add(meta.externalId);

    curated.push({
      name: meta.name,
      description: sel.description ?? meta.summary ?? "",
      category: sel.category,
      address: meta.address,
      externalId: meta.externalId,
      lat: meta.lat,
      lng: meta.lng,
      defaultDurationMinutes: sel.defaultDurationMinutes,
      primaryType: meta.primaryType,
      types: meta.types,
      summary: meta.summary,
      rating: meta.rating,
      userRatingsTotal: meta.userRatingsTotal,
      qualityScore: computeQualityScore(meta.rating, meta.userRatingsTotal),
      popularity: computePopularity(meta.userRatingsTotal),
    });
  }

  return { curated, dropped };
}
