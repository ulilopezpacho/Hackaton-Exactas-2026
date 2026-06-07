import { afterEach, describe, expect, it } from "@jest/globals";

import { getAiProviderName } from "./index";

const originalProvider = process.env.AI_PROVIDER;

afterEach(() => {
  if (originalProvider === undefined) {
    delete process.env.AI_PROVIDER;
  } else {
    process.env.AI_PROVIDER = originalProvider;
  }
});

describe("getAiProviderName", () => {
  it("uses Gemini by default", () => {
    delete process.env.AI_PROVIDER;

    expect(getAiProviderName()).toBe("gemini");
  });

  it("normalizes the configured provider name", () => {
    process.env.AI_PROVIDER = " Gemini ";

    expect(getAiProviderName()).toBe("gemini");
  });

  it("keeps Anthropic available as an explicit provider", () => {
    process.env.AI_PROVIDER = "anthropic";

    expect(getAiProviderName()).toBe("anthropic");
  });

  it("rejects providers without a registered adapter", () => {
    process.env.AI_PROVIDER = "openai";

    expect(() => getAiProviderName()).toThrow(
      'Unsupported AI_PROVIDER "openai"',
    );
  });
});
