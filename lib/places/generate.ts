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
1. To be efficient, you SHOULD provide multiple "search_places" calls in a single response to cover different categories or interests (e.g., museums, restaurants, parks) simultaneously.
2. Aim to find at least 30-40 candidate places across your searches so you can then filter them down to the best 15-25.
3. Filter and curate the results to match the user's preferences and the trip's context perfectly.
4. Estimate a "defaultDurationMinutes" for each place (how long a typical visitor spends there).
5. Once you have a curated list of 15-25 unique places, call the "save_places" tool EXACTLY ONCE with the final list.
6. Do not include duplicates. Ensure the externalId (Google Place ID) is preserved.
7. Provide high-quality descriptions that explain why each place fits this specific trip.
8. Efficiency is key: try to complete the entire curation in as few turns as possible (ideally 2-3 rounds).`;

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
  let round = 0;
  let saved = false;

  while (round < 10 && !saved) {
    round++;
    const llmStartTime = Date.now();
    console.log(`[generatePlaces] Round ${round}: Requesting LLM response...`);
    
    let response;
    try {
      response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
      });
    } catch (error) {
      console.error(`[generatePlaces] Error in Round ${round}:`, error);
      if (curatedPlaces.length > 0) {
        console.warn(`[generatePlaces] Returning ${curatedPlaces.length} partially generated places due to error.`);
        return curatedPlaces;
      }
      throw error;
    }

    const llmDuration = Date.now() - llmStartTime;
    stopReason = response.stop_reason ?? undefined;
    console.log(`[generatePlaces] Round ${round}: LLM responded in ${llmDuration}ms. Stop reason: ${stopReason}`);

    messages.push({
      role: "assistant",
      content: response.content as Array<TextBlock | ToolUseBlock>,
    });

    const toolUseBlocks = response.content.filter(block => block.type === "tool_use") as ToolUseBlock[];
    
    if (toolUseBlocks.length > 0) {
      const toolStartTime = Date.now();
      console.log(`[generatePlaces] Round ${round}: Processing ${toolUseBlocks.length} tool calls...`);

      const toolResults = await Promise.all(toolUseBlocks.map(async (block) => {
        console.log(`[generatePlaces] Executing tool: ${block.name} (ID: ${block.id})`);
        
        if (block.name === "search_places") {
          try {
            const results = await searchPlaces({
              query: (block.input as { query: string }).query,
              latBias: input.lat,
              lngBias: input.lng,
            });
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify(results),
            };
          } catch (error) {
            console.error(`[generatePlaces] Tool search_places failed:`, error);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: `Error searching places: ${error instanceof Error ? error.message : String(error)}`,
              is_error: true,
            };
          }
        } else if (block.name === "save_places") {
          curatedPlaces = (block.input as { places: CuratedPlace[] }).places;
          saved = true;
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: "Places saved successfully.",
          };
        } else {
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: `Error: Unknown tool "${block.name}". Available tools: search_places, save_places.`,
            is_error: true,
          };
        }
      }));

      const toolDuration = Date.now() - toolStartTime;
      console.log(`[generatePlaces] Round ${round}: Tools executed in ${toolDuration}ms.`);
      messages.push({ role: "user", content: toolResults });
      
      if (saved) break;
    } else {
      // No tool calls in this response
      if (stopReason === "tool_use") {
        console.warn(`[generatePlaces] Round ${round}: stop_reason was tool_use but no tool_use blocks were found in content.`);
        messages.push({
          role: "user",
          content: "You said you wanted to use a tool but didn't provide a tool_use block. Please retry or call save_places.",
        });
      } else if (!saved && curatedPlaces.length === 0) {
        console.log(`[generatePlaces] Round ${round}: No tools and no places yet. Prodding LLM...`);
        messages.push({
          role: "user",
          content: "Please continue searching for places or call save_places if you have enough results.",
        });
      } else {
        // We have some results and no more tools, or we are done
        break;
      }
    }
  }

  console.log(`[generatePlaces] Completed across ${round} rounds. Total places: ${curatedPlaces.length}`);
  return curatedPlaces;
}
