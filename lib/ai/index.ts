import { createAnthropicProvider } from "./anthropic";
import { createGeminiProvider } from "./gemini";
import type { AiProvider, AiProviderName } from "./types";

export type {
  AiAssistantBlock,
  AiMessage,
  AiMessageResponse,
  AiProvider,
  AiProviderName,
  AiTextBlock,
  AiTool,
  AiToolResultBlock,
  AiToolUseBlock,
  CreateAiMessageInput,
} from "./types";

export function getAiProviderName(): AiProviderName {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (!configured || configured === "gemini") {
    return "gemini";
  }

  if (configured === "anthropic") {
    return "anthropic";
  }

  throw new Error(
    `Unsupported AI_PROVIDER "${configured}". Add its adapter in lib/ai and register it in getAiProvider().`,
  );
}

export function getAiProvider(): AiProvider {
  switch (getAiProviderName()) {
    case "gemini":
      return createGeminiProvider();
    case "anthropic":
      return createAnthropicProvider();
  }
}
