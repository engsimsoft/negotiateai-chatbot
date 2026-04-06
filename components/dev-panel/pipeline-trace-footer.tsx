// ТЗ-DEV2: Compact monospace footer for pipeline trace (briefing/podcast)
// Analogous to DevPanelFooter but for pipeline-level traces.
// Shows live status during generation, final summary after completion.

"use client";

import { useState, useEffect, useRef } from "react";
import type {
  PipelineStageTrace,
  PipelineTraceSummary,
  UrlVerificationTrace,
} from "@/lib/ai/pipeline-trace";
import { PipelineTraceDrawer } from "./pipeline-trace-drawer";

const IS_DEV_MODE = process.env.NEXT_PUBLIC_SIMPLY_DEV_MODE === "true";

function formatTokens(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1_000) return n.toLocaleString("ru-RU");
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface PipelineTraceFooterProps {
  /** Accumulated stage traces (live during generation) */
  stages: PipelineStageTrace[];
  /** Final summary (set after completion) */
  summary: PipelineTraceSummary | null;
  /** Whether pipeline is currently running */
  isGenerating: boolean;
  /** ТЗ-PIPELINE1: URL verification data for drawer */
  urlVerification?: UrlVerificationTrace | null;
}

export function PipelineTraceFooter({
  stages = [],
  summary,
  isGenerating,
  urlVerification,
}: PipelineTraceFooterProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Live elapsed timer
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      startRef.current = 0;
      return;
    }
    if (!startRef.current) startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [isGenerating]);

  // Don't render in production or when no data
  if (!IS_DEV_MODE) return null;
  if (stages.length === 0 && !summary && !isGenerating) return null;

  // Compute live stats from stages
  const liveTokens = stages.reduce((sum, s) => sum + (s.ai?.totalTokens ?? 0), 0);
  const liveCost = stages.reduce((sum, s) => sum + (s.ai?.costRub ?? 0), 0);
  const liveErrors = stages.reduce((sum, s) => sum + s.errors.length, 0);

  const hasErrors = summary ? summary.errorCount > 0 : liveErrors > 0;
  const isError = summary?.status === "error";

  const colorClass = isError
    ? "bg-destructive/10 text-destructive/70 hover:bg-destructive/20 hover:text-destructive"
    : hasErrors
      ? "bg-amber-500/10 text-amber-600/70 hover:bg-amber-500/20 hover:text-amber-600"
      : "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground/80";

  const dotClass = isError
    ? "text-destructive/30"
    : hasErrors
      ? "text-amber-500/30"
      : "text-muted-foreground/30";

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open pipeline trace details"
        className={`mt-2 flex w-fit items-center gap-1.5 rounded px-1.5 py-1 font-mono text-[11px] leading-none transition-colors ${colorClass}`}
      >
        {summary ? (
          <>
            {/* Completed state */}
            <span>{summary.status === "error" ? "✗" : "✓"}</span>
            <span className={dotClass}>&middot;</span>
            <span>{formatTokens(summary.totalTokens)} tok</span>
            <span className={dotClass}>&middot;</span>
            <span>&#8381;{summary.totalCostRub.toFixed(2)}</span>
            <span className={dotClass}>&middot;</span>
            <span>{formatDuration(summary.totalDurationMs)}</span>
            {summary.urlVerification && (
              <>
                <span className={dotClass}>&middot;</span>
                <span>
                  URLs: {summary.urlVerification.verified}✓
                  {summary.urlVerification.fabricated > 0 && (
                    <span className="text-destructive"> {summary.urlVerification.fabricated}✗</span>
                  )}
                </span>
              </>
            )}
            {summary.errorCount > 0 && (
              <>
                <span className={dotClass}>&middot;</span>
                <span>{summary.errorCount} err</span>
              </>
            )}
          </>
        ) : (
          <>
            {/* Generating state */}
            <span>{stages.length} stages</span>
            {liveTokens > 0 && (
              <>
                <span className={dotClass}>&middot;</span>
                <span>{formatTokens(liveTokens)} tok</span>
              </>
            )}
            {liveCost > 0 && (
              <>
                <span className={dotClass}>&middot;</span>
                <span>&#8381;{liveCost.toFixed(2)}</span>
              </>
            )}
            <span className={dotClass}>&middot;</span>
            <span className="tabular-nums">{formatDuration(elapsed)}</span>
            <span className="animate-pulse">...</span>
          </>
        )}
        <span className={`ml-0.5 ${isError ? "text-destructive/40" : "text-muted-foreground/40"}`}>&#9656;</span>
      </button>

      <PipelineTraceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        stages={stages}
        summary={summary}
        urlVerification={urlVerification}
      />
    </>
  );
}
