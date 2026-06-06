import { createAnthropicClient } from "../ai/anthropic";
import { searchPlaces, type PlaceCandidate } from "./google";
import {
  buildCuratedFromRefs,
  type CuratedPlace,
  type PlaceSelection,
} from "./catalog";
import type {
  TextBlock,
  ToolUseBlock,
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages.mjs";

export type { CuratedPlace } from "./catalog";

const MODEL = "claude-haiku-4-5";
/**
 * Places per concurrent description request. Any batch that gets rejected (e.g.
 * an upstream 429) just falls back to Google summaries.
 */
const DESCRIPTION_BATCH_SIZE = 6;

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

  // The model curates by short `ref` tokens instead of re-typing opaque Google
  // place IDs. We assign one ref per unique candidate and can look the full
  // candidate back up by ref when assembling the final catalog.
  const refToPlace = new Map<string, PlaceCandidate>();
  const refByExternalId = new Map<string, string>();
  const refFor = (candidate: PlaceCandidate): string => {
    let ref = refByExternalId.get(candidate.externalId);
    if (!ref) {
      ref = `p${refToPlace.size}`;
      refByExternalId.set(candidate.externalId, ref);
      refToPlace.set(ref, candidate);
    }
    return ref;
  };

  let selections: PlaceSelection[] = [];

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
5. For each selected place, choose a "category" that fits the trip context and estimate a "defaultDurationMinutes" (how long a typical visitor spends there).
6. CRITICAL: Identify each place by its "ref" — the short token (e.g. "p12") shown next to it in the search results. Copy the ref EXACTLY. Any selection whose ref does not match a search result will be discarded.
7. You do NOT write descriptions or any other metadata here. Names, addresses, ratings, and neutral descriptions are all attached automatically from the ref. Focus only on picking the best places and assigning a category and duration.
8. Once your selection is complete, call "save_places" EXACTLY ONCE with your final list.
9. Efficiency is key: try to complete the entire curation in as few turns as possible (ideally 2-3 rounds).`;

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
                ref: {
                  type: "string",
                  description:
                    "The short ref token of the chosen search result, e.g. 'p12'. Copy it exactly.",
                },
                category: { type: "string" },
                defaultDurationMinutes: { type: "number" },
              },
              required: ["ref", "category"],
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
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        tools,
        messages,
      });
    } catch (error) {
      console.error(`[generatePlaces] Error in Round ${round}:`, error);
      if (selections.length > 0) {
        console.warn(`[generatePlaces] Returning ${selections.length} curated places (Google summaries as descriptions) due to error.`);
        return buildCuratedFromRefs(selections, refToPlace).curated;
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
            // echo back the fields the model needs to curate. The opaque Google
            // ID is replaced with a short `ref` so the model never has to retype
            // it — that, plus dropping descriptions from save_places, is what
            // keeps the final generation fast.
            const slim = results.map((r) => ({
              ref: refFor(r),
              name: r.name,
              address: r.address,
              primaryType: r.primaryType,
              rating: r.rating,
              userRatingsTotal: r.userRatingsTotal,
            }));

            const content = JSON.stringify(slim);
            console.log(
              `[generatePlaces] search_places "${(block.input as { query: string }).query}" -> ${results.length} rows (${content.length} chars). Cache now holds ${refToPlace.size} unique places.`,
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
          // The model saves by `ref`; any ref that matches no searched result
          // is dropped when the catalog is assembled. Descriptions are filled in
          // afterwards by a separate parallel pass.
          selections = (block.input as { places: PlaceSelection[] }).places;

          const unknown = selections.filter(
            (s) => !refToPlace.has(s.ref?.trim()),
          ).length;
          console.log(
            `[generatePlaces] save_places -> ${selections.length} refs submitted, ${unknown} unmatched.`,
          );

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
      } else if (!saved && selections.length === 0) {
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

  console.log(`[generatePlaces] Curation complete across ${round} rounds. ${selections.length} places selected.`);

  // Phase 2: write the neutral descriptions in parallel. This is the heavy
  // output work, and the descriptions are independent of one another, so we
  // batch and fan them out concurrently instead of streaming one giant tool
  // call. Anything left without a description falls back to Google's editorial
  // summary in buildCuratedFromRefs.
  await fillDescriptions(anthropic, input.destination, selections, refToPlace);

  const { curated, dropped } = buildCuratedFromRefs(selections, refToPlace);
  if (dropped.length > 0) {
    console.warn(
      `[generatePlaces] Dropped ${dropped.length} selection(s) with no matching searched result:`,
      dropped,
    );
  }

  console.log(`[generatePlaces] Completed. Total places: ${curated.length}`);
  return curated;
}

/**
 * Generates a neutral, objective description for each selected place, mutating
 * `selections[].description` in place. Work is split into fixed-size batches run
 * concurrently; a failed or incomplete batch simply leaves those descriptions
 * unset (buildCuratedFromRefs then falls back to the Google summary).
 */
async function fillDescriptions(
  anthropic: ReturnType<typeof createAnthropicClient>,
  destination: string,
  selections: PlaceSelection[],
  refToPlace: Map<string, PlaceCandidate>,
): Promise<void> {
  const resolved = selections.filter((s) => refToPlace.has(s.ref?.trim()));
  if (resolved.length === 0) return;

  const batches: PlaceSelection[][] = [];
  for (let i = 0; i < resolved.length; i += DESCRIPTION_BATCH_SIZE) {
    batches.push(resolved.slice(i, i + DESCRIPTION_BATCH_SIZE));
  }

  const tool: Tool = {
    name: "save_descriptions",
    description: "Save a neutral, objective description for each place ref.",
    input_schema: {
      type: "object",
      properties: {
        descriptions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ref: { type: "string" },
              description: { type: "string" },
            },
            required: ["ref", "description"],
          },
        },
      },
      required: ["descriptions"],
    },
  };

  const system = `You write neutral, objective, durable descriptions of places in ${destination}. Each description states what the place actually is (e.g. "A 19th-century gothic cathedral known for its stained glass"), not how a specific traveler should use it. Keep each to 1-2 sentences. Reuse the provided Google note as a factual basis when present, but rewrite it cleanly.`;

  const startTime = Date.now();
  console.log(
    `[generatePlaces] Generating descriptions for ${resolved.length} places across ${batches.length} parallel batches...`,
  );

  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const list = batch
        .map((s) => {
          const place = refToPlace.get(s.ref.trim())!;
          const note = place.summary ? ` — Google note: ${place.summary}` : "";
          const type = place.primaryType ? ` (${place.primaryType})` : "";
          return `- ref ${s.ref}: ${place.name}${type}${note}`;
        })
        .join("\n");

      try {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system,
          tools: [tool],
          tool_choice: { type: "tool", name: "save_descriptions" },
          messages: [
            {
              role: "user",
              content: `Write a neutral description for each place below. Return every ref.\n\n${list}`,
            },
          ],
        });

        const out = new Map<string, string>();
        for (const block of response.content) {
          if (block.type === "tool_use" && block.name === "save_descriptions") {
            const items = (
              block.input as {
                descriptions: Array<{ ref: string; description: string }>;
              }
            ).descriptions;
            for (const d of items) out.set(d.ref?.trim(), d.description);
          }
        }
        return out;
      } catch (error) {
        // Descriptions are best-effort: any failure (commonly a 429 from the
        // upstream rate limit) just leaves these refs without a model-written
        // description, and buildCuratedFromRefs falls back to the Google summary.
        const status = (error as { status?: number }).status;
        const reason = status === 429 ? "rate limited (429)" : (error as Error).message;
        console.warn(
          `[generatePlaces] Description batch skipped (${reason}); falling back to Google summaries for ${batch.length} place(s).`,
        );
        return new Map<string, string>();
      }
    }),
  );

  const byRef = new Map<string, string>();
  for (const result of batchResults) {
    for (const [ref, description] of result) byRef.set(ref, description);
  }

  let filled = 0;
  for (const s of selections) {
    const description = byRef.get(s.ref?.trim());
    if (description) {
      s.description = description;
      filled++;
    }
  }

  console.log(
    `[generatePlaces] Descriptions done in ${Date.now() - startTime}ms (${filled}/${resolved.length} written, rest fall back to Google summaries).`,
  );
}
