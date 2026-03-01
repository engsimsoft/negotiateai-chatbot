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
 * Returns null if catalog unavailable.
 */
export async function calcCostUsd(
  modelId: string,
  usage: LanguageModelUsage
): Promise<number | null> {
  try {
    const providers = await getTokenlensCatalog();
    if (!providers) return null;
    const summary = getUsage({ modelId, usage, providers });
    return summary?.costUSD?.totalUSD ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Server-side per-step cost in RUB (SSOT: TokenLens → fallback to hardcoded)
// Used by debug events in onStepFinish to embed pre-calculated cost.
// ---------------------------------------------------------------------------

import { calculateCostRub, RUB_PER_USD } from "./providers";

/**
 * Calculate per-step cost in RUB using TokenLens catalog (sync, requires pre-fetched catalog).
 * Falls back to hardcoded MODEL_PRICING_RUB if catalog unavailable.
 * Reasoning tokens are billed at output token rate.
 */
export function calcStepCostRub(
  modelId: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
  },
  providers: ModelCatalog | undefined,
): number {
  const effectiveOutput = usage.outputTokens + (usage.reasoningTokens ?? 0);

  // Try TokenLens (SSOT — live prices from API)
  if (providers) {
    try {
      const summary = getUsage({
        modelId,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: effectiveOutput,
          cachedInputTokens: usage.cachedInputTokens ?? 0,
        } as LanguageModelUsage,
        providers,
      });
      const totalUsd = summary?.costUSD?.totalUSD;
      if (totalUsd != null && totalUsd > 0) {
        return Math.round(totalUsd * RUB_PER_USD * 100) / 100;
      }
    } catch {
      // Fall through to hardcoded
    }
  }

  // Fallback: hardcoded pricing table
  return calculateCostRub(modelId, {
    inputTokens: usage.inputTokens,
    outputTokens: effectiveOutput,
    cachedInputTokens: usage.cachedInputTokens ?? 0,
  });
}
