/**
 * Developer Panel — Debug Events
 *
 * Transient data-stream events emitted ONLY when SIMPLY_DEV_MODE=true.
 * All events use the `data-debug-*` prefix and `transient: true`.
 *
 * Client consumption: DevPanelProvider collects these via useChat onData callback.
 */

import { isSimplyDevMode } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Schema version — bump on breaking changes to DebugStepData/DebugFinishData.
// Consumers (DevPanelProvider, useOnboardingDebug) compare against this and
// wipe their localStorage cache when the stored version is older.
// ---------------------------------------------------------------------------

export const DEBUG_EVENT_SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-step debug event (schema v2 — ТЗ-TOKENS1).
 *
 * Input tokens are stored as DISJOINT fields aligned with AI SDK v6 native
 * `inputTokenDetails.*`. There is no overlap — total input =
 * noCacheInputTokens + cacheReadTokens + cacheWriteTokens.
 */
export interface DebugStepData {
  schemaVersion: number;
  stepIndex: number;
  stepType: string; // 'initial' | 'continue' | 'tool-result'
  modelId: string;
  noCacheInputTokens: number;  // fresh input (no cache hit/write)
  cacheReadTokens: number;     // cache_read tokens
  cacheWriteTokens: number;    // cache_write tokens
  outputTokens: number;
  reasoningTokens: number;
  finishReason: string;
  /** Per-step cost in RUB, calculated server-side via TokenLens (SSOT).
   *  Falls back to hardcoded MODEL_PRICING_RUB if TokenLens unavailable. */
  stepCostRub?: number;
  toolCalls: Array<{
    toolName: string;
    args: Record<string, unknown>;
  }>;
  toolResults: Array<{
    toolName: string;
    result: unknown; // truncated
  }>;
  timestamp: number;
}

export interface DebugGuardianData {
  stepIndex: number;
  detected: boolean;
  confidence: number;
  action: "clean" | "blocked" | "warning" | "bypassed";
  details: Array<{
    toolMentioned: string;
    pattern: string;
    snippet: string;
  }>;
  durationMs: number; // step duration measured in instrumentedStream
}

export interface DebugFinishData {
  schemaVersion: number;
  totalNoCacheInputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalSteps: number;
  totalDurationMs: number;
  timeToFirstTokenMs: number;
  estimatedCostRub: number;
  modelId: string;
  finishReason: string;
}

export interface DebugPromptData {
  systemPromptPreview: string; // first 500 chars
  systemPromptLength: number; // full length in chars
  activeAgent: string; // 'Simply Chat' | 'Экспертиза' | 'Создать' | etc.
  chatMode: string;
  isProjectChat: boolean;
  projectTier?: string;
  hasSnapshotContext: boolean;
  contextInjections: string[];
}

// ---------------------------------------------------------------------------
// Data stream writer type (minimal interface)
// ---------------------------------------------------------------------------

interface DataStreamWriter {
  write(event: { type: string; data?: unknown; transient?: boolean }): void;
}

// ---------------------------------------------------------------------------
// Emit functions (no-op when dev mode is off)
// ---------------------------------------------------------------------------

export function emitDebugStep(
  dataStream: DataStreamWriter,
  data: DebugStepData,
): void {
  if (!isSimplyDevMode) return;
  dataStream.write({
    type: "data-debug-step",
    data,
    // Note: NOT transient — AI SDK v5 does not deliver transient events to onData callback.
    // Safe because debug events are only emitted when SIMPLY_DEV_MODE=true.
  });
}

export function emitDebugGuardian(
  dataStream: DataStreamWriter,
  data: DebugGuardianData,
): void {
  if (!isSimplyDevMode) return;
  dataStream.write({
    type: "data-debug-guardian",
    data,
    // Note: NOT transient — AI SDK v5 does not deliver transient events to onData callback.
    // Safe because debug events are only emitted when SIMPLY_DEV_MODE=true.
  });
}

export function emitDebugFinish(
  dataStream: DataStreamWriter,
  data: DebugFinishData,
): void {
  if (!isSimplyDevMode) return;
  dataStream.write({
    type: "data-debug-finish",
    data,
    // Note: NOT transient — AI SDK v5 does not deliver transient events to onData callback.
    // Safe because debug events are only emitted when SIMPLY_DEV_MODE=true.
  });
}

export function emitDebugPrompt(
  dataStream: DataStreamWriter,
  data: DebugPromptData,
): void {
  if (!isSimplyDevMode) return;
  dataStream.write({
    type: "data-debug-prompt",
    data,
    // Note: NOT transient — AI SDK v5 does not deliver transient events to onData callback.
    // Safe because debug events are only emitted when SIMPLY_DEV_MODE=true.
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate tool result for display (avoid huge payloads in debug stream) */
export function truncateForDebug(value: unknown, maxLen = 500): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > maxLen ? value.slice(0, maxLen) + "..." : value;
  }
  const str = JSON.stringify(value);
  if (str.length > maxLen) {
    return str.slice(0, maxLen) + "...";
  }
  return value;
}

/**
 * Smart truncation for tool results: truncates large content/text fields
 * but preserves metadata fields that are useful for debugging.
 *
 * Used in briefing-onboarding context where tool results contain structured
 * data with important meta-fields (rssUrl, source, isValid, tier, etc.)
 */
const META_KEYS = new Set([
  "rssUrl", "source", "isValid", "title", "tier", "fetchMethod",
  "postCount", "sourceLanguage", "sourceName", "sourceUrl", "topicId",
  "topicName", "emoji", "success", "error", "query", "depth",
  "citationCount", "handle", "channelUrl", "briefingStyle",
]);

const CONTENT_KEYS = new Set(["content", "text", "markdown", "rawContent", "body"]);

export function truncateToolResultSmart(
  value: unknown,
  contentMaxLen = 200,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > contentMaxLen
      ? value.slice(0, contentMaxLen) + "..."
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => truncateToolResultSmart(item, contentMaxLen));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (META_KEYS.has(key)) {
        // Preserve meta values as-is (they're short)
        result[key] = val;
      } else if (CONTENT_KEYS.has(key) && typeof val === "string") {
        // Truncate large content fields
        result[key] = val.length > contentMaxLen
          ? val.slice(0, contentMaxLen) + "..."
          : val;
      } else if (typeof val === "object" && val !== null) {
        // Recurse into nested objects/arrays
        result[key] = truncateToolResultSmart(val, contentMaxLen);
      } else if (typeof val === "string" && val.length > contentMaxLen * 2) {
        // Truncate unknown large strings
        result[key] = val.slice(0, contentMaxLen) + "...";
      } else {
        result[key] = val;
      }
    }
    return result;
  }
  return value;
}
