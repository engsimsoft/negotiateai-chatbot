import { createAnthropic } from "@ai-sdk/anthropic";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

/**
 * AI Provider Configuration
 *
 * Primary provider: Anthropic Claude (via @ai-sdk/anthropic)
 * Model map: claude-haiku (fast), claude-sonnet (balanced), claude-opus (best quality)
 *
 * Google Gemini retained only for vision-ocr.ts (separate instance, not through myProvider).
 */

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "claude-sonnet": chatModel,
          "claude-haiku": chatModel,
          "claude-opus": chatModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "claude-sonnet": anthropic("claude-sonnet-4-5-20250929"),
        "claude-haiku": anthropic("claude-haiku-4-5-20251001"),
        "claude-opus": anthropic("claude-opus-4-6"),
        "claude-sonnet-4-6": anthropic("claude-sonnet-4-6"),
        "title-model": anthropic("claude-haiku-4-5-20251001"),
        "artifact-model": anthropic("claude-sonnet-4-5-20250929"),
      },
    });

// Direct model exports for pipelines and clerks
export const claudeHaiku = anthropic("claude-haiku-4-5-20251001");
export const claudeSonnet = anthropic("claude-sonnet-4-5-20250929");
export const claudeOpus = anthropic("claude-opus-4-6");

export function getClaudeModel(name: "haiku" | "sonnet" | "opus") {
  switch (name) {
    case "haiku":
      return claudeHaiku;
    case "opus":
      return claudeOpus;
    default:
      return claudeSonnet;
  }
}
