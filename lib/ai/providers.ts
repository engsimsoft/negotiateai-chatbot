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
// Exchange rate — re-exported from shared constant
// ---------------------------------------------------------------------------

export { RUB_PER_USD } from "@/lib/constants/pricing";

// ---------------------------------------------------------------------------
// Model Pricing (RUB per 1K tokens — fallback when TokenLens unavailable)
// Primary source of truth: TokenLens (fetches live prices from API).
// This hardcoded table is used as fallback and for pipeline traces.
// ---------------------------------------------------------------------------

interface ModelPricing {
  input: number;   // RUB per 1K input tokens
  output: number;  // RUB per 1K output tokens
  cached: number;  // RUB per 1K cached input tokens
}

const MODEL_PRICING_RUB: Record<string, ModelPricing> = {
  // Anthropic Claude (USD prices × 100 RUB/USD)
  // Haiku 4.5:  $1/1M in, $5/1M out, cache read 0.1× input
  // Sonnet 4.6: $3/1M in, $15/1M out, cache read 0.1× input
  // Opus 4.6:   $5/1M in, $25/1M out, cache read 0.1× input
  "claude-sonnet-4-6":           { input: 0.30,  output: 1.50,  cached: 0.030 },
  "claude-sonnet-4-5-20250929":  { input: 0.30,  output: 1.50,  cached: 0.030 }, // fallback
  "claude-haiku-4-5-20251001":   { input: 0.10,  output: 0.50,  cached: 0.010 },
  "claude-opus-4-6":             { input: 0.50,  output: 2.50,  cached: 0.050 },
  // Aliases (myProvider keys → same pricing)
  "claude-sonnet":               { input: 0.30,  output: 1.50,  cached: 0.030 },
  "claude-haiku":                { input: 0.10,  output: 0.50,  cached: 0.010 },
  "claude-opus":                 { input: 0.50,  output: 2.50,  cached: 0.050 },

  // Google Gemini (USD prices × 100)
  // Flash 2.0:  $0.10/1M in, $0.40/1M out
  // Flash 2.5:  $0.15/1M in, $0.60/1M out
  "gemini-2.0-flash":            { input: 0.01,  output: 0.04,  cached: 0.003 },
  "gemini-2.5-flash":            { input: 0.015, output: 0.06,  cached: 0.004 },

  // Perplexity Sonar Pro ($3/1M in, $15/1M out)
  "sonar-pro":                   { input: 0.30,  output: 1.50,  cached: 0 },
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

// ---------------------------------------------------------------------------
// Client helper: use server-calculated stepCostRub, fallback to local calc
// ---------------------------------------------------------------------------

import type { DebugStepData } from "./debug-events";

/** Get cost for a debug step. Prefers server-calculated value (TokenLens SSOT),
 *  falls back to local hardcoded pricing for legacy data. */
export function getStepCostRub(step: DebugStepData): number {
  if (step.stepCostRub != null) return step.stepCostRub;
  // Fallback: reasoning tokens billed at output rate
  const effectiveOutput = step.outputTokens + step.reasoningTokens;
  return calculateCostRub(step.modelId, {
    inputTokens: step.inputTokens,
    outputTokens: effectiveOutput,
    cachedInputTokens: step.cachedTokens,
  });
}

// ---------------------------------------------------------------------------
// TTS Pricing (Google Gemini TTS — priced per audio second)
// Google charges per character (~$4/1M chars). Average: ~15 chars/sec of speech.
// Rough estimate: $0.06/1K seconds → ₽0.006/second at RUB_PER_USD
// ---------------------------------------------------------------------------

const TTS_COST_RUB_PER_SECOND = 0.006;

export function calculateTtsCostRub(durationSeconds: number): number {
  return Math.round(durationSeconds * TTS_COST_RUB_PER_SECOND * 100) / 100;
}
