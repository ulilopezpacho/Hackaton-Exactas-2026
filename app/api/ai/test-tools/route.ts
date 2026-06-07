import {
  getAiProvider,
  type AiMessage,
  type AiTool,
  type AiToolResultBlock,
  type AiToolUseBlock,
} from "@/lib/ai";

export const runtime = "nodejs";

const getTripContextTool: AiTool = {
  name: "get_trip_context",
  description:
    "Devuelve preferencias y lugares candidatos para armar un itinerario de viaje.",
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
};

function runGetTripContext(input: unknown): string {
  const destination =
    typeof input === "object" &&
    input !== null &&
    "destination" in input &&
    typeof input.destination === "string"
      ? input.destination
      : "Madrid";

  return JSON.stringify({
    destination,
    days: 3,
    pace: "tranquilo",
    interests: ["cafes", "museos", "barrios historicos"],
    mustSeePlaces: ["Museo del Prado", "Parque del Retiro", "Plaza Mayor"],
  });
}

export async function POST(request: Request) {
  const {
    prompt = "Arma un resumen breve de un viaje de 3 dias a Madrid usando la tool.",
  } = (await request.json().catch(() => ({}))) as { prompt?: string };

  try {
    const provider = getAiProvider();
    const messages: AiMessage[] = [{ role: "user", content: prompt }];

    let message;
    for (let round = 0; round < 5; round++) {
      message = await provider.createMessage({
        maxTokens: 700,
        messages,
        tools: [getTripContextTool],
      });

      const toolCalls = message.content.filter(
        (block): block is AiToolUseBlock => block.type === "tool_use",
      );
      if (toolCalls.length === 0) break;

      const toolResults: AiToolResultBlock[] = toolCalls.map((block) => ({
        type: "tool_result",
        toolUseId: block.id,
        toolName: block.name,
        content:
          block.name === getTripContextTool.name
            ? runGetTripContext(block.input)
            : `Unknown tool: ${block.name}`,
        isError: block.name !== getTripContextTool.name,
      }));

      messages.push({ role: "assistant", content: message.content });
      messages.push({ role: "user", content: toolResults });
    }

    if (!message) {
      throw new Error("The AI provider did not return a message.");
    }

    return Response.json({
      ok: true,
      provider: provider.name,
      model: message.model,
      stopReason: message.stopReason,
      content: message.content,
    });
  } catch (error) {
    console.error("AI test-tools route failed", error);
    return Response.json(
      {
        ok: false,
        error: "No se pudo completar la prueba de herramientas de IA.",
      },
      { status: 500 },
    );
  }
}
