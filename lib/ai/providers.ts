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
        "claude-sonnet": anthropic("claude-sonnet-4-6"),
        "claude-haiku": anthropic("claude-haiku-4-5-20251001"),
        "claude-opus": anthropic("claude-opus-4-6"),
        "claude-sonnet-4-6": anthropic("claude-sonnet-4-6"),
        "title-model": anthropic("claude-haiku-4-5-20251001"),
        "artifact-model": anthropic("claude-sonnet-4-6"),
      },
    });

// Direct model exports for pipelines and clerks
export const claudeHaiku = anthropic("claude-haiku-4-5-20251001");
export const claudeSonnet = anthropic("claude-sonnet-4-6");
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

// ---------------------------------------------------------------------------
// Model Pricing (RUB per 1K tokens, rate 100 RUB/USD — includes margin)
// Used by Developer Panel for cost estimation
// ---------------------------------------------------------------------------

interface ModelPricing {
  input: number;   // RUB per 1K input tokens
  output: number;  // RUB per 1K output tokens
  cached: number;  // RUB per 1K cached input tokens
}

const MODEL_PRICING_RUB: Record<string, ModelPricing> = {
  // Anthropic Claude (USD prices × 100)
  // Haiku:  $0.80/1M in, $4/1M out, $0.08/1M cached
  // Sonnet: $3/1M in, $15/1M out, $0.30/1M cached
  // Opus:   $15/1M in, $75/1M out, $1.50/1M cached
  "claude-sonnet-4-6":           { input: 0.30,  output: 1.50,  cached: 0.030 },
  "claude-haiku-4-5-20251001":   { input: 0.08,  output: 0.40,  cached: 0.008 },
  "claude-opus-4-6":             { input: 1.50,  output: 7.50,  cached: 0.150 },
  // Aliases (myProvider keys → same pricing)
  "claude-sonnet":               { input: 0.30,  output: 1.50,  cached: 0.030 },
  "claude-haiku":                { input: 0.08,  output: 0.40,  cached: 0.008 },
  "claude-opus":                 { input: 1.50,  output: 7.50,  cached: 0.150 },
};

export interface TokenUsageForPricing {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export function calculateCostRub(
  modelId: string,
  usage: TokenUsageForPricing,
): number {
  const pricing = MODEL_PRICING_RUB[modelId];
  if (!pricing) return 0;

  const inputCost = ((usage.inputTokens - (usage.cachedInputTokens ?? 0)) / 1000) * pricing.input;
  const outputCost = (usage.outputTokens / 1000) * pricing.output;
  const cachedCost = ((usage.cachedInputTokens ?? 0) / 1000) * pricing.cached;

  return Math.round((inputCost + outputCost + cachedCost) * 100) / 100;
}
