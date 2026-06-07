export type AiProviderName = "gemini" | "anthropic";

export interface AiTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AiTextBlock {
  type: "text";
  text: string;
  providerMetadata?: unknown;
}

export interface AiToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
  providerMetadata?: unknown;
}

export interface AiToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  toolName: string;
  content: string;
  isError?: boolean;
}

export type AiAssistantBlock = AiTextBlock | AiToolUseBlock;

export type AiMessage =
  | {
      role: "user";
      content: string | AiToolResultBlock[];
    }
  | {
      role: "assistant";
      content: AiAssistantBlock[];
    };

export type AiToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "tool"; name: string };

export interface CreateAiMessageInput {
  model?: string;
  maxTokens: number;
  system?: string;
  messages: AiMessage[];
  tools?: AiTool[];
  toolChoice?: AiToolChoice;
}

export interface AiMessageResponse {
  model: string;
  stopReason?: string;
  content: AiAssistantBlock[];
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly defaultModel: string;
  createMessage(input: CreateAiMessageInput): Promise<AiMessageResponse>;
}
