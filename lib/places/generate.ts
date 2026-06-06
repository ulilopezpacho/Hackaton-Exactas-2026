import { createAnthropicClient } from "../ai/anthropic";
import { searchPlaces, type PlaceCandidate } from "./google";
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
  // Metadata joined back from Google Places API
  primaryType?: string;
  types?: string[];
  summary?: string;
  rating?: number;
  userRatingsTotal?: number;
  qualityScore?: number;
  popularity?: number;
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

/**
 * Bayesian shrinkage average for quality_score.
 * quality_score = (v / (v + m)) * R + (m / (v + m)) * C
 * R = avg rating, v = review count, C = mean rating (~3.5), m = confidence threshold (~50)
 */
function computeQualityScore(rating?: number, total?: number): number | undefined {
  if (rating === undefined || total === undefined) return undefined;
  const m = 50;
  const C = 3.5;
  return (total / (total + m)) * rating + (m / (total + m)) * C;
}

/**
 * Log-dampened popularity score.
 * popularity = log10(user_ratings_total + 1)
 */
function computePopularity(total?: number): number | undefined {
  if (total === undefined) return undefined;
  return Math.log10(total + 1);
}

/**
 * Normalizes a place name for fuzzy matching: lowercased, diacritics stripped,
 * non-alphanumerics removed. Used to recover metadata when the model returns a
 * mangled externalId but a recognizable name.
 */
function normalizeName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function generatePlaces(
  input: GeneratePlacesInput,
): Promise<CuratedPlace[]> {
  const anthropic = createAnthropicClient();
  let curatedPlaces: CuratedPlace[] = [];
  const allFoundPlaces = new Map<string, PlaceCandidate>();

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
3. ONLY select places that literally appear in your "search_places" results. Never invent, guess, or recall a place from your own knowledge. If you want a place you have not found yet, run another search first — do not make it up.
4. From the search results, select the 15-25 places that best fit the user's preferences and trip context. Do not include duplicates.
5. For each selected place, provide a high-quality "description". This MUST be a **neutral, objective description** of what the place is (e.g., "A 19th-century gothic cathedral known for its stained glass" rather than "A great spot for your morning walk"). It should be durable and reusable for any traveler.
6. Estimate a "defaultDurationMinutes" for each place (how long a typical visitor spends there).
7. CRITICAL: Copy each "externalId" CHARACTER-FOR-CHARACTER from the exact search result you are selecting. These are opaque Google Place IDs (e.g., "ChIJ..."). Never shorten, edit, reformat, or fabricate them. Copy the "name", "address", "lat", and "lng" from that same search result too. Any place whose externalId does not exactly match a search result will be discarded.
8. Once your selection is complete, call "save_places" EXACTLY ONCE with your final list.
9. You do not need to provide technical metadata like primaryType, types, or ratings. These are joined back automatically from the externalId — which is exactly why the externalId must match a real search result. Focus your effort on curation and high-quality neutral descriptions.
10. Efficiency is key: try to complete the entire curation in as few turns as possible (ideally 2-3 rounds).`;

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
        max_tokens: 8192,
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

    if (stopReason === "max_tokens") {
      console.warn(
        `[generatePlaces] Round ${round}: hit max_tokens — the response was truncated and any tool call in it may be incomplete. Consider raising max_tokens or trimming tool-result payloads.`,
      );
    }

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

            // Cache the full candidate for joining metadata later, but only
            // echo back the fields the model needs to curate. Sending the full
            // payload (types[], summary, lat/lng) for every result across rounds
            // is what blows up the token budget once the cache grows large.
            const slim = results.map((r) => {
              allFoundPlaces.set(r.externalId, r);
              return {
                externalId: r.externalId,
                name: r.name,
                address: r.address,
                primaryType: r.primaryType,
                rating: r.rating,
                userRatingsTotal: r.userRatingsTotal,
              };
            });

            const content = JSON.stringify(slim);
            console.log(
              `[generatePlaces] search_places "${(block.input as { query: string }).query}" -> ${results.length} rows (${content.length} chars). Cache now holds ${allFoundPlaces.size} unique places.`,
            );

            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content,
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
          const rawSelection = (block.input as { places: CuratedPlace[] }).places;

          // The model sometimes returns a mangled/invented externalId, which would
          // miss the metadata join entirely. Fall back to matching by normalized
          // name so we recover real selections, and drop anything that matches no
          // searched result (it can't be a real, persistable place anyway).
          const byName = new Map<string, PlaceCandidate>();
          for (const candidate of allFoundPlaces.values()) {
            const key = normalizeName(candidate.name);
            if (key && !byName.has(key)) byName.set(key, candidate);
          }

          const dropped: string[] = [];
          curatedPlaces = [];
          for (const p of rawSelection) {
            const meta =
              allFoundPlaces.get(p.externalId?.trim()) ??
              byName.get(normalizeName(p.name));

            if (!meta) {
              dropped.push(`${p.name} (${p.externalId})`);
              continue;
            }

            // Cached Google candidate is the source of truth for identity and
            // metadata; keep the model's curation (description/category/duration).
            curatedPlaces.push({
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

          console.log(
            `[generatePlaces] save_places -> ${rawSelection.length} rows submitted, ${curatedPlaces.length} kept, ${dropped.length} dropped.`,
          );

          if (dropped.length > 0) {
            console.warn(
              `[generatePlaces] Dropped ${dropped.length} curated place(s) with no matching searched result:`,
              dropped,
            );
          }

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
