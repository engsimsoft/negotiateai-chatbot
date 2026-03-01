// ТЗ-А5 + ТЗ-DEV2: Hook for briefing generation with streaming progress + trace

"use client";

import { useState, useCallback, useRef } from "react";
import type { BriefingProgressEvent } from "@/lib/briefing/briefing-types";
import type {
  PipelineStageTrace,
  PipelineTraceSummary,
} from "@/lib/ai/pipeline-trace";

const IS_DEV_MODE = process.env.NEXT_PUBLIC_SIMPLY_DEV_MODE === "true";

export interface BriefingGenerationStep {
  step: BriefingProgressEvent["step"];
  message: string;
  done: boolean;
  detail?: string;
}

interface UseBriefingGenerationReturn {
  steps: BriefingGenerationStep[];
  isGenerating: boolean;
  error: string | null;
  redirectUrl: string | null;
  startGeneration: () => void;
  reset: () => void;
  /** ТЗ-DEV2: Accumulated stage traces (dev mode only) */
  traceStages: PipelineStageTrace[];
  /** ТЗ-DEV2: Final trace summary (dev mode only) */
  traceSummary: PipelineTraceSummary | null;
}

export function useBriefingGeneration(): UseBriefingGenerationReturn {
  const [steps, setSteps] = useState<BriefingGenerationStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ТЗ-DEV2: Trace state (dev mode only)
  const [traceStages, setTraceStages] = useState<PipelineStageTrace[]>([]);
  const [traceSummary, setTraceSummary] = useState<PipelineTraceSummary | null>(null);

  const startGeneration = useCallback(() => {
    if (isGenerating) return;

    // Reset state
    setSteps([]);
    setError(null);
    setRedirectUrl(null);
    setIsGenerating(true);
    setTraceStages([]);
    setTraceSummary(null);

    // Abort any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const response = await fetch("/api/briefing/generate", {
          method: "POST",
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to start generation");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const parsed = JSON.parse(line);

              // ТЗ-DEV2: Handle trace events (dev mode only)
              if (IS_DEV_MODE && parsed.trace && !parsed.step) {
                setTraceStages((prev) => [...prev, parsed.trace as PipelineStageTrace]);
                continue;
              }
              if (IS_DEV_MODE && parsed.traceSummary && !parsed.step) {
                setTraceSummary(parsed.traceSummary as PipelineTraceSummary);
                continue;
              }
              if (IS_DEV_MODE && parsed.urlVerification && !parsed.step) {
                // URL verification — stored in traceSummary when it arrives
                continue;
              }

              const event = parsed as BriefingProgressEvent;

              if (event.step === "error") {
                setError(event.message);
                setIsGenerating(false);
                return;
              }

              if (event.step === "complete") {
                setRedirectUrl(event.redirectUrl ?? "/briefing");
                setIsGenerating(false);
                return;
              }

              // Update or add step
              setSteps((prev) => {
                const idx = prev.findIndex((s) => s.step === event.step);
                const updated: BriefingGenerationStep = {
                  step: event.step,
                  message: event.message,
                  done: event.done ?? false,
                  detail: event.detail,
                };

                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updated;
                  return next;
                }
                return [...prev, updated];
              });
            } catch {
              // Skip malformed lines
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось сгенерировать брифинг.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
      }
    })();
  }, [isGenerating]);

  const reset = useCallback(() => {
    setSteps([]);
    setError(null);
    setRedirectUrl(null);
    setTraceStages([]);
    setTraceSummary(null);
  }, []);

  return {
    steps,
    isGenerating,
    error,
    redirectUrl,
    startGeneration,
    reset,
    traceStages,
    traceSummary,
  };
}
