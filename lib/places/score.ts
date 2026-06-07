import { createAnthropicClient } from "../ai/anthropic";
import type {
  ToolUseBlock,
  Tool,
} from "@anthropic-ai/sdk/resources/messages.mjs";

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

export async function scorePlaces(
  input: ScorePlacesInput,
): Promise<ScoredPlace[]> {
  const { places } = input;

  if (places.length === 0) return [];

  console.log(`[scorePlaces] MOCKING scores for ${places.length} places...`);

  const scoredPlaces: ScoredPlace[] = places.map((p) => ({
    id: p.id,
    score: Math.floor(Math.random() * 100) + 1,
    reasoning: "Randomly assigned score (MOCKED)",
  }));

  return scoredPlaces.sort((a, b) => b.score - a.score);
}
