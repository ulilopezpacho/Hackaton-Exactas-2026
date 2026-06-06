import { createAnthropicClient } from "../ai/anthropic";
import { searchPlaces } from "./google";
import type {
  TextBlock,
  ToolUseBlock,
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages.mjs";

export interface CuratedPlace {
  name: string;
  description: string;
  category: string;
  address: string;
  externalId: string;
  lat: number;
  lng: number;
  defaultDurationMinutes?: number;
}

export interface GeneratePlacesInput {
  destination: string;
  title: string;
  startsOn: string;
  endsOn: string;
  interests: string[];
  pace?: string;
  budget?: string;
  travelStylePrompt?: string;
  lat: number;
  lng: number;
}

export async function generatePlaces(
  input: GeneratePlacesInput,
): Promise<CuratedPlace[]> {
  const anthropic = createAnthropicClient();
  let curatedPlaces: CuratedPlace[] = [];

  const systemPrompt = `You are an expert travel catalog curator. Your goal is to find and curate a list of 15-25 high-quality places for a trip to ${
    input.destination
  }.

Trip Context:
- Title: ${input.title}
- Dates: ${input.startsOn} to ${input.endsOn}
- Interests: ${input.interests.join(", ")}
- Pace: ${input.pace || "balanced"}
- Budget: ${input.budget || "medium"}
- Style: ${input.travelStylePrompt || "Not specified"}

Instructions:
1. Use the "search_places" tool to find real places in the destination. You can call it multiple times with different queries based on the user's interests.
2. Filter and curate the results to match the user's preferences and the trip's context.
3. Estimate a "defaultDurationMinutes" for each place (how long a typical visitor spends there).
4. Once you have a curated list of 15-25 unique places, call the "save_places" tool EXACTLY ONCE with the final list.
5. Do not include duplicates. Ensure the externalId (Google Place ID) is preserved.
6. Provide high-quality descriptions that explain why each place fits this specific trip.`;

  const messages: MessageParam[] = [
    {
      role: "user",
      content: `Find and curate 15-25 places for my trip to ${input.destination}.`,
    },
  ];

  const tools: Tool[] = [
    {
      name: "search_places",
      description: "Search for real places using the Google Places API.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query (e.g., 'best museums in Paris', 'hidden gem restaurants').",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "save_places",
      description:
        "Terminal tool to save the final curated list of places. Call this exactly once when finished.",
      input_schema: {
        type: "object",
        properties: {
          places: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                category: { type: "string" },
                address: { type: "string" },
                externalId: { type: "string" },
                lat: { type: "number" },
                lng: { type: "number" },
                defaultDurationMinutes: { type: "number" },
              },
              required: [
                "name",
                "description",
                "category",
                "address",
                "externalId",
                "lat",
                "lng",
              ],
            },
          },
        },
        required: ["places"],
      },
    },
  ];

  let stopReason: string | undefined;

  while (stopReason !== "tool_use" || curatedPlaces.length === 0) {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    stopReason = response.stop_reason ?? undefined;
    messages.push({
      role: "assistant",
      content: response.content as Array<TextBlock | ToolUseBlock>,
    });

    if (stopReason === "tool_use") {
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];
      let saved = false;

      for (const block of response.content) {
        if (block.type === "tool_use") {
          if (block.name === "search_places") {
            const results = await searchPlaces({
              query: (block.input as { query: string }).query,
              latBias: input.lat,
              lngBias: input.lng,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(results),
            });
          } else if (block.name === "save_places") {
            curatedPlaces = (block.input as { places: CuratedPlace[] }).places;
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "Places saved successfully.",
            });
            saved = true;
          }
        }
      }

      messages.push({ role: "user", content: toolResults });
      if (saved) break;
    } else {
      if (curatedPlaces.length === 0) {
        messages.push({
          role: "user",
          content:
            "Please continue searching or call save_places if you have enough results.",
        });
      } else {
        break;
      }
    }
  }

  return curatedPlaces;
}
