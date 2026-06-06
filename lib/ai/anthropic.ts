import Anthropic from "@anthropic-ai/sdk";

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const allowInsecureTls = process.env.ANTHROPIC_ALLOW_INSECURE_TLS === "1";

export function createAnthropicClient() {
  if (!anthropicApiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  if (allowInsecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  return new Anthropic({
    apiKey: anthropicApiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });
}
