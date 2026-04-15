"use client";

import { useState, useEffect, useRef } from "react";
import { useDevPanel } from "./dev-panel-provider";
import { DevPanelDrawer } from "./dev-panel-drawer";
import { getStepCostRub } from "@/lib/ai/providers";

const MODEL_DISPLAY: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku": "Haiku",
  "claude-sonnet": "Sonnet",
  "claude-opus": "Opus",
  "grok-4-1-fast-non-reasoning": "Grok 4.1 Fast",
  "grok-4-1-fast-reasoning": "Grok 4.1 Fast (reasoning)",
  "grok-4.20-0309-reasoning": "Grok 4.20 (reasoning)",
  "grok-4.20-0309-non-reasoning": "Grok 4.20",
  "grok-4.20-multi-agent-0309": "Grok 4.20 Multi-Agent",
  "MiniMax-M2.7": "MiniMax M2.7",
  "MiniMax-M2.7-long": "MiniMax M2.7 (long)",
};

function formatTokens(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1_000) return n.toLocaleString("ru-RU");
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const ERROR_REASONS = new Set(["error", "content-filter", "unknown"]);

export function DevPanelFooter({ messageId }: { messageId: string }) {
  const data = useDevPanel(messageId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Live elapsed timer during streaming
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const isStreaming = !!data && !data.finish;

  useEffect(() => {
    if (!isStreaming) return;
    if (!startRef.current) startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Reset on finish
  useEffect(() => {
    if (data?.finish) startRef.current = 0;
  }, [data?.finish]);

  if (!mounted || !data) return null;

  const finishReason = data.finish?.finishReason ?? data.steps.at(-1)?.finishReason;
  const isError = !!finishReason && ERROR_REASONS.has(finishReason);

  const modelName = data.finish?.modelId
    ? (MODEL_DISPLAY[data.finish.modelId] ?? data.finish.modelId)
    : data.steps[0]?.modelId
      ? (MODEL_DISPLAY[data.steps[0].modelId] ?? data.steps[0].modelId)
      : "...";

  // ТЗ-DEV3: Sum per-step tokens (real total billed, not last step cumulative)
  const totalTokens = data.steps.reduce(
    (sum, s) =>
      sum +
      s.noCacheInputTokens +
      s.cacheReadTokens +
      s.cacheWriteTokens +
      s.outputTokens +
      s.reasoningTokens,
    0,
  );

  // ТЗ-DEV3: Real cost = sum of per-step costs (each step is a separate API call).
  // Uses server-calculated stepCostRub (TokenLens SSOT) with local fallback.
  const isCostFallback = data.steps.length === 0 && data.finish?.estimatedCostRub != null;
  const cost = data.steps.length > 0
    ? data.steps.reduce((sum, step) => sum + getStepCostRub(step), 0)
    : data.finish?.estimatedCostRub;
  const duration = data.finish?.totalDurationMs;

  // ТЗ-DEV3: Total tool call count across all steps
  const toolCount = data.steps.reduce((sum, s) => sum + s.toolCalls.length, 0);

  // ТЗ-DevPanelErrors: counts for the errors/warnings badge
  const errorCount = data.errors?.length ?? 0;
  const warningCount = data.warnings?.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open DevPanel details"
        className={`mt-1 flex w-fit items-center gap-1.5 rounded px-1.5 py-1 font-mono text-[11px] leading-none transition-colors ${
          isError
            ? "bg-destructive/10 text-destructive/70 hover:bg-destructive/20 hover:text-destructive"
            : "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground/80"
        }`}
      >
        <span>{modelName}</span>
        <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
        <span>{formatTokens(totalTokens)} tok</span>
        {cost != null && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span>{isCostFallback ? "~" : ""}&#8381;{cost.toFixed(2)}</span>
          </>
        )}
        {toolCount > 0 && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span>{toolCount} tools</span>
          </>
        )}
        {duration != null && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span>{formatDuration(duration)}</span>
          </>
        )}
        {data.compaction?.triggered && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span className="text-amber-600 dark:text-amber-400">Compaction</span>
          </>
        )}
        {/* ТЗ-2: Dev override active for this task */}
        {data.prompt?.overrideActive && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span
              className="rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-400"
              title={
                data.prompt.defaultModelId && data.prompt.effectiveModelId
                  ? `Override: ${data.prompt.defaultModelId} → ${data.prompt.effectiveModelId}`
                  : "Override active"
              }
            >
              &#9881; OVERRIDE
            </span>
          </>
        )}
        {/* ТЗ-DevPanelErrors: errors/warnings badge — distinct colors, click opens drawer */}
        {errorCount > 0 && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span className="text-destructive">
              &#9679; {errorCount} {errorCount === 1 ? "error" : "errors"}
            </span>
          </>
        )}
        {warningCount > 0 && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span className="text-yellow-600 dark:text-yellow-400">
              &#9888; {warningCount} {warningCount === 1 ? "warning" : "warnings"}
            </span>
          </>
        )}
        {isStreaming && (
          <>
            <span className="text-muted-foreground/30">&middot;</span>
            <span className="tabular-nums">{formatDuration(elapsed)}</span>
            <span className="animate-pulse">...</span>
          </>
        )}
        {isError && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span>{finishReason}</span>
          </>
        )}
        <span className={`ml-0.5 ${isError ? "text-destructive/40" : "text-muted-foreground/40"}`}>&#9656;</span>
      </button>

      <DevPanelDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        data={data}
      />
    </>
  );
}
