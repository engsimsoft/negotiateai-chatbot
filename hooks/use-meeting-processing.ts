// ТЗ-MR Этап 3: Hook for meeting processing with streaming progress
// Pattern: use-briefing-generation.ts (fetch → parse NDJSON → state)

"use client";

import { useState, useCallback, useRef } from "react";
import type { MeetingProgressEvent, MeetingProgressStep, SummaryLevel } from "@/lib/meeting/meeting-types";

export interface MeetingProcessingStep {
  step: MeetingProgressStep;
  message: string;
  done: boolean;
  detail?: string;
}

interface UseMeetingProcessingReturn {
  steps: MeetingProcessingStep[];
  isProcessing: boolean;
  error: string | null;
  recordId: string | null;
  startProcessing: (params: {
    blobUrl: string;
    summaryLevel: SummaryLevel;
    durationSeconds: number;
    userInstructions?: string | null;
  }) => void;
  reset: () => void;
}

export function useMeetingProcessing(): UseMeetingProcessingReturn {
  const [steps, setSteps] = useState<MeetingProcessingStep[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startProcessing = useCallback(
    (params: {
      blobUrl: string;
      summaryLevel: SummaryLevel;
      durationSeconds: number;
      userInstructions?: string | null;
    }) => {
      if (isProcessing) return;

      setSteps([]);
      setError(null);
      setRecordId(null);
      setIsProcessing(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        try {
          const response = await fetch("/api/meeting/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Failed to start processing");
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
                const event = JSON.parse(line) as MeetingProgressEvent;

                if (event.step === "error") {
                  setError(event.message);
                  setIsProcessing(false);
                  return;
                }

                if (event.step === "complete") {
                  setRecordId(event.recordId ?? null);
                  setIsProcessing(false);
                  return;
                }

                // Update or add step
                setSteps((prev) => {
                  const idx = prev.findIndex((s) => s.step === event.step);
                  const updated: MeetingProcessingStep = {
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
              : "Не удалось обработать запись.",
          );
        } finally {
          if (!controller.signal.aborted) {
            setIsProcessing(false);
          }
        }
      })();
    },
    [isProcessing],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSteps([]);
    setError(null);
    setRecordId(null);
    setIsProcessing(false);
  }, []);

  return {
    steps,
    isProcessing,
    error,
    recordId,
    startProcessing,
    reset,
  };
}
