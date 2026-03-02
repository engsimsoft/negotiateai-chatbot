/**
 * Usage Logging Utilities — ТЗ-CACHE2
 *
 * Centralized extraction of AI SDK usage fields and preparation
 * of saveAiUsageLog parameters. Replaces scattered (usage as any)
 * casts across the codebase.
 */

import type { LanguageModelUsage } from "ai";

import { saveAiUsageLog } from "@/lib/db/queries";

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
}

// ---------------------------------------------------------------------------
// extractUsageFields — extract all 5 token fields from AI SDK usage object
// ---------------------------------------------------------------------------

/**
 * Extract all available token fields from an AI SDK usage object.
 *
 * AI SDK v5 exposes `cachedInputTokens` and `reasoningTokens` on the usage
 * object at runtime, but they are not part of the LanguageModelUsage
 * TypeScript type — hence the `as any` casts.
 *
 * `cacheWriteTokens` (Anthropic `cache_creation_input_tokens`) is NOT
 * available in AI SDK v5's flat usage structure.
 * TODO: Check availability after AI SDK v6 migration.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = usage as any;

  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheReadTokens: u?.cachedInputTokens ?? 0,
    // AI SDK v5 does not expose cache_creation_input_tokens.
    // Try known possible field names, default to 0.
    cacheWriteTokens:
      u?.cacheCreationInputTokens ?? u?.cacheWriteInputTokens ?? 0,
    thinkingTokens: u?.reasoningTokens ?? 0,
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
}: LogUsageInput): Promise<void> {
  try {
    const fields = extractUsageFields(usage);
    const costUsd = await calcCostUsd(modelId, usage);

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
