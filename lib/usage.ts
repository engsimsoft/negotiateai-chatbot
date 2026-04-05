/**
 * AppUsage — server-enriched usage payload for the user-facing Context popover.
 *
 * Shape:
 * - disjoint token breakdown (TOKENS1 contract, no overlap between fields)
 * - RUB cost breakdown computed via SSOT calculateCostBreakdownRub (providers.ts)
 * - contextWindow snapshot for the circle indicator
 *
 * Replaces the legacy dependency on `tokenlens/helpers.UsageData`, which used
 * an additive cost formula and double-counted cache tokens by pricing them at
 * the fresh-input rate.
 *
 * Flows:
 *   chat route onFinish → buildAppUsage(...) → data-usage stream event → client
 *   → mergeAppUsage(prev, incoming) → state → Context popover
 *   → persisted in chat.lastContext JSONB column
 */

import type { LanguageModelUsage } from "ai";

import {
  calculateCostBreakdownRub,
  type CostBreakdownRub,
  extractUsageForPricing,
  getContextWindow,
  type TokenUsageForPricing,
} from "@/lib/ai/providers";

export interface AppUsage {
  /** Anthropic API model ID that produced this response. */
  modelId: string;

  // Disjoint token breakdown (TOKENS1 contract) — no overlap between fields.
  noCacheInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;

  /** Per-component cost breakdown in RUB. Source: calculateCostBreakdownRub(). */
  costRub: CostBreakdownRub;

  /**
   * Context window fill snapshot.
   * - `used` = input tokens of the latest request (NOT cumulative)
   * - `max` = full context window of the model (from MODEL_CONTEXT_WINDOW)
   * Circle indicator shows used/max for the LAST message only, because the
   * model's context resets every turn (prior messages are replayed as input).
   */
  contextWindow: {
    used: number;
    max: number;
  };
}

/**
 * Build an AppUsage payload from a raw AI SDK LanguageModelUsage.
 * Called on the server in onFinish to package usage for the client.
 */
export function buildAppUsage(
  modelId: string,
  usage: LanguageModelUsage,
): AppUsage {
  const pricing: TokenUsageForPricing = extractUsageForPricing(usage);
  const costRub = calculateCostBreakdownRub(modelId, pricing);

  // "used" = total input of this request (fresh + cache_read + cache_write)
  // This represents what was loaded into the model's context window.
  const contextUsed =
    pricing.noCacheInputTokens +
    pricing.cacheReadTokens +
    pricing.cacheWriteTokens;

  return {
    modelId,
    noCacheInputTokens: pricing.noCacheInputTokens,
    cacheReadTokens: pricing.cacheReadTokens,
    cacheWriteTokens: pricing.cacheWriteTokens,
    outputTokens: pricing.outputTokens,
    reasoningTokens: pricing.reasoningTokens ?? 0,
    costRub,
    contextWindow: {
      used: contextUsed,
      max: getContextWindow(modelId),
    },
  };
}

/**
 * Merge two AppUsage payloads for cumulative session tracking.
 *
 * Semantics:
 * - Token counts are SUMMED across the session
 * - costRub components are SUMMED
 * - contextWindow is taken from `incoming` (reflects last message, not cumulative)
 * - modelId is taken from `incoming` (session may switch models)
 */
export function mergeAppUsage(
  prev: AppUsage | undefined,
  incoming: AppUsage,
): AppUsage {
  if (!prev) return incoming;

  return {
    modelId: incoming.modelId,
    noCacheInputTokens: prev.noCacheInputTokens + incoming.noCacheInputTokens,
    cacheReadTokens:    prev.cacheReadTokens    + incoming.cacheReadTokens,
    cacheWriteTokens:   prev.cacheWriteTokens   + incoming.cacheWriteTokens,
    outputTokens:       prev.outputTokens       + incoming.outputTokens,
    reasoningTokens:    prev.reasoningTokens    + incoming.reasoningTokens,
    costRub: {
      freshInputRub: round2(prev.costRub.freshInputRub + incoming.costRub.freshInputRub),
      cacheReadRub:  round2(prev.costRub.cacheReadRub  + incoming.costRub.cacheReadRub),
      cacheWriteRub: round2(prev.costRub.cacheWriteRub + incoming.costRub.cacheWriteRub),
      outputRub:     round2(prev.costRub.outputRub     + incoming.costRub.outputRub),
      reasoningRub:  round2(prev.costRub.reasoningRub  + incoming.costRub.reasoningRub),
      totalRub:      round2(prev.costRub.totalRub      + incoming.costRub.totalRub),
    },
    // Context window: last message wins (shows current fill, not cumulative)
    contextWindow: incoming.contextWindow,
  };
}

/**
 * Normalizer for DB-loaded usage (chat.lastContext JSONB).
 *
 * Backward-compat: rows written before the TOKENS1 popover refactor have the
 * old tokenlens shape without `costRub` or explicit disjoint fields. We drop
 * them — UI will repopulate from the next `data-usage` event.
 *
 * Returns undefined if the stored value is missing required fields.
 */
export function normalizeStoredAppUsage(raw: unknown): AppUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const u = raw as Partial<AppUsage>;
  if (
    typeof u.modelId !== "string" ||
    typeof u.noCacheInputTokens !== "number" ||
    typeof u.cacheReadTokens !== "number" ||
    typeof u.cacheWriteTokens !== "number" ||
    typeof u.outputTokens !== "number" ||
    typeof u.reasoningTokens !== "number" ||
    !u.costRub ||
    !u.contextWindow
  ) {
    // Legacy shape — ignore, will be replaced by next fresh usage event
    return undefined;
  }

  return u as AppUsage;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
