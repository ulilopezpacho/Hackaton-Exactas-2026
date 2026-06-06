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
  const anthropic = createAnthropicClient();

  const { places, userPreferences, tripCustomizationPrompt } = input;

  if (places.length === 0) return [];

  const systemPrompt = `You are a travel place scoring engine. You receive a list of places and a user profile, and you must assign a relevance score (1-100) to each place.

Scoring criteria:
- **Category match** (30%): How well the place's category aligns with the user's interests. A museum scores high for a user interested in "Arte" or "Historia".
- **Quality signals** (30%): Use rating, userRatingsTotal, qualityScore, and popularity. Higher ratings and more reviews indicate better quality. A place with rating 4.8 and 5000 reviews should score higher than one with 3.5 and 20 reviews.
- **User style fit** (20%): How well the place matches the user's pace, budget, and travel style prompt. A relaxed-pace user should score chill cafés higher; an intense-pace user should score more attractions higher.
- **Trip context** (20%): If a trip customization prompt is provided, prioritize places that match the specific trip goals.

Rules:
- Score each place independently on a 1-100 scale.
- Spread scores across the range — don't cluster everything at 70-80.
- If quality signals (rating, popularity) are null, rely more on category match and style fit.
- Provide a brief reasoning (1 sentence) for each score.
- Return ALL places — do not skip any.`;

  const placesPayload = places.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    rating: p.rating,
    userRatingsTotal: p.userRatingsTotal,
    qualityScore: p.qualityScore,
    popularity: p.popularity,
  }));

  const userMessage = `## User Profile
- Interests: ${userPreferences.interests.length > 0 ? userPreferences.interests.join(", ") : "Not specified"}
- Pace: ${userPreferences.pace ?? "Not specified"}
- Budget: ${userPreferences.budget ?? "Not specified"}
- Travel style: ${userPreferences.travelStylePrompt ?? "Not specified"}
${tripCustomizationPrompt ? `\n## Trip-specific preferences\n${tripCustomizationPrompt}` : ""}

## Places to score
${JSON.stringify(placesPayload, null, 2)}

Score each place and call the submit_scores tool with the results.`;

  const tools: Tool[] = [
    {
      name: "submit_scores",
      description:
        "Submit the final scores for all places. Call this exactly once with every place scored.",
      input_schema: {
        type: "object",
        properties: {
          scores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "The place ID" },
                score: {
                  type: "number",
                  description: "Relevance score from 1 to 100",
                },
                reasoning: {
                  type: "string",
                  description: "Brief explanation for the score",
                },
              },
              required: ["id", "score", "reasoning"],
            },
          },
        },
        required: ["scores"],
      },
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    tools,
    tool_choice: { type: "tool", name: "submit_scores" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolBlock = response.content.find(
    (block): block is ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_scores",
  );

  if (!toolBlock) {
    console.error("[scorePlaces] Claude did not call submit_scores");
    return places.map((p) => ({ id: p.id, score: 50, reasoning: "Fallback score" }));
  }

  const result = toolBlock.input as { scores: ScoredPlace[] };

  return result.scores
    .map((s) => ({
      id: s.id,
      score: Math.max(1, Math.min(100, Math.round(s.score))),
      reasoning: s.reasoning,
    }))
    .sort((a, b) => b.score - a.score);
}
