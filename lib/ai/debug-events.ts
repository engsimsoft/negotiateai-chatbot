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

export const DEBUG_EVENT_SCHEMA_VERSION = 3;

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
  contextInjections: string[];
  /** ТЗ-2: Registry task id used for this call (e.g. "simply-chat", "expertise"). */
  taskId?: string;
  /** ТЗ-2: True if a dev override (cookie) was applied for this task. */
  overrideActive?: boolean;
  /** ТЗ-2: Catalog default for this task (what getModel would pick without override). */
  defaultModelId?: string;
  /** ТЗ-2: Catalog id actually used (equals defaultModelId unless overrideActive). */
  effectiveModelId?: string;
}

/** ТЗ-RAG3: Compaction debug data */
export interface DebugCompactionData {
  /** Whether compaction was triggered in this response */
  triggered: boolean;
  /** Iterations breakdown (compaction + message) */
  iterations: Array<{
    type: 'compaction' | 'message';
    inputTokens: number;
    outputTokens: number;
  }>;
}

/**
 * ТЗ-DevPanelErrors: Error captured during a request (server or client side).
 * Represents a critical problem — something actually broke and was caught by try/catch
 * or by React Error Boundary. Shown with red accent in DevPanel.
 */
export interface DebugErrorData {
  /** Source identifier, e.g. "server:chat-route", "server:professor-pipeline", "client:useChat", "client:window", "client:error-boundary". */
  source: string;
  /** Human-readable error message. */
  message: string;
  /** Error stack trace if available (truncated to ~2000 chars upstream). */
  stack?: string;
  /** Optional arbitrary context — e.g. chatId, taskId, tool name. Kept small (<500 chars after JSON.stringify). */
  context?: Record<string, unknown>;
  /** Unix ms timestamp when the error was captured. */
  timestamp: number;
}

/**
 * ТЗ-DevPanelErrors: Warning captured during a request.
 * Represents a non-fatal problem — something degraded gracefully but is worth knowing about.
 * Examples: Voyage AI down (memory retrieval skipped), Guardian detected hallucination, profile block failed.
 * Shown with yellow accent in DevPanel.
 */
export interface DebugWarningData {
  /** Source identifier. See DebugErrorData.source for examples. */
  source: string;
  /** Human-readable warning message. */
  message: string;
  /** Optional context, same rules as DebugErrorData.context. */
  context?: Record<string, unknown>;
  /** Unix ms timestamp. */
  timestamp: number;
}

/** ТЗ-RAG1: MIND memory debug data */
export interface DebugRagData {
  /** User query used for retrieval */
  query: string;
  /** Retrieved facts */
  facts: Array<{
    content: string;
    category: string;
    similarity: number;
    confidence: number;
  }>;
  /** Number of facts injected into prompt */
  factsInjected: number;
  /** Voyage API tokens consumed */
  voyageTokens: number;
  /** Search duration in ms */
  searchDurationMs: number;
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

/**
 * Emit a debug step for an artifact generation sub-call (text, markdown, excel,
 * pptx, reveal). Artifacts run in a side-stream: the tool-call appears in the
 * primary chain as e.g. `createDocument`, and the model that actually generates
 * the content (Sonnet via `getModel("artifact:*")`) never shows up in the
 * DevPanel timeline unless we emit it explicitly.
 *
 * Keeps the footer honest: tokens/cost sums include the artifact sub-call, and
 * the Timeline/CostBreakdown sections render it as a distinct step with its
 * real modelId. `toolCalls` is intentionally empty — the artifact LLM is the
 * *result* of a tool call, not a new tool call.
 */
export function emitArtifactDebugStep(
  dataStream: DataStreamWriter,
  params: {
    taskId: string;         // "artifact:text" | "artifact:markdown" | ...
    modelId: string;
    usage: import("ai").LanguageModelUsage | undefined;
    operation: "create" | "update";
    artifactKind: string;   // "text" | "markdown" | "excel" | "pptx" | "reveal"
    durationMs: number;
    finishReason?: string;
  },
): void {
  if (!isSimplyDevMode) return;

  // Lazy import to avoid circular dependency: debug-events is imported from
  // many places, and providers.ts → getStepCostRub → debug-events.ts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { extractUsageForPricing, calculateCostRub } =
    require("./providers") as typeof import("./providers");

  const u = extractUsageForPricing(params.usage);
  const stepCostRub = calculateCostRub(params.modelId, u);

  const data: DebugStepData = {
    schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
    // Monotonic timestamp — guarantees uniqueness and preserves arrival order
    // in the DevPanel timeline (provider pushes in order, no sort by stepIndex).
    stepIndex: Date.now(),
    stepType: `artifact:${params.operation}`,
    modelId: params.modelId,
    noCacheInputTokens: u.noCacheInputTokens,
    cacheReadTokens: u.cacheReadTokens,
    cacheWriteTokens: u.cacheWriteTokens,
    outputTokens: u.outputTokens,
    reasoningTokens: u.reasoningTokens ?? 0,
    finishReason: params.finishReason ?? "stop",
    stepCostRub,
    toolCalls: [],
    toolResults: [
      {
        toolName: `${params.operation}Document`,
        result: { kind: params.artifactKind, taskId: params.taskId },
      },
    ],
    timestamp: Date.now(),
  };

  dataStream.write({ type: "data-debug-step", data });
}

/**
 * Emit a debug step for any tool that runs its own AI sub-call via the AI SDK
 * (streamText, streamObject, generateObject, etc.). Keeps the DevPanel footer
 * honest: nested sub-calls contribute their modelId + cost to the per-message
 * aggregation instead of being invisible behind the tool name.
 *
 * Use this for tools where a different model from the parent chat is invoked —
 * e.g. request-suggestions (util:artifact-suggestions), professor pipeline
 * sub-calls. For artifact handlers use the artifact-specific helper above.
 */
export function emitToolDebugStep(
  dataStream: DataStreamWriter,
  params: {
    taskId: string;
    modelId: string;
    usage: import("ai").LanguageModelUsage | undefined;
    toolName: string;
    durationMs: number;
    finishReason?: string;
  },
): void {
  if (!isSimplyDevMode) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { extractUsageForPricing, calculateCostRub } =
    require("./providers") as typeof import("./providers");

  const u = extractUsageForPricing(params.usage);
  const stepCostRub = calculateCostRub(params.modelId, u);

  const data: DebugStepData = {
    schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
    stepIndex: Date.now(),
    stepType: `tool:${params.toolName}`,
    modelId: params.modelId,
    noCacheInputTokens: u.noCacheInputTokens,
    cacheReadTokens: u.cacheReadTokens,
    cacheWriteTokens: u.cacheWriteTokens,
    outputTokens: u.outputTokens,
    reasoningTokens: u.reasoningTokens ?? 0,
    finishReason: params.finishReason ?? "stop",
    stepCostRub,
    toolCalls: [],
    toolResults: [{ toolName: params.toolName, result: { taskId: params.taskId } }],
    timestamp: Date.now(),
  };

  dataStream.write({ type: "data-debug-step", data });
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
  });
}

/** ТЗ-RAG3: Emit compaction debug event */
export function emitDebugCompaction(
  dataStream: DataStreamWriter,
  data: DebugCompactionData,
): void {
  if (!isSimplyDevMode) return;
  dataStream.write({
    type: "data-debug-compaction",
    data,
  });
}

/** ТЗ-RAG1: Emit MIND memory debug event */
export function emitDebugRag(
  dataStream: DataStreamWriter,
  data: DebugRagData,
): void {
  if (!isSimplyDevMode) return;
  dataStream.write({
    type: "data-debug-rag",
    data,
  });
}

/**
 * ТЗ-DevPanelErrors: Emit a critical error captured in a try/catch on the server.
 * The event reaches the client DevPanel and is attached to the currently streaming
 * assistant message (via parseBatches position-based assignment). Safe to call from
 * catch blocks — the emit itself is wrapped in try/catch so a logging failure never
 * masks the original error.
 */
export function emitDebugError(
  dataStream: DataStreamWriter,
  data: Omit<DebugErrorData, "timestamp"> & { timestamp?: number },
): void {
  if (!isSimplyDevMode) return;
  try {
    dataStream.write({
      type: "data-debug-error",
      data: {
        ...data,
        timestamp: data.timestamp ?? Date.now(),
      } satisfies DebugErrorData,
    });
  } catch {
    // Never let debug logging fail the request — swallow silently.
  }
}

/**
 * ТЗ-DevPanelErrors: Emit a non-fatal warning (graceful degradation notice).
 * Same semantics as emitDebugError but rendered with yellow accent in DevPanel.
 */
export function emitDebugWarning(
  dataStream: DataStreamWriter,
  data: Omit<DebugWarningData, "timestamp"> & { timestamp?: number },
): void {
  if (!isSimplyDevMode) return;
  try {
    dataStream.write({
      type: "data-debug-warning",
      data: {
        ...data,
        timestamp: data.timestamp ?? Date.now(),
      } satisfies DebugWarningData,
    });
  } catch {
    // Swallow — logging must never fail the request.
  }
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
