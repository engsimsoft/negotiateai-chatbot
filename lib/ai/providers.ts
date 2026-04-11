/**
 * Cost & pricing utilities (ТЗ-1 CoreRegistry, Stage 5)
 *
 * Model resolution moved to `./getModel.ts` (SSOT). This file keeps only
 * cost-calculation helpers and context-window lookup — the minimal surface
 * consumed by chat routes, DevPanel, usage logging, and non-LLM providers
 * (Deepgram, Gemini TTS).
 *
 * Exports:
 *  - RUB_PER_USD re-export from `@/lib/constants/pricing`
 *  - getContextWindow — re-export from model-catalog
 *  - TokenUsageForPricing / extractUsageForPricing — disjoint usage extraction
 *  - calculateCostRub / calculateCostBreakdownRub — RUB pricing via catalog
 *  - CostBreakdownRub type
 *  - getStepCostRub — server-calculated value with local fallback
 *  - calculateDeepgramCostUsd / calculateGeminiTtsCostUsd / calculateTtsCostRub —
 *    per-minute / per-character pricing for non-token providers
 */

import type { LanguageModelUsage } from "ai";

import { getContextWindow as getContextWindowFromCatalog, getModelEntry } from "./model-catalog";
import type { DebugStepData } from "./debug-events";

// ---------------------------------------------------------------------------
// Exchange rate
// ---------------------------------------------------------------------------

export { RUB_PER_USD } from "@/lib/constants/pricing";
import { RUB_PER_USD } from "@/lib/constants/pricing";

// ---------------------------------------------------------------------------
// Context window lookup — delegated to model-catalog (SSOT)
// ---------------------------------------------------------------------------

export function getContextWindow(modelId: string): number {
  return getContextWindowFromCatalog(modelId);
}

// ---------------------------------------------------------------------------
// Pricing — reads from model-catalog.ts (SSOT)
// ---------------------------------------------------------------------------

/**
 * Token usage contract for pricing — all fields are DISJOINT (no overlap).
 *
 * Aligned with AI SDK v6 native fields:
 * - noCacheInputTokens ← usage.inputTokenDetails.noCacheTokens  (fresh input)
 * - cacheReadTokens    ← usage.inputTokenDetails.cacheReadTokens
 * - cacheWriteTokens   ← usage.inputTokenDetails.cacheWriteTokens
 * - outputTokens       ← usage.outputTokens
 * - reasoningTokens    ← usage.outputTokenDetails.reasoningTokens (optional)
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
 * Client-safe (pure function).
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
 * Получить pricing (RUB/1K) из catalog. Конвертирует USD/1M → RUB/1K через
 * RUB_PER_USD. Возвращает null если модели нет в каталоге.
 */
interface PricingRubPer1K {
  input: number;
  output: number;
  cached: number;
  cacheWrite: number;
}

function getPricingRubPer1K(modelId: string): PricingRubPer1K | null {
  const entry = getModelEntry(modelId);
  if (!entry) return null;
  // USD/1M → RUB/1K = (usd_per_million / 1000) * RUB_PER_USD
  const factor = RUB_PER_USD / 1000;
  return {
    input:      entry.pricing.input       * factor,
    output:     entry.pricing.output      * factor,
    cached:     entry.pricing.cachedInput * factor,
    cacheWrite: entry.pricing.cacheWrite  * factor,
  };
}

/**
 * Calculate cost in RUB using Anthropic billing model:
 * - fresh input tokens:   input rate (1×)
 * - cache_read tokens:    cached rate (0.1× input для Anthropic)
 * - cache_write tokens:   cacheWrite rate (1.25× input для Anthropic)
 * - output tokens:        output rate
 * - reasoning tokens:     output rate (Anthropic extended thinking)
 *
 * All input fields are disjoint — no subtraction.
 */
export function calculateCostRub(
  modelId: string,
  usage: TokenUsageForPricing,
): number {
  const pricing = getPricingRubPer1K(modelId);
  if (!pricing) return 0;

  const effectiveOutput = usage.outputTokens + (usage.reasoningTokens ?? 0);

  const inputCost      = (usage.noCacheInputTokens / 1000) * pricing.input;
  const cacheReadCost  = (usage.cacheReadTokens    / 1000) * pricing.cached;
  const cacheWriteCost = (usage.cacheWriteTokens   / 1000) * pricing.cacheWrite;
  const outputCost     = (effectiveOutput          / 1000) * pricing.output;

  return Math.round((inputCost + cacheReadCost + cacheWriteCost + outputCost) * 100) / 100;
}

/** Per-component cost breakdown in RUB — для user-facing Context popover. */
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
  const pricing = getPricingRubPer1K(modelId);
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

/**
 * Get cost for a debug step. Prefers server-calculated value (catalog SSOT),
 * falls back to local calculation via catalog lookup.
 */
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
// Per-minute / per-character pricing, not tokens — остаётся в этом файле.
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
// TTS Pricing (Gemini TTS — RUB helper для pipeline traces)
// ---------------------------------------------------------------------------

const TTS_COST_RUB_PER_SECOND = 0.006;

export function calculateTtsCostRub(durationSeconds: number): number {
  return Math.round(durationSeconds * TTS_COST_RUB_PER_SECOND * 100) / 100;
}
