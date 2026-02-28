"use client";

import { useState, useEffect, useRef } from "react";
import { useDevPanel } from "./dev-panel-provider";
import { DevPanelDrawer } from "./dev-panel-drawer";

const MODEL_DISPLAY: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku": "Haiku",
  "claude-sonnet": "Sonnet",
  "claude-opus": "Opus",
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

  if (!data) return null;

  const finishReason = data.finish?.finishReason ?? data.steps.at(-1)?.finishReason;
  const isError = !!finishReason && ERROR_REASONS.has(finishReason);

  const modelName = data.finish?.modelId
    ? (MODEL_DISPLAY[data.finish.modelId] ?? data.finish.modelId)
    : data.steps[0]?.modelId
      ? (MODEL_DISPLAY[data.steps[0].modelId] ?? data.steps[0].modelId)
      : "...";

  const totalTokens = data.finish
    ? data.finish.totalInputTokens + data.finish.totalOutputTokens
    : data.steps.reduce((sum, s) => sum + s.inputTokens + s.outputTokens, 0);

  const cost = data.finish?.estimatedCostRub;
  const duration = data.finish?.totalDurationMs;

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
            <span>&#8381;{cost.toFixed(2)}</span>
          </>
        )}
        {duration != null && (
          <>
            <span className={isError ? "text-destructive/30" : "text-muted-foreground/30"}>&middot;</span>
            <span>{formatDuration(duration)}</span>
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
