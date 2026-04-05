import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelUsage } from "ai";
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
// Model context windows (tokens)
// Source: Anthropic official docs — claude.com/docs/en/about-claude/models/overview
// (verified April 2026). SSOT for context-usage UI indicators.
// ---------------------------------------------------------------------------

/**
 * Context window size per model, in tokens.
 *
 * Claude 4.6 family (Sonnet/Opus): 1M native — no beta flag, flat pricing
 * across the full window (a 900k-token request is billed at the same
 * per-token rate as a 9k-token request).
 *
 * Haiku 4.5: 200K.
 */
export const MODEL_CONTEXT_WINDOW: Record<string, number> = {
  // Claude 4.6 — 1M native
  "claude-sonnet-4-6":           1_000_000,
  "claude-sonnet":               1_000_000,
  "claude-opus-4-6":             1_000_000,
  "claude-opus":                 1_000_000,
  // Haiku 4.5 — 200K
  "claude-haiku-4-5-20251001":   200_000,
  "claude-haiku":                200_000,
  // Legacy (fallback)
  "claude-sonnet-4-5-20250929":  200_000,
  // Gemini (for completeness — used in vision-ocr, briefing)
  "gemini-2.0-flash":            1_000_000,
  "gemini-2.5-flash":            1_000_000,
};

/** Returns context window size for a model. Defaults to 200K if unknown. */
export function getContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOW[modelId] ?? 200_000;
}

// ---------------------------------------------------------------------------
// Model Pricing (RUB per 1K tokens — fallback when TokenLens unavailable)
// Primary source of truth: TokenLens (fetches live prices from API).
// This hardcoded table is used as fallback and for pipeline traces.
// ---------------------------------------------------------------------------

interface ModelPricing {
  input: number;      // RUB per 1K input tokens (fresh)
  output: number;     // RUB per 1K output tokens
  cached: number;     // RUB per 1K cache-read tokens (0.1× input)
  cacheWrite: number; // RUB per 1K cache-write tokens (1.25× input)
}

const MODEL_PRICING_RUB: Record<string, ModelPricing> = {
  // Anthropic Claude (USD prices × 100 RUB/USD)
  // Haiku 4.5:  $1/1M in, $5/1M out, cache_read 0.1× = $0.10/1M, cache_write 1.25× = $1.25/1M
  // Sonnet 4.6: $3/1M in, $15/1M out, cache_read = $0.30/1M, cache_write = $3.75/1M
  // Opus 4.6:   $5/1M in, $25/1M out, cache_read = $0.50/1M, cache_write = $6.25/1M
  "claude-sonnet-4-6":           { input: 0.30,  output: 1.50,  cached: 0.030, cacheWrite: 0.375 },
  "claude-sonnet-4-5-20250929":  { input: 0.30,  output: 1.50,  cached: 0.030, cacheWrite: 0.375 },
  "claude-haiku-4-5-20251001":   { input: 0.10,  output: 0.50,  cached: 0.010, cacheWrite: 0.125 },
  "claude-opus-4-6":             { input: 0.50,  output: 2.50,  cached: 0.050, cacheWrite: 0.625 },
  // Aliases (myProvider keys → same pricing)
  "claude-sonnet":               { input: 0.30,  output: 1.50,  cached: 0.030, cacheWrite: 0.375 },
  "claude-haiku":                { input: 0.10,  output: 0.50,  cached: 0.010, cacheWrite: 0.125 },
  "claude-opus":                 { input: 0.50,  output: 2.50,  cached: 0.050, cacheWrite: 0.625 },

  // Google Gemini (USD prices × 100, no prompt caching)
  // Flash 2.0:  $0.10/1M in, $0.40/1M out
  // Flash 2.5:  $0.15/1M in, $0.60/1M out
  "gemini-2.0-flash":            { input: 0.01,  output: 0.04,  cached: 0.003, cacheWrite: 0 },
  "gemini-2.5-flash":            { input: 0.015, output: 0.06,  cached: 0.004, cacheWrite: 0 },

  // Perplexity (no prompt caching)
  "sonar-pro":                   { input: 0.30,  output: 1.50,  cached: 0, cacheWrite: 0 },
  "sonar-deep-research":         { input: 0.20,  output: 0.80,  cached: 0, cacheWrite: 0 },
};

/**
 * Token usage contract for pricing — all fields are DISJOINT (no overlap).
 *
 * Aligned with AI SDK v6 native fields:
 * - noCacheInputTokens ← usage.inputTokenDetails.noCacheTokens  (fresh input)
 * - cacheReadTokens    ← usage.inputTokenDetails.cacheReadTokens
 * - cacheWriteTokens   ← usage.inputTokenDetails.cacheWriteTokens
 * - outputTokens       ← usage.outputTokens
 * - reasoningTokens    ← usage.outputTokenDetails.reasoningTokens (optional)
 *
 * Use extractUsageForPricing() from usage-utils.ts to build this object.
 */
export interface TokenUsageForPricing {
  noCacheInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
}

/**
 * Extract a disjoint TokenUsageForPricing from an AI SDK v6 usage object.
 *
 * Reads native `inputTokenDetails.{noCacheTokens,cacheReadTokens,cacheWriteTokens}`
 * and `outputTokenDetails.reasoningTokens`. All fields are disjoint — pass the
 * result directly to `calculateCostRub` / `calculateCostBreakdownRub`.
 *
 * Fallback for `noCacheInputTokens` when `noCacheTokens` is missing:
 * derive from `inputTokens - cacheReadTokens - cacheWriteTokens`.
 *
 * Client-safe (pure function) — usable in both server routes and client
 * components.
 */
export function extractUsageForPricing(
  usage: LanguageModelUsage | undefined | null,
): TokenUsageForPricing {
  if (!usage) {
    return {
      noCacheInputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
    };
  }

  const details = usage.inputTokenDetails;
  const cacheReadTokens = details?.cacheReadTokens ?? 0;
  const cacheWriteTokens = details?.cacheWriteTokens ?? 0;
  const noCacheFromSdk = details?.noCacheTokens;
  const noCacheInputTokens =
    noCacheFromSdk != null
      ? noCacheFromSdk
      : Math.max(
          0,
          (usage.inputTokens ?? 0) - cacheReadTokens - cacheWriteTokens,
        );

  return {
    noCacheInputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens: usage.outputTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
  };
}

/**
 * Calculate cost in RUB using Anthropic billing model:
 * - fresh input tokens:   billed at input rate (1×)
 * - cache_read tokens:    billed at cached rate (0.1× input)
 * - cache_write tokens:   billed at cacheWrite rate (1.25× input)
 * - output tokens:        billed at output rate
 * - reasoning tokens:     billed at output rate (Anthropic treats extended thinking as output)
 *
 * All input fields are disjoint — no subtraction needed.
 */
export function calculateCostRub(
  modelId: string,
  usage: TokenUsageForPricing,
): number {
  const pricing = MODEL_PRICING_RUB[modelId];
  if (!pricing) return 0;

  const effectiveOutput = usage.outputTokens + (usage.reasoningTokens ?? 0);

  const inputCost      = (usage.noCacheInputTokens / 1000) * pricing.input;
  const cacheReadCost  = (usage.cacheReadTokens    / 1000) * pricing.cached;
  const cacheWriteCost = (usage.cacheWriteTokens   / 1000) * pricing.cacheWrite;
  const outputCost     = (effectiveOutput          / 1000) * pricing.output;

  return Math.round((inputCost + cacheReadCost + cacheWriteCost + outputCost) * 100) / 100;
}

/**
 * Per-component cost breakdown in RUB. Same formula as `calculateCostRub`,
 * but returns each component separately instead of the sum — used by the
 * user-facing Context popover to show where cost comes from.
 *
 * All values are RUB (rounded to 2 decimals).
 * `totalRub` === `calculateCostRub(modelId, usage)`.
 */
export interface CostBreakdownRub {
  freshInputRub: number;
  cacheReadRub: number;
  cacheWriteRub: number;
  outputRub: number;
  reasoningRub: number;
  totalRub: number;
}

export function calculateCostBreakdownRub(
  modelId: string,
  usage: TokenUsageForPricing,
): CostBreakdownRub {
  const pricing = MODEL_PRICING_RUB[modelId];
  if (!pricing) {
    return {
      freshInputRub: 0,
      cacheReadRub: 0,
      cacheWriteRub: 0,
      outputRub: 0,
      reasoningRub: 0,
      totalRub: 0,
    };
  }

  const reasoningTokens = usage.reasoningTokens ?? 0;

  const freshInputRub  = round2((usage.noCacheInputTokens / 1000) * pricing.input);
  const cacheReadRub   = round2((usage.cacheReadTokens    / 1000) * pricing.cached);
  const cacheWriteRub  = round2((usage.cacheWriteTokens   / 1000) * pricing.cacheWrite);
  const outputRub      = round2((usage.outputTokens       / 1000) * pricing.output);
  // Anthropic treats extended thinking tokens as output (same rate)
  const reasoningRub   = round2((reasoningTokens          / 1000) * pricing.output);

  const totalRub = round2(
    freshInputRub + cacheReadRub + cacheWriteRub + outputRub + reasoningRub,
  );

  return {
    freshInputRub,
    cacheReadRub,
    cacheWriteRub,
    outputRub,
    reasoningRub,
    totalRub,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Client helper: use server-calculated stepCostRub, fallback to local calc
// ---------------------------------------------------------------------------

import type { DebugStepData } from "./debug-events";

/** Get cost for a debug step. Prefers server-calculated value (TokenLens SSOT),
 *  falls back to local hardcoded pricing using disjoint token fields. */
export function getStepCostRub(step: DebugStepData): number {
  if (step.stepCostRub != null) return step.stepCostRub;
  return calculateCostRub(step.modelId, {
    noCacheInputTokens: step.noCacheInputTokens,
    cacheReadTokens: step.cacheReadTokens,
    cacheWriteTokens: step.cacheWriteTokens,
    outputTokens: step.outputTokens,
    reasoningTokens: step.reasoningTokens,
  });
}

// ---------------------------------------------------------------------------
// Non-token provider cost helpers (Deepgram, Gemini TTS)
// These providers use per-minute / per-character pricing, not tokens.
// ---------------------------------------------------------------------------

/** Deepgram Nova-3: $0.0043/min batch pricing */
export function calculateDeepgramCostUsd(audioSeconds: number): number {
  const USD_PER_SECOND = 0.0043 / 60;
  return Math.round(audioSeconds * USD_PER_SECOND * 1_000_000) / 1_000_000;
}

/** Gemini TTS (gemini-2.5-flash-preview-tts): $4/1M characters */
export function calculateGeminiTtsCostUsd(charCount: number): number {
  const USD_PER_CHAR = 4 / 1_000_000;
  return Math.round(charCount * USD_PER_CHAR * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// TTS Pricing (Google Gemini TTS — legacy RUB helper for pipeline traces)
// ---------------------------------------------------------------------------

const TTS_COST_RUB_PER_SECOND = 0.006;

export function calculateTtsCostRub(durationSeconds: number): number {
  return Math.round(durationSeconds * TTS_COST_RUB_PER_SECOND * 100) / 100;
}
