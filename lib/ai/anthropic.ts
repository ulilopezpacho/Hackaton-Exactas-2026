import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  MessageParam,
  Tool,
  ToolChoice,
} from "@anthropic-ai/sdk/resources/messages.mjs";

import type {
  AiAssistantBlock,
  AiMessage,
  AiProvider,
  AiToolResultBlock,
  CreateAiMessageInput,
} from "./types";

const DEFAULT_MODEL = "claude-haiku-4-5";

function createAnthropicClient() {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  return new Anthropic({
    apiKey: anthropicApiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });
}

function toAnthropicMessage(message: AiMessage): MessageParam {
  if (typeof message.content === "string") {
    return { role: message.role, content: message.content };
  }

  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content.map((block) =>
        block.type === "text"
          ? { type: "text" as const, text: block.text }
          : {
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: block.input,
            },
      ),
    };
  }

  return {
    role: "user",
    content: message.content.map((block: AiToolResultBlock) => ({
      type: "tool_result" as const,
      tool_use_id: block.toolUseId,
      content: block.content,
      is_error: block.isError,
    })),
  };
}

function toAssistantBlock(block: ContentBlock): AiAssistantBlock | null {
  if (block.type === "text") {
    return { type: "text", text: block.text };
  }

  if (block.type === "tool_use") {
    return {
      type: "tool_use",
      id: block.id,
      name: block.name,
      input: block.input,
    };
  }

  return null;
}

export function createAnthropicProvider(): AiProvider {
  const client = createAnthropicClient();

  return {
    name: "anthropic",
    defaultModel: DEFAULT_MODEL,
    async createMessage(input: CreateAiMessageInput) {
      const response = await client.messages.create({
        model: input.model ?? process.env.AI_MODEL ?? DEFAULT_MODEL,
        max_tokens: input.maxTokens,
        system: input.system,
        messages: input.messages.map(toAnthropicMessage),
        tools: input.tools?.map(
          (tool): Tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema as Tool["input_schema"],
          }),
        ),
        tool_choice: input.toolChoice as ToolChoice | undefined,
      });

      return {
        model: response.model,
        stopReason: response.stop_reason ?? undefined,
        content: response.content
          .map(toAssistantBlock)
          .filter((block): block is AiAssistantBlock => block !== null),
      };
    },
  };
}
