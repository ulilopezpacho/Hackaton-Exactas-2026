export interface PlaceForScoring {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  qualityScore: number | null;
  popularity: number | null;
}

export interface UserPreferencesForScoring {
  interests: string[];
  pace: string | null;
  budget: string | null;
  travelStylePrompt: string | null;
}

export interface ScorePlacesInput {
  places: PlaceForScoring[];
  userPreferences: UserPreferencesForScoring;
  tripCustomizationPrompt?: string;
}

export interface ScoredPlace {
  id: string;
  score: number;
  reasoning: string;
}

// qualityScore is on a 1–5 Bayesian scale; normalize to 0–100.
// popularity is log10(reviews + 1), max ~4 for 10k reviews; clamp to 0–100.
export async function scorePlaces(
  input: ScorePlacesInput,
): Promise<ScoredPlace[]> {
  const { places } = input;

  if (places.length === 0) return [];

  const scored: ScoredPlace[] = places.map((p) => {
    const qualityNorm =
      p.qualityScore != null ? ((p.qualityScore - 1) / 4) * 100 : null;
    const popularityNorm =
      p.popularity != null ? Math.min(p.popularity / 4, 1) * 100 : null;

    let score: number;
    if (qualityNorm != null && popularityNorm != null) {
      score = 0.7 * qualityNorm + 0.3 * popularityNorm;
    } else if (qualityNorm != null) {
      score = qualityNorm;
    } else if (popularityNorm != null) {
      score = popularityNorm;
    } else {
      score = 50;
    }

    return { id: p.id, score: Math.round(score), reasoning: "global" };
  });

  return scored.sort((a, b) => b.score - a.score);
}
