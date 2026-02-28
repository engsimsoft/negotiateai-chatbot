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
// Types
// ---------------------------------------------------------------------------

export interface DebugStepData {
  stepIndex: number;
  stepType: string; // 'initial' | 'continue' | 'tool-result'
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  finishReason: string;
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
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
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
