/**
 * Usage Logging Utilities — ТЗ-CACHE2
 *
 * Centralized extraction of AI SDK usage fields and preparation
 * of saveAiUsageLog parameters. Uses AI SDK v6 native
 * inputTokenDetails/outputTokenDetails types.
 */

import type { LanguageModelUsage } from "ai";

import { saveAiUsageLog } from "@/lib/db/queries";

import { extractUsageForPricing } from "./providers";
import { calcCostUsd } from "./tokenlens-catalog";

/**
 * Re-export for backward compatibility. Canonical location: `./providers`.
 * New code should import directly from `@/lib/ai/providers`.
 */
export { extractUsageForPricing };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  thinkingTokens: number;
}

export interface LogUsageInput {
  userId: string;
  usage: LanguageModelUsage;
  modelId: string;
  chatMode: string;
  /** Provider id (anthropic, moonshotai, xai, openrouter, voyage, deepgram, ...). ТЗ-1. */
  provider?: string | null;
  chatId?: string | null;
  durationMs?: number | null;
  guardianFlags?: Record<string, unknown> | null;
  /** Override cost in USD for non-token providers (Deepgram, Gemini TTS). Skips calcCostUsd. */
  costUsdOverride?: number | null;
}

// ---------------------------------------------------------------------------
// extractUsageFields — extract all 5 token fields from AI SDK usage object
// ---------------------------------------------------------------------------

/**
 * Extract all available token fields from an AI SDK v6 usage object.
 *
 * AI SDK v6 provides structured `inputTokenDetails` and `outputTokenDetails`
 * with native types for cached, cacheWrite, and reasoning tokens.
 */
export function extractUsageFields(
  usage: LanguageModelUsage | undefined | null,
): ExtractedUsage {
  if (!usage) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      thinkingTokens: 0,
    };
  }

  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
    thinkingTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// logUsage — one-call fire-and-forget usage logging
// ---------------------------------------------------------------------------

/**
 * Extract usage fields, calculate cost, and save to ai_usage_log in one call.
 * Fire-and-forget: never throws, never blocks the caller.
 */
export async function logUsage({
  userId,
  usage,
  modelId,
  chatMode,
  provider,
  chatId,
  durationMs,
  guardianFlags,
  costUsdOverride,
}: LogUsageInput): Promise<void> {
  try {
    const fields = extractUsageFields(usage);
    const costUsd =
      costUsdOverride !== undefined && costUsdOverride !== null
        ? costUsdOverride
        : await calcCostUsd(modelId, usage);

    saveAiUsageLog({
      chatId: chatId ?? null,
      userId,
      modelId,
      provider: provider ?? inferProviderFromModelId(modelId),
      ...fields,
      costUsd,
      chatMode,
      durationMs: durationMs ?? null,
      guardianFlags: guardianFlags ?? null,
    }).catch(() => {});
  } catch {
    // Never block the caller
  }
}

/**
 * Infer provider from modelId prefix as a fallback when caller doesn't pass
 * `provider` explicitly. Same rules as SQL backfill in migration 0053.
 */
function inferProviderFromModelId(modelId: string): string | null {
  if (modelId.startsWith("claude")) return "anthropic";
  if (modelId.startsWith("kimi")) return "moonshotai";
  if (modelId.startsWith("grok")) return "xai";
  if (modelId.startsWith("voyage")) return "voyage";
  if (modelId.startsWith("sonar")) return "perplexity";
  if (modelId.startsWith("deepgram") || modelId === "nova-3") return "deepgram";
  if (modelId.startsWith("gemini")) return "google";
  return null;
}
