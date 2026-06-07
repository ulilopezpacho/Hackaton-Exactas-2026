import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
  type GenerateContentConfig,
  type Part,
} from "@google/genai";

import type {
  AiAssistantBlock,
  AiMessage,
  AiProvider,
  AiToolChoice,
  AiToolResultBlock,
  CreateAiMessageInput,
} from "./types";

const DEFAULT_MODEL = "gemma-4-31b-it";
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return new GoogleGenAI({ apiKey });
}

function parseToolResult(result: AiToolResultBlock): Record<string, unknown> {
  if (result.isError) {
    return { error: result.content };
  }

  try {
    const parsed: unknown = JSON.parse(result.content);
    return { result: parsed };
  } catch {
    return { result: result.content };
  }
}

function toGeminiContents(messages: AiMessage[]): Content[] {
  return messages.map((message): Content => {
    if (typeof message.content === "string") {
      return {
        role: "user",
        parts: [{ text: message.content }],
      };
    }

    if (message.role === "assistant") {
      return {
        role: "model",
        parts: message.content.map((block): Part => {
          const thoughtSignature = (
            block.providerMetadata as { thoughtSignature?: string } | undefined
          )?.thoughtSignature;

          if (block.type === "text") {
            return { text: block.text, thoughtSignature };
          }

          return {
            functionCall: {
              id: block.id,
              name: block.name,
              args:
                typeof block.input === "object" && block.input !== null
                  ? (block.input as Record<string, unknown>)
                  : {},
            },
            thoughtSignature,
          };
        }),
      };
    }

    return {
      role: "user",
      parts: message.content.map(
        (result): Part => ({
          functionResponse: {
            id: result.toolUseId,
            name: result.toolName,
            response: parseToolResult(result),
          },
        }),
      ),
    };
  });
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return undefined;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function generateContentWithRetry(
  client: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.models.generateContent(params);
    } catch (error) {
      const status = getErrorStatus(error);
      if (
        attempt >= MAX_RETRIES ||
        status === undefined ||
        !RETRYABLE_STATUSES.has(status)
      ) {
        throw error;
      }

      const delay = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
      console.warn(
        `[gemini] Request failed with status ${status}; retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES}).`,
      );
      await wait(delay);
    }
  }
}

function toFunctionCallingConfig(toolChoice?: AiToolChoice) {
  if (!toolChoice || toolChoice.type === "auto") {
    return { mode: FunctionCallingConfigMode.AUTO };
  }

  if (toolChoice.type === "any") {
    return { mode: FunctionCallingConfigMode.ANY };
  }

  return {
    mode: FunctionCallingConfigMode.ANY,
    allowedFunctionNames: [toolChoice.name],
  };
}

function toAssistantBlocks(parts: Part[]): AiAssistantBlock[] {
  return parts.flatMap((part, index): AiAssistantBlock[] => {
    const providerMetadata = part.thoughtSignature
      ? { thoughtSignature: part.thoughtSignature }
      : undefined;

    if (part.functionCall?.name) {
      return [
        {
          type: "tool_use",
          id: part.functionCall.id ?? `gemini-call-${index}`,
          name: part.functionCall.name,
          input: part.functionCall.args ?? {},
          providerMetadata,
        },
      ];
    }

    if (part.text && !part.thought) {
      return [
        {
          type: "text",
          text: part.text,
          providerMetadata,
        },
      ];
    }

    return [];
  });
}

export function createGeminiProvider(): AiProvider {
  const client = createGeminiClient();

  return {
    name: "gemini",
    defaultModel: DEFAULT_MODEL,
    async createMessage(input: CreateAiMessageInput) {
      const config: GenerateContentConfig = {
        maxOutputTokens: input.maxTokens,
        systemInstruction: input.system,
        tools: input.tools?.length
          ? [
              {
                functionDeclarations: input.tools.map(
                  (tool): FunctionDeclaration => ({
                    name: tool.name,
                    description: tool.description,
                    parametersJsonSchema: tool.inputSchema,
                  }),
                ),
              },
            ]
          : undefined,
        toolConfig: input.tools?.length
          ? { functionCallingConfig: toFunctionCallingConfig(input.toolChoice) }
          : undefined,
      };

      const response = await generateContentWithRetry(client, {
        model: input.model ?? process.env.AI_MODEL ?? DEFAULT_MODEL,
        contents: toGeminiContents(input.messages),
        config,
      });
      const candidate = response.candidates?.[0];
      const content = toAssistantBlocks(candidate?.content?.parts ?? []);
      const hasToolUse = content.some((block) => block.type === "tool_use");

      return {
        model:
          response.modelVersion ??
          input.model ??
          process.env.AI_MODEL ??
          DEFAULT_MODEL,
        stopReason: hasToolUse
          ? "tool_use"
          : candidate?.finishReason?.toLowerCase(),
        content,
      };
    },
  };
}
