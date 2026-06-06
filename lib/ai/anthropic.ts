import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicClient() {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  return new Anthropic({
    apiKey: anthropicApiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });
}
