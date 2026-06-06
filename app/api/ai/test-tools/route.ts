import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";

import { createAnthropicClient } from "@/lib/ai/anthropic";

export const runtime = "nodejs";

const getTripContext = betaTool({
  name: "get_trip_context",
  description: "Devuelve preferencias y lugares candidatos para armar un itinerario de viaje.",
  inputSchema: {
    type: "object",
    properties: {
      destination: {
        type: "string",
        description: "Ciudad o destino del viaje.",
      },
    },
    required: ["destination"],
    additionalProperties: false,
  },
  run: async ({ destination }) =>
    JSON.stringify({
      destination,
      days: 3,
      pace: "tranquilo",
      interests: ["cafes", "museos", "barrios historicos"],
      mustSeePlaces: ["Museo del Prado", "Parque del Retiro", "Plaza Mayor"],
    }),
});

export async function POST(request: Request) {
  const { prompt = "Armá un resumen breve de un viaje de 3 días a Madrid usando la tool." } =
    (await request.json().catch(() => ({}))) as { prompt?: string };

  try {
    const runner = createAnthropicClient().beta.messages.toolRunner({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
      tools: [getTripContext],
    });

    const message = await runner.runUntilDone();

    return Response.json({
      ok: true,
      model: message.model,
      stopReason: message.stop_reason,
      content: message.content,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Anthropic error",
      },
      { status: 500 },
    );
  }
}
