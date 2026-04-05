/**
 * TokenLens Catalog — shared utility for cost calculation
 *
 * Provides cached model catalog and cost calculation for all AI endpoints.
 * Used by: chat/route.ts, task-chat/route.ts, professor-pipeline.ts
 */

import type { LanguageModelUsage } from "ai";
import { unstable_cache as cache } from "next/cache";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";

import { RUB_PER_USD } from "@/lib/constants/pricing";

import { calculateCostRub, type TokenUsageForPricing } from "./providers";
import { extractUsageForPricing } from "./usage-utils";

/**
 * Cached TokenLens model catalog (24h TTL)
 */
export const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn("TokenLens: catalog fetch failed, using default catalog", err);
      return;
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 }
);

/**
 * Re-export getUsage for endpoints that need full UsageData (e.g. chat/route.ts)
 */
export { getUsage } from "tokenlens/helpers";

/**
 * Calculate cost in USD for a given model and usage.
 * Uses hardcoded MODEL_PRICING_RUB with correct Anthropic cache billing formula.
 * TokenLens formula is additive (doesn't subtract cached tokens from input) — bypassed.
 */
export async function calcCostUsd(
  modelId: string,
  usage: LanguageModelUsage
): Promise<number | null> {
  try {
    const costRub = calculateCostRub(modelId, extractUsageForPricing(usage));
    if (costRub > 0) {
      return Math.round((costRub / RUB_PER_USD) * 1_000_000) / 1_000_000;
    }
  } catch {
    // Truly unknown model
  }

  return null;
}

// ---------------------------------------------------------------------------
// Server-side per-step cost in RUB (SSOT: TokenLens → fallback to hardcoded)
// Used by debug events in onStepFinish to embed pre-calculated cost.
// ---------------------------------------------------------------------------

/**
 * Calculate per-step cost in RUB using the disjoint TokenUsageForPricing contract.
 * Uses hardcoded MODEL_PRICING_RUB with Anthropic cache billing formula.
 *
 * Callers should build `usage` via `extractUsageForPricing(sdkUsage)`.
 * `_providers` kept for backward-compat (TokenLens catalog — currently unused
 * because we bypass its additive formula).
 */
export function calcStepCostRub(
  modelId: string,
  usage: TokenUsageForPricing,
  _providers?: ModelCatalog | undefined,
): number {
  return calculateCostRub(modelId, usage);
}
