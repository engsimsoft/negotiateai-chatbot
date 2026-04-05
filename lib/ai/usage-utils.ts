/**
 * Usage Logging Utilities — ТЗ-CACHE2
 *
 * Centralized extraction of AI SDK usage fields and preparation
 * of saveAiUsageLog parameters. Uses AI SDK v6 native
 * inputTokenDetails/outputTokenDetails types.
 */

import type { LanguageModelUsage } from "ai";

import { saveAiUsageLog } from "@/lib/db/queries";

import type { TokenUsageForPricing } from "./providers";
import { calcCostUsd } from "./tokenlens-catalog";

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
// extractUsageForPricing — map AI SDK usage → TokenUsageForPricing (disjoint)
// ---------------------------------------------------------------------------

/**
 * Build a disjoint TokenUsageForPricing from an AI SDK v6 usage object.
 *
 * Reads native `inputTokenDetails.{noCacheTokens,cacheReadTokens,cacheWriteTokens}`
 * and `outputTokenDetails.reasoningTokens`. All fields are disjoint — pass the
 * result directly to `calculateCostRub`.
 *
 * Fallback for `noCacheInputTokens` when `noCacheTokens` is missing:
 * derive from `inputTokens - cacheReadTokens - cacheWriteTokens`.
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
      : Math.max(0, (usage.inputTokens ?? 0) - cacheReadTokens - cacheWriteTokens);

  return {
    noCacheInputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens: usage.outputTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
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
